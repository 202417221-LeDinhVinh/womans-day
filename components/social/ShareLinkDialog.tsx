"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-alert-dialog";
import { Check, Copy, Mail } from "lucide-react";
import toast from "react-hot-toast";

type ShareTarget = {
  name: string;
  href: (url: string, title: string) => string;
  icon: React.ReactNode;
};

// Brand glyphs as inline SVG — lucide dropped its social/brand set, and these
// stay crisp at any size while inheriting the workbook border treatment.
const XGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  </svg>
);

const WhatsAppGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.978-1.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

const TelegramGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const RedditGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.561-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
  </svg>
);

const FacebookGlyph = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const SHARE_TARGETS: ShareTarget[] = [
  {
    name: "X",
    icon: XGlyph,
    href: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: "WhatsApp",
    icon: WhatsAppGlyph,
    href: (url, title) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
  },
  {
    name: "Telegram",
    icon: TelegramGlyph,
    href: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    name: "Reddit",
    icon: RedditGlyph,
    href: (url, title) =>
      `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  },
  {
    name: "Facebook",
    icon: FacebookGlyph,
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: "Email",
    icon: <Mail className="h-5 w-5" aria-hidden />,
    href: (url, title) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
];

type ShareLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Absolute URL that gets copied and handed to each social target.
  url: string;
  // Used as the tweet/email text; also the visible copy is keyed off it.
  title: string;
  // Dialog heading, e.g. "Share this post" or "Share this test".
  heading: string;
};

// Shared share sheet: the social-target grid + copy-link row. Owns nothing but
// its own copied/animation state — the caller controls open/close and supplies
// the URL, so this drops into any surface (forum post, practice card, …).
export function ShareLinkDialog({ open, onOpenChange, url, title, heading }: ShareLinkDialogProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  function openTarget(target: ShareTarget) {
    const href = target.href(url, title);
    if (target.name === "Email") {
      window.open(href, "_self");
    } else {
      window.open(href, "_blank", "noopener,noreferrer");
    }
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[100] bg-scrim/40"
          onClick={() => onOpenChange(false)}
        />
        <Dialog.Content
          data-lenis-prevent
          className="fixed left-1/2 top-1/2 z-[101] flex w-[min(28rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[var(--ui-radius)] border border-border bg-surface-white shadow-[var(--ui-shadow-lg)]"
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border-strong px-4 py-3 sm:px-5">
            <Dialog.Title className="font-display text-lg font-extrabold text-ink-fg sm:text-xl">
              {heading}
            </Dialog.Title>
            <Dialog.Cancel asChild>
              <button
                type="button"
                aria-label="Close"
                className="rounded-[var(--ui-radius-sm)] border border-border bg-surface-white px-2 py-1 text-xs font-bold text-ink-fg shadow-[var(--ui-shadow)] workbook-press"
              >
                Close
              </button>
            </Dialog.Cancel>
          </div>

          <Dialog.Description className="sr-only">
            Copy the link or share it to another app.
          </Dialog.Description>

          <div className="space-y-4 px-4 py-4 sm:px-5">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
              {SHARE_TARGETS.map((target) => (
                <button
                  key={target.name}
                  type="button"
                  onClick={() => openTarget(target)}
                  className="flex flex-col items-center gap-1.5 rounded-[var(--ui-radius)] border border-border bg-surface-white px-2 py-3 text-xs font-bold text-ink-fg shadow-[var(--ui-shadow)] workbook-press"
                >
                  {target.icon}
                  {target.name}
                </button>
              ))}
            </div>

            <div className="flex items-stretch gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 truncate rounded-[var(--ui-radius)] border border-border bg-paper-bg px-3 py-2 text-sm text-ink-fg outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-[var(--ui-radius)] border border-border px-3 py-2 text-sm font-bold shadow-[var(--ui-shadow)] workbook-press ${copied ? "bg-accent-1 text-ink-fg" : "bg-surface-white text-ink-fg"}`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
