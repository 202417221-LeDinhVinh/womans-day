"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { triggerBlobDownload } from "@/lib/pdfDownload";

// The Copy / Download / Share action row shared by every share overlay
// (ReportSharePanel for score-report slides, ShareImageDialog for the question
// reader). Given a ready PNG blob it copies to the clipboard, downloads a file,
// and — where the browser supports sharing files — opens the native share sheet.
// Purely presentational: the parent owns the capture and hands the blob down.

type ActionState = "idle" | "busy" | "done" | "failed";

export default function ShareActions({
  blob,
  fileName,
  shareTitle,
  secondaryAction,
}: {
  // The ready PNG blob, or null while the parent is still capturing / errored.
  blob: Blob | null;
  fileName: string;
  shareTitle: string;
  /** Optional equal-width peer beside Download and native Share. */
  secondaryAction?: ReactNode;
}) {
  const [copyState, setCopyState] = useState<ActionState>("idle");
  const [shareState, setShareState] = useState<ActionState>("idle");
  const [canShareFiles, setCanShareFiles] = useState(false);

  // Reset action feedback whenever a fresh blob arrives (e.g. the parent
  // re-captures for a new slide/question).
  useEffect(() => {
    setCopyState("idle");
    setShareState("idle");
  }, [blob]);

  // Feature-detect native file sharing so the button only shows where it works.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.canShare || !navigator.share) {
      setCanShareFiles(false);
      return;
    }
    try {
      const probe = new File([new Blob([""], { type: "image/png" })], "probe.png", {
        type: "image/png",
      });
      setCanShareFiles(navigator.canShare({ files: [probe] }));
    } catch {
      setCanShareFiles(false);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!blob) {
      return;
    }
    setCopyState("busy");
    try {
      if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
        throw new Error("unsupported");
      }
      window.getSelection()?.removeAllRanges();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  }, [blob]);

  const handleDownload = useCallback(() => {
    if (!blob) {
      return;
    }
    triggerBlobDownload(blob, fileName);
  }, [blob, fileName]);

  const handleNativeShare = useCallback(async () => {
    if (!blob) {
      return;
    }
    setShareState("busy");
    try {
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        throw new Error("unsupported");
      }
      await navigator.share({ files: [file], title: shareTitle });
      setShareState("done");
    } catch (error) {
      // A user-cancelled share sheet rejects with AbortError — treat that as a
      // no-op, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareState("idle");
        return;
      }
      setShareState("failed");
    }
  }, [blob, fileName, shareTitle]);

  const ready = blob !== null;

  return (
    <div className="mt-5 flex shrink-0 flex-col gap-2.5">
      <button
        type="button"
        onClick={() => void handleCopy()}
        disabled={!ready || copyState === "busy"}
        className="workbook-press flex h-11 items-center justify-center gap-2 rounded-[var(--ui-radius)] border border-border bg-bg-inverse text-sm font-bold text-on-inverse transition-colors disabled:opacity-50"
      >
        {copyState === "busy"
          ? "Copying…"
          : copyState === "done"
            ? "Copied to clipboard"
            : copyState === "failed"
              ? "Copy not supported"
              : "Copy image"}
      </button>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!ready}
          className="workbook-press flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--ui-radius)] border border-border bg-surface-white text-sm font-bold text-ink-fg transition-colors hover:bg-paper-bg disabled:opacity-50"
        >
          Download PNG
        </button>
        {canShareFiles ? (
          <button
            type="button"
            onClick={() => void handleNativeShare()}
            disabled={!ready || shareState === "busy"}
            className="workbook-press flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--ui-radius)] border border-border bg-surface-white text-sm font-bold text-ink-fg transition-colors hover:bg-paper-bg disabled:opacity-50"
          >
            {shareState === "busy"
              ? "Sharing…"
              : shareState === "failed"
                ? "Share failed"
                : "Share"}
          </button>
        ) : null}
        {secondaryAction}
      </div>
    </div>
  );
}
