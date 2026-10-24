import { API_PATHS } from "@/lib/apiPaths";
import { getStoredTestAccessToken } from "@/lib/testAccessStorage";

// In-progress cap snapshot returned on a 429 from the download route. Carried on
// `PdfLimitError` so the dialog can render the full In-Progress Limit notice.
export type PdfDownloadLimit = {
  open: number;
  cap: number;
  nextCap: number | null;
  completionsToNextTier: number | null;
};

/** Thrown when the download is refused because the student is at their slot cap. */
export class PdfLimitError extends Error {
  limit: PdfDownloadLimit;

  constructor(message: string, limit: PdfDownloadLimit) {
    super(message);
    this.name = "PdfLimitError";
    this.limit = limit;
  }
}

// Weekly/monthly download-quota snapshot returned on the OTHER 429. Distinct from
// `PdfDownloadLimit`: that one is fixed by finishing a test, this one only by
// waiting for the rolling window to move (or upgrading).
export type PdfDownloadQuotaDenial = {
  window: "week" | "month";
  limit: number;
  used: number;
  resetAt: number | null;
};

/** Thrown when the download is refused by the weekly/monthly download ceiling. */
export class PdfQuotaError extends Error {
  quota: PdfDownloadQuotaDenial;

  constructor(message: string, quota: PdfDownloadQuotaDenial) {
    super(message);
    this.name = "PdfQuotaError";
    this.quota = quota;
  }
}

function buildFallbackFileName(testName: string, sectionName?: string) {
  const suffix = sectionName ? `-${sectionName}` : "";
  const baseName = `ronan-sat-${testName}${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${baseName || "ronan-sat-practice"}.pdf`;
}

export function getFileNameFromContentDisposition(value: string | null) {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = value.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? null;
}

/** Trigger a browser download of a Blob under `fileName` (anchor-click trick). */
export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Fetches the active PDF for a test (full booklet, or a section booklet when
 * `sectionName` is set), then triggers a browser download. Attaches the stored
 * access token header for token-gated tests. Shared by `DownloadPdfButton` and
 * the `PdfDownloadDialog` so both keep identical fetch + filename behavior.
 */
export async function downloadTestPdf({
  testId,
  testName = "Practice Test",
  sectionName,
}: {
  testId: string;
  testName?: string;
  sectionName?: string;
}) {
  const params = new URLSearchParams({ testId });
  if (sectionName) {
    params.set("section", sectionName);
  }
  const headers = new Headers();
  const token = getStoredTestAccessToken(testId);
  if (token) {
    headers.set("x-test-access-token", token);
  }

  const response = await fetch(`${API_PATHS.TEST_PDF_DOWNLOAD}?${params.toString()}`, {
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    // The route returns the cap snapshot under `limit` and the download-quota
    // snapshot under `quota`; tolerate `details` too in case an older deploy is live.
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      limit?: PdfDownloadLimit;
      details?: PdfDownloadLimit;
      quota?: PdfDownloadQuotaDenial;
    } | null;
    const message = payload?.error || "Unable to download the PDF.";
    const limit = payload?.limit ?? payload?.details;
    // Both refusals are 429; the payload key says which. Quota is checked first
    // because it is the earlier gate server-side, so the two can never both be set.
    if (response.status === 429 && payload?.quota) {
      throw new PdfQuotaError(message, payload.quota);
    }
    // 429 = in-progress slot cap. Surface a typed error carrying the cap snapshot
    // so the dialog can render the full In-Progress Limit notice, not a toast.
    if (response.status === 429 && limit) {
      throw new PdfLimitError(message, limit);
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const fileName =
    getFileNameFromContentDisposition(response.headers.get("content-disposition")) ||
    buildFallbackFileName(testName, sectionName);
  triggerBlobDownload(blob, fileName);
}
