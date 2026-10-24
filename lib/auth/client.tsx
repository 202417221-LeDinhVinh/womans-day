"use client";

/**
 * Session seam for the standalone womans-day site.
 *
 * This repo has no auth backend: there is no Supabase project, no session cookie, and no
 * `/api/auth/*`. The celebration works fully signed out (gift links, localStorage name,
 * bouquet, garden and polaroid are all client-side), so `useSession()` permanently
 * reports "unauthenticated" and every session-gated nicety (name prefill) is skipped.
 *
 * Shape mirrors `lib/auth/client.tsx#useSession` in ronansat-platform
 * (`{ data, status }`), so `WomansDayExperience` and any future consumer compile
 * unchanged. If this site ever gains the platform's auth, replace this file with the
 * real provider + client and add the Supabase env vars.
 */

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export type SessionData = {
  user: {
    name?: string | null;
  };
} | null;

const ANONYMOUS = {
  data: null as SessionData,
  status: "unauthenticated" as const,
};

export function useSession(): { data: SessionData; status: SessionStatus } {
  return ANONYMOUS;
}
