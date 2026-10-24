"use client";

import { Minus, Pause, Play, Plus } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  isMusicPlaying,
  isSoundEnabled,
  startMusic,
  stopMusic,
  subscribeSound,
  toggleSound,
} from "@/lib/womansDay/sound";
import { Art } from "@/components/womans-day/paper";

/**
 * The letter scene's music card: the reel's dark rounded player with our own painted
 * cover, a four-bar equalizer and a real play/pause over the same audio element the
 * rest of the route uses. Sound stays off until a gesture; pressing play IS a gesture.
 *
 * Sizes are container-relative so the card keeps its proportions in the letter column.
 */

const BARS = [
  { delay: "0s", duration: "0.9s" },
  { delay: "0.18s", duration: "1.15s" },
  { delay: "0.34s", duration: "0.82s" },
  { delay: "0.08s", duration: "1.05s" },
];

export function MusicWidget({
  visible,
  className = "",
}: {
  /** The letter is the visible scene; music may have auto-started with the reveal. */
  visible: boolean;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const enabled = useSyncExternalStore(subscribeSound, isSoundEnabled, () => true);

  useEffect(() => {
    if (visible) setPlaying(isMusicPlaying());
  }, [visible]);

  const active = playing && enabled;

  const toggle = useCallback(() => {
    if (active) {
      stopMusic();
      setPlaying(false);
      return;
    }
    if (!enabled) toggleSound();
    startMusic();
    setPlaying(true);
  }, [active, enabled]);

  return (
    <div
      className={`relative flex w-full items-center gap-[3.5%] rounded-[14px] border border-white/10 bg-[#241d1a] px-[4%] py-[3.6%] text-[#f4ead6] shadow-[0_10px_24px_rgba(40,26,20,0.35)] ${className}`}
      style={{ containerType: "inline-size" }}
    >
      <div className="relative aspect-square w-[24%] shrink-0 overflow-hidden rounded-[7px] bg-[#5b3f33]">
        <Art src="/womans-day/paper/music-cover.webp" className="h-full w-full object-cover" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-[family-name:var(--font-book)] text-[clamp(13px,3.6cqw,17px)] italic leading-tight">
          Autumn Prelude
        </p>
        <p className="mt-[3px] truncate font-[family-name:var(--font-type)] text-[clamp(10px,2.1cqw,12px)] tracking-[0.06em] text-[#d9c9b3]/70">
          Ronan SAT Study Session
        </p>

        <div className="mt-[9%] flex h-[9cqw] max-h-[18px] items-end gap-[1.6cqw]" aria-hidden>
          {BARS.map((bar, index) => (
            <span
              key={index}
              className="block w-[2cqw] min-w-[2px] origin-bottom rounded-full bg-[#e6b3bd]"
              style={{
                height: "100%",
                animation: active
                  ? `wd-eq ${bar.duration} ease-in-out ${bar.delay} infinite`
                  : undefined,
                transform: active ? undefined : "scaleY(0.28)",
                opacity: active ? 1 : 0.45,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-[6px]">
        <button
          type="button"
          onClick={toggle}
          aria-label={active ? "Pause the study music" : "Play the study music"}
          aria-pressed={active}
          className="flex h-[clamp(34px,11cqw,46px)] w-[clamp(34px,11cqw,46px)] cursor-pointer items-center justify-center rounded-full bg-[#f4ead6] text-[#241d1a] transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#e6b3bd] active:scale-95"
        >
          {active ? (
            <Pause aria-hidden className="h-[45%] w-[45%]" fill="currentColor" />
          ) : (
            <Play aria-hidden className="ml-[6%] h-[45%] w-[45%]" fill="currentColor" />
          )}
        </button>
        <div className="flex gap-[5px] text-[#d9c9b3]/55">
          <Plus aria-hidden className="h-[10px] w-[10px]" />
          <Minus aria-hidden className="h-[10px] w-[10px]" />
        </div>
      </div>
    </div>
  );
}
