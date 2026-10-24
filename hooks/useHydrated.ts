"use client";

import { useSyncExternalStore } from "react";

/** Nothing to subscribe to: the value flips exactly once, when React finishes hydrating. */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * False during SSR and through hydration, true from the first render after it.
 *
 * FOR RENDERING SOMETHING THAT ONLY THE BROWSER KNOWS — a `localStorage` snapshot, a media
 * query, a device capability — without lying to hydration. Reading such a value straight into
 * the first client render makes the client's markup disagree with the server's, and React
 * answers a mismatch by throwing the subtree away and rebuilding it; in a test room that means
 * mounting, discarding and re-mounting live machinery such as a recorder.
 *
 * WHY `useSyncExternalStore` AND NOT AN EFFECT. The obvious version — `useEffect(() =>
 * setMounted(true))` — is a setState inside an effect body, which this repo's lint rules reject
 * as a cascading render. `getServerSnapshot` is exactly the supported way to say "this value is
 * different on the server", and React schedules the post-hydration re-render itself.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
