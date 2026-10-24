# womans-day · Ronan SAT

Standalone interactive Women's Day celebration, served at **womans-day.ronansat.com**.
Ported from `ronansat-platform` (`app/womans-day`, `components/womans-day`,
`lib/womansDay`) — same code, same art, none of the platform shell.

## What's here

- `app/womans-day/` — the celebration route (fonts + metadata + static-safe page).
  Gift links work exactly as on the platform: `/womans-day?to=<name>&b=<bouquet-code>`.
- `components/womans-day/`, `lib/womansDay/` — the whole feature, including unit tests.
- `components/social/` — keepsake/share dialogs and their capture chain only.
- `public/womans-day/` — all 102 art + audio files.
- `scripts/womans-day/` — asset-generation scripts (run with `bun`, needs `sharp`).
- `/` redirects to `/womans-day` (preserving the query string).

## Develop

```bash
bun install
bun run dev      # http://localhost:4000
bun test lib/womansDay
bun run typecheck
bun run lint
bun run build    # static export to out/
```

## Deploy

`next.config.ts` uses `output: "export"` + unoptimized images: `bun run build` emits a
fully static `out/` directory — serve it from any static host.

**womans-day.ronansat.com is NOT wired by this repo.** A subdomain needs, outside code:

1. DNS: a record for `womans-day` → the host (e.g. Cloudflare DNS).
2. The deployment attached to that hostname (Cloudflare Pages project / Worker /
   static bucket serving `out/`).

Point 1+2 at the `out/` produced here and the domain serves this build. This PR only
carries the site code.

## Intentional differences from the platform copy

- **No auth.** `lib/auth/client.tsx` is a documented shim reporting `unauthenticated`.
  Name prefill from a signed-in session is skipped; gift-link `?to=`, localStorage and
  typing all still work. To wire real auth later, replace that file with the platform's
  provider + client.
- **No app shell.** No navbar, posthog, theme, or providers — just the celebration.
- **Static export.** `page.tsx` parses the gift link client-side (Suspense +
  `useSearchParams`) instead of server `searchParams`.
- **Toasts.** One global `react-hot-toast` `<Toaster />` in the root layout (the
  platform mounts its own in the app shell).
