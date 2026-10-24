const TEST_ACCESS_STORAGE_PREFIX = "ronan:test-access:v1";

type StoredTestAccess = {
  unlocked: true;
  unlockedAt: string;
  token?: string;
};

function getTestAccessStorageKey(testId: string) {
  return `${TEST_ACCESS_STORAGE_PREFIX}:${testId}`;
}

export function hasStoredTestAccess(testId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const rawValue = window.localStorage.getItem(getTestAccessStorageKey(testId));

    if (!rawValue) {
      return false;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredTestAccess>;
    return parsed.unlocked === true;
  } catch {
    return false;
  }
}

export function getStoredTestAccessToken(testId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(getTestAccessStorageKey(testId));
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredTestAccess>;
    return typeof parsed.token === "string" && parsed.token.trim() ? parsed.token : null;
  } catch {
    return null;
  }
}

export function storeTestAccess(testId: string, token?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const value: StoredTestAccess = {
    unlocked: true,
    unlockedAt: new Date().toISOString(),
    token: token?.trim() || undefined,
  };

  try {
    window.localStorage.setItem(getTestAccessStorageKey(testId), JSON.stringify(value));
  } catch {
    // If localStorage is unavailable, keep the in-memory UI state unlocked for this session.
  }
}

export function clearStoredTestAccess(testId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(getTestAccessStorageKey(testId));
  } catch {
    // No-op: nothing to clear if storage is unavailable.
  }
}
