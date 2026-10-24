"use client";

import Lenis from "lenis";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useSession } from "@/lib/auth/client";
import { useHydrated } from "@/hooks/useHydrated";
import { useBouquet } from "@/lib/womansDay/bouquetState";
import {
  GARDEN_STORAGE_KEY,
  MAX_PLANTED,
  parseGarden,
  plantAt,
  serializeGarden,
  surpriseFlower,
  type Planted,
} from "@/lib/womansDay/garden";
import { processPhoto } from "@/lib/womansDay/photo";
import { usePolaroid } from "@/lib/womansDay/polaroidState";
import { WINDOW } from "@/lib/womansDay/polaroidGeometry";
import { FLOWERS, WOMANS_DAY_SHORT, type FlowerId } from "@/lib/womansDay/flowers";
import {
  displayNameFor,
  flowerIndexForName,
  hashTag,
  sanitizeName,
} from "@/lib/womansDay/flowerHash";
import { type Gift } from "@/lib/womansDay/giftLink";
import { useParcel } from "@/lib/womansDay/parcelMachine";
import { criticalImages, deferredImages, floristImages } from "@/lib/womansDay/assets";
import {
  LETTER_SPREAD,
  SCROLL_SCREENS,
  SEGMENTS,
  SPREAD,
  TURNS,
  TURN_LANDED_EPSILON,
  progressToScrollTop,
  restProgress,
  sceneAt,
  settleTarget,
  spreadBefore,
  turnFor,
  type Scene,
  type TurnId,
} from "@/lib/womansDay/timeline";
import {
  initSound,
  isSoundEnabled,
  playSound,
  startMusic,
  subscribeSound,
  toggleSound,
  unlockSound,
} from "@/lib/womansDay/sound";
import { FlowerWall } from "@/components/womans-day/FlowerWall";
import { KeepsakeCard, KEEPSAKE_ID } from "@/components/womans-day/KeepsakeCard";
import { LetterScene } from "@/components/womans-day/LetterScene";
import { Textbook, type PageRenderer } from "@/components/womans-day/Textbook";
import { Art, PaperSurface, Sticker, useWarmAssets } from "@/components/womans-day/paper";
import { CoverPage } from "@/components/womans-day/spreads/CoverPage";
import {
  GardenMobilePage,
  GardenPage,
  PolaroidPage,
} from "@/components/womans-day/spreads/GardenSpread";
import {
  FloristBouquetPage,
  FloristMobilePage,
  FloristShelfPage,
} from "@/components/womans-day/spreads/FloristSpread";
import {
  MailMobilePage,
  MailNotePage,
  MailParcelPage,
} from "@/components/womans-day/spreads/MailSpread";
import {
  PlateMobilePage,
  PlatePage,
  ReadingPage,
  type PlateReveal,
} from "@/components/womans-day/spreads/PlateSpread";
import {
  ScrapbookLeftPage,
  ScrapbookMobilePage,
  ScrapbookRightPage,
} from "@/components/womans-day/spreads/ScrapbookSpread";
import ShareImageDialog from "@/components/social/ShareImageDialog";

/**
 * The one client root for /womans-day: scroll track, Lenis, scene state, sound, the
 * bouquet reducer and the two closing dialogs. Everything below this file is a pure
 * render of the state it owns, which is what lets a page live in the turning leaf and in
 * the book beneath it at the same time.
 */

const NAME_STORAGE_KEY = "womans-day:name";
const TURN_HINT_KEY = "womans-day:turn-hint";

// Module-level so the capture dialog's effect dependencies stay stable (an inline
// object would re-run the capture on every render).
const KEEPSAKE_CAPTURE = {
  backgroundColor: "#ece4d2",
  padding: 0,
  shadow: false,
  pixelRatio: 2,
  minOutputWidth: 1080,
};

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    [query]
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function WomansDayExperience({ gift }: { gift: Gift }) {
  const hydrated = useHydrated();
  const mobile = useMediaQuery("(max-width: 767px)");
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { data: session, status } = useSession();

  const trackRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  // While a programmatic click-to-turn runs, the settle timer must not fire. `snappingUntil`
  // (a timestamp) already suppresses a user snap; the click-turn reuses it. The queue keeps
  // at most ONE extra click so a fast double-click turns two pages back to back.
  const queuedTurnRef = useRef<1 | -1 | null>(null);
  // Timestamp until which user settle snaps must be suppressed (a programmatic click-turn
  // or the settle snap itself owns the motion).
  const snappingUntilRef = useRef(0);
  const velocity = useMotionValue(0);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  // Break framer's view-timeline acceleration at the source. With a `target` ref and a
  // supported offset, `useScroll` tags `scrollYProgress` with an `accelerate` config, and
  // any ARRAY-form `useTransform(scrollYProgress, [in], [out])` inherits it — those props
  // (opacity, clipPath, transform, …) then get driven by a native ViewTimeline whose range
  // does not match the track's `["start start","end end"]`, so the hint and the book clip
  // re-open/close at the wrong scroll positions. The function form below never inherits it,
  // so `progress` is a plain derived value; every consumer must take `progress`, never
  // `scrollYProgress`.
  const progress = useTransform(scrollYProgress, (value) => value);

  const [scene, setScene] = useState<Scene>(() => sceneAt(0));
  // The spread the reader has settled on (no leaf in the air). `null` while a leaf turns,
  // so spread entry animations run only on arrival.
  const [arrivedSpread, setArrivedSpread] = useState<number | null>(0);
  // The selected bouquet head (page variant only); cleared on a page turn or deselect.
  const [selectedHead, setSelectedHead] = useState<string | null>(null);
  // Has the plate spread's intro (the specimen drop + write-in) already played? It is
  // marked DONE one event-loop turn AFTER the first arrival at spread 1 (see the effect
  // above), so the arrival render still plays the intro while every later render — a
  // re-arrival, a return from the cover, a leaf copy — is `final` and never animates to a
  // hidden pose (the "content disappears while scrolling" report).
  const [plateRevealed, setPlateRevealed] = useState(false);
  // Every spread the reader has EVER settled on. Once a spread has arrived, its reveal
  // animation is done for good: re-arriving from the other direction (or leaving and
  // returning) keeps the FINAL state instead of replaying the drop/write-in, and a
  // departure must never animate content back to opacity 0 (that reads as a reload).
  const arrivedEver = useRef<Set<number>>(new Set([0]));
  // The "click the page edge to turn" hint shows once, until the first click-turn.
  const [turnedOnce, setTurnedOnce] = useState(true);
  const [name, setName] = useState(gift.to ?? "");
  const touchedName = useRef(false);
  const seededName = useRef(false);

  const displayName = displayNameFor(name);
  const flower = useMemo(() => FLOWERS[flowerIndexForName(displayName)], [displayName]);
  const tracking = useMemo(() => hashTag(displayName), [displayName]);
  const [bouquet, dispatch] = useBouquet(flower.id, gift.bouquet ?? undefined);
  // The garden the reader plants (Plan 15 §2), and the scratch polaroid (§3). Both live
  // here so a turning-leaf copy is identical to the base page.
  const [planted, setPlanted] = useState<Planted[]>([]);
  const [gardenReady, setGardenReady] = useState(false);
  const freshKeysRef = useRef<Set<string>>(new Set());
  const [freshKeys, setFreshKeys] = useState<ReadonlySet<string>>(() => new Set());
  const polaroid = usePolaroid();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // The parcel bursts the bouquet the reader is actually carrying (the gift bouquet for a
  // recipient, otherwise their own), not a fixed list.
  const burst = useMemo(() => bouquet.items.map((item) => item.id), [bouquet.items]);

  // Warm the whole route image set up front so a scroll never waits on a decode/fetch.
  // The critical set (cover + wall + the reader's plate) is decoded first; the rest at idle.
  const critical = useMemo(() => criticalImages(flower.id), [flower.id]);
  // The florist tier (512 px heads, stems, wrap art) runs FIRST inside the deferred pool
  // so a picked flower's head is decoded before the click.
  const deferred = useMemo(() => {
    const first = floristImages();
    const seen = new Set(first);
    return [...first, ...deferredImages().filter((src) => !seen.has(src))];
  }, []);
  useWarmAssets(critical, deferred);

  const [shareOpen, setShareOpen] = useState(false);
  const [parcelAutoOpen, setParcelAutoOpen] = useState(false);
  const [parcelOpened, setParcelOpened] = useState(false);
  // The parcel step lives here so a remount (leaf copy, settle snap, scene flip) cannot
  // reset it; `resetKey` = "the reader is parked off the mail rest".
  const {
    step: parcelStep,
    advance: advanceParcel,
    forceStep: forceParcelStep,
  } = useParcel(!parcelAutoOpen);

  const soundOn = useSyncExternalStore(subscribeSound, isSoundEnabled, () => true);

  // Restore saved / session name once. A gift link's `?to=` wins over both.
  useEffect(() => {
    if (!hydrated || seededName.current) return;
    if (gift.to) {
      seededName.current = true;
      return;
    }
    if (touchedName.current) {
      seededName.current = true;
      return;
    }

    let stored = "";
    try {
      stored = sanitizeName(window.localStorage.getItem(NAME_STORAGE_KEY));
    } catch {
      stored = "";
    }

    if (stored) {
      setName(stored);
      seededName.current = true;
      return;
    }

    const sessionName = sanitizeName(session?.user?.name ?? "");
    if (sessionName) {
      setName(sessionName);
      seededName.current = true;
      return;
    }

    if (status !== "loading") seededName.current = true;
  }, [hydrated, gift.to, session, status]);

  useEffect(() => {
    if (!hydrated || !seededName.current) return;
    try {
      window.localStorage.setItem(NAME_STORAGE_KEY, name);
    } catch {
      // Private mode: the label lives for this visit only.
    }
  }, [hydrated, name]);

  // The click-to-turn hint is remembered: once the reader has turned a page by clicking the
  // edge, it never shows again.
  useEffect(() => {
    if (!hydrated) return;
    try {
      setTurnedOnce(window.localStorage.getItem(TURN_HINT_KEY) === "1");
    } catch {
      setTurnedOnce(false);
    }
  }, [hydrated]);

  // Audio: restore the mute preference, then unlock on the first gesture.
  useEffect(() => {
    initSound();
    return unlockSound();
  }, []);

  // Restore the saved garden once, then persist every change.
  useEffect(() => {
    if (!hydrated || gardenReady) return;
    let stored: Planted[] = [];
    try {
      stored = parseGarden(window.localStorage.getItem(GARDEN_STORAGE_KEY));
    } catch {
      stored = [];
    }
    setPlanted(stored);
    setGardenReady(true);
  }, [hydrated, gardenReady]);

  useEffect(() => {
    if (!gardenReady) return;
    try {
      window.localStorage.setItem(GARDEN_STORAGE_KEY, serializeGarden(planted));
    } catch {
      // Storage disabled: the garden lives for this visit only.
    }
  }, [planted, gardenReady]);

  /**
   * Plant a flower at a page point. `id` is the species chosen in the garden's seed tray (a
   * "surprise me" packet passes null → a deterministic pick). Past `MAX_PLANTED` the oldest
   * flower wilts: it is dropped from the list (the grow animation only ever runs for new
   * plants, so the wilt is the removal).
   */
  const handlePlant = useCallback((cx: number, cy: number, id: FlowerId | null) => {
    setPlanted((current) => {
      const flowerId = id ?? surpriseFlower(Math.floor(cx * 13 + cy * 7 + current.length));
      const plant = plantAt(cx, cy, current, flowerId);
      if (freshKeysRef.current.size > 60) freshKeysRef.current.clear();
      freshKeysRef.current.add(plant.key);
      setFreshKeys(new Set(freshKeysRef.current));
      playSound("sprout");
      const grown = [...current, plant];
      if (grown.length > MAX_PLANTED) return grown.slice(1);
      return grown;
    });
  }, []);

  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** Empty the garden so the reader can redo the "A garden for you" page. */
  const handleClearGarden = useCallback(() => {
    freshKeysRef.current.clear();
    setFreshKeys(new Set());
    setPlanted([]);
  }, []);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      const aspect = WINDOW.width / WINDOW.height;
      const result = await processPhoto(file, aspect);
      if (result.ok) await polaroid.setPhoto(result.blob);
      else setPhotoError(result.message);
    },
    [polaroid]
  );

  const [photoError, setPhotoError] = useState<string | null>(null);

  // Lenis + "never rest half-turned" snapping.
  useEffect(() => {
    if (reduced) return;

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      touchMultiplier: 1.4,
    });
    lenisRef.current = lenis;

    let rafId = 0;
    let lastVelocity = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      // Only publish velocity when it actually moves: writing a MotionValue every frame
      // wakes its subscribers (the petal layer) even at rest.
      if (Math.abs(lenis.velocity - lastVelocity) > 0.01) {
        lastVelocity = lenis.velocity;
        velocity.set(lenis.velocity);
      }
      rafId = window.requestAnimationFrame(raf);
    };
    rafId = window.requestAnimationFrame(raf);

    let idleTimer: number | undefined;

    const armIdleTimer = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      // A trackpad's inertia tail keeps emitting weak scroll events that fall below the
      // snap's own threshold; a longer idle while the wheel is still coasting avoids
      // fighting the reader's momentum (Plan 10 §B7).
      const idle = Math.abs(lenis.velocity) > 0.1 ? 220 : 150;
      idleTimer = window.setTimeout(() => {
        // A programmatic click-turn is running: do not fight it with a settle snap.
        if (performance.now() < snappingUntilRef.current) return;
        const targetProgress = settleTarget(scrollYProgress.get());
        const track = trackRef.current;
        if (targetProgress === null || !track) return;
        const rect = track.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const targetY = progressToScrollTop(targetProgress, top, rect.height, window.innerHeight);
        // While the snap animates, ignore scroll events that IT generates, but keep
        // re-arming the idle timer so a user scroll that interrupts the snap still
        // settles instead of leaving a leaf mid-air (symptom 3).
        snappingUntilRef.current = performance.now() + 1000;
        lenis.scrollTo(targetY, {
          duration: 0.6,
          // Ease OUT into the rest (a default ease-in-out starts slow, which reads as the
          // snap not having begun). `(t) => 1 − (1 − t)^3` decelerates into the boundary.
          easing: (t: number) => 1 - Math.pow(1 - t, 3),
          onComplete: () => {
            snappingUntilRef.current = 0;
          },
        });
      }, idle);
    };

    const onScroll = () => {
      armIdleTimer();
    };

    const offScroll = lenis.on("scroll", onScroll);

    return () => {
      offScroll();
      if (idleTimer) window.clearTimeout(idleTimer);
      window.cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
      velocity.set(0);
    };
  }, [reduced, scrollYProgress, velocity]);

  /**
   * Click-to-turn: jump instantly across the rest gap to the turn's near edge (nothing is
   * animated inside a rest window, so this is invisible), then animate across the turn.
   * A paper leaf turns in ~0.95 s (ease-in-out cubic); the cover/back board is heavier, so
   * ~1.15 s (ease-in-out quart). The leaf curl comes from `paperEase` on top. The settle
   * timer is suspended for the duration; at most ONE extra click is queued (a fast double
   * click turns two pages).
   */
  const turnPageImpl = useCallback(
    (dir: 1 | -1) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const top = rect.top + window.scrollY;

      if (reduced) {
        // Reduced motion: jump straight to the rest; the cross-fade handles the visuals.
        const scene = sceneAt(progress.get());
        const turn = turnFor(scene.spread, dir);
        if (!turn) return;
        const index = TURNS.findIndex((entry) => entry.id === turn.id);
        const targetSpread = dir === 1 ? turn.spreadAfter : spreadBefore(index);
        window.scrollTo({
          top: progressToScrollTop(
            restProgress(targetSpread),
            top,
            rect.height,
            window.innerHeight
          ),
          behavior: "auto",
        });
        return;
      }

      const lenis = lenisRef.current;
      if (!lenis) return;

      // A turn is already animating: queue at most one more, drop the rest.
      if (performance.now() < snappingUntilRef.current) {
        if (queuedTurnRef.current === null) queuedTurnRef.current = dir;
        return;
      }

      const scene = sceneAt(progress.get());
      const turn = turnFor(scene.spread, dir);
      if (!turn) return;

      const index = TURNS.findIndex((entry) => entry.id === turn.id);
      // Lands on the spread AFTER the turn going forward, the spread BEFORE it going back.
      const targetSpread = dir === 1 ? turn.spreadAfter : spreadBefore(index);
      const targetY = progressToScrollTop(
        restProgress(targetSpread),
        top,
        rect.height,
        window.innerHeight
      );

      const rigid = turn.id === "cover" || turn.id === "back";
      // Scrolling back up out of the letter: the book is faded out at the letter rest, so
      // jumping to the turn edge would pop it back in at full opacity. Animate from the
      // current progress instead so the back cover fades in, then turns.
      const backwardFromLetter = turn.id === "back" && dir === -1;
      const duration = backwardFromLetter ? 1.5 : rigid ? 1.15 : 0.95;
      const easing = rigid
        ? (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2)
        : (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

      // Jump instantly to the near edge of the turn (a rest window animates nothing) —
      // except when backing out of the letter, where the jump would pop the faded book in.
      if (!backwardFromLetter) {
        const nearEdge =
          dir === 1
            ? turn.segment.start + TURN_LANDED_EPSILON
            : turn.segment.end - TURN_LANDED_EPSILON;
        lenis.scrollTo(progressToScrollTop(nearEdge, top, rect.height, window.innerHeight), {
          immediate: true,
        });
      }

      snappingUntilRef.current = performance.now() + (duration + 0.25) * 1000;
      lenis.scrollTo(targetY, {
        duration,
        easing,
        force: true,
        onComplete: () => {
          snappingUntilRef.current = 0;
          const queued = queuedTurnRef.current;
          queuedTurnRef.current = null;
          if (queued !== null) turnPageRef.current(queued);
        },
      });
    },
    [reduced, progress]
  );

  // `useCallback` cannot reference itself for the queued double-click; a ref lets the
  // completion handler re-enter without stale-closure surprises.
  const turnPageRef = useRef(turnPageImpl);
  turnPageRef.current = turnPageImpl;

  const handleTurn = useCallback((dir: 1 | -1) => {
    setTurnedOnce(true);
    try {
      window.localStorage.setItem(TURN_HINT_KEY, "1");
    } catch {
      // Private mode: the hint just shows again next visit.
    }
    turnPageRef.current(dir);
  }, []);

  // Keyboard: left/right and PageUp/PageDown turn pages when focus is not in a form field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.closest("input, textarea, select, [contenteditable='true']")) return;
      let dir: 1 | -1 | null = null;
      if (event.key === "ArrowRight" || event.key === "PageDown") dir = 1;
      else if (event.key === "ArrowLeft" || event.key === "PageUp") dir = -1;
      if (dir === null) return;
      event.preventDefault();
      turnPageRef.current(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Scene state only changes at the boundaries, so React re-renders ~10 times per pass.
  // `arrivedRef` / `parcelAutoRef` mirror the state so we only call the setters when the
  // value actually changes (avoiding a setState schedule on every scroll frame).
  const arrivedRef = useRef<number | null>(0);
  const parcelAutoRef = useRef(false);
  useMotionValueEvent(progress, "change", (value) => {
    const next = sceneAt(value);
    setScene((previous) =>
      previous.spread === next.spread &&
      previous.turn === next.turn &&
      previous.letter === next.letter
        ? previous
        : next
    );
    // Arrival: the reader has settled on a spread (no leaf in the air).
    const arrived = next.turn === null ? next.spread : null;
    if (arrived !== arrivedRef.current) {
      arrivedRef.current = arrived;
      setArrivedSpread(arrived);
    }
    if (next.turn === null) arrivedEver.current.add(next.spread);
    // The parcel auto-opens only once the mail → florist turn is past its midpoint, so the
    // reader always gets the full rest window on the mail spread to tap the box open
    // themselves before scroll carries it away.
    const mailMid = (SEGMENTS.turnMail.start + SEGMENTS.turnMail.end) / 2;
    const auto = value >= mailMid && value < SEGMENTS.turnBack.start;
    if (auto !== parcelAutoRef.current) {
      parcelAutoRef.current = auto;
      setParcelAutoOpen(auto);
    }
  });

  // The plate intro plays once, on the FIRST arrival at spread 1. It must be marked DONE
  // only AFTER that arrival has rendered (so the arrival render still reads `intro` and the
  // drop/write-in actually plays); a `setTimeout(0)` commits after the current render and
  // then flips `plateRevealed`, so the reader can never see the intro a second time — not
  // on a re-arrival and not on a return from the cover.
  useEffect(() => {
    if (arrivedSpread !== SPREAD.plate) return;
    const id = window.setTimeout(() => setPlateRevealed(true), 0);
    return () => window.clearTimeout(id);
  }, [arrivedSpread]);

  // A page turn (or leaving the florist) deselects any bouquet head.
  useEffect(() => {
    setSelectedHead(null);
  }, [scene.turn, scene.spread, scene.letter]);

  // Paper sound at the halfway point of every leaf, in either direction.
  const previousProgress = useRef(0);
  useMotionValueEvent(progress, "change", (value) => {
    const previous = previousProgress.current;
    previousProgress.current = value;
    if (reduced) return;
    for (const turn of TURNS) {
      const middle = (turn.segment.start + turn.segment.end) / 2;
      if ((previous < middle && value >= middle) || (previous > middle && value <= middle)) {
        playSound("flip");
        break;
      }
    }
  });

  const chimed = useRef(false);
  useEffect(() => {
    if (!scene.letter) {
      chimed.current = false;
      return;
    }
    if (chimed.current) return;
    chimed.current = true;
    startMusic();
    playSound("chime");
  }, [scene.letter]);

  const handleName = useCallback((next: string) => {
    touchedName.current = true;
    setName(next);
  }, []);

  // No dead end: the parcel opens itself ONLY on the way out (while `parcelAutoOpen` is
  // true during the mail → florist turn), so a reader who scrolls past without tapping
  // still sees it open. The box is already turning away, so jump straight to `bloom` in ONE
  // state change — a 520 ms `setInterval` re-rendered the whole tree (and the six leaf
  // copies) several times on the exact frames the turn was moving (Plan 10 §B4).
  useEffect(() => {
    if (!parcelAutoOpen) return;
    forceParcelStep("bloom");
  }, [parcelAutoOpen, forceParcelStep]);

  // Announce the open once, for the aria-live region (state so the live region updates).
  useEffect(() => {
    if (parcelStep === "bloom") setParcelOpened(true);
  }, [parcelStep]);

  const handleRemoved = useCallback(() => {}, []);

  /**
   * Open the keepsake share dialog only once its off-screen card is fully paintable.
   * `ShareImageDialog` captures a clone of `#womans-day-keepsake`; if the route fonts
   * have not settled or a bouquet/sticker `<img>` is still decoding, the PNG can come
   * out with blank art. `elementToShareImage` awaits `document.fonts.ready` itself, but
   * decoding the card's own images here (with a per-image failure guard, so a missing
   * optional sticker never blocks the save) keeps the two captures in sync.
   */
  const handleSaveKeepsake = useCallback(async () => {
    try {
      await document.fonts?.ready;
    } catch {
      // Font loading API unavailable: proceed with whatever the browser has.
    }
    const card = document.getElementById(KEEPSAKE_ID);
    if (card) {
      const images = Array.from(card.querySelectorAll("img"));
      await Promise.all(
        images.map((image) =>
          image.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              })
        )
      );
    }
    setShareOpen(true);
  }, []);

  const sway = useTransform(velocity, (value) => Math.max(-2.4, Math.min(2.4, value * 0.02)));
  // The scrapbook sway is only worth driving while the scrapbook spread is the one at REST.
  // A hidden slot (or a leaf copy) sharing the live `sway` keeps writing a transform every
  // scroll frame for a page nobody can see (Plan 10 §B3). A constant MotionValue means no
  // subscriber wakes.
  const zeroSway = useMotionValue(0);
  const scrapbookSway = scene.spread === SPREAD.scrapbook && scene.turn === null ? sway : zeroSway;
  const letterOpacity = useTransform(
    progress,
    [SEGMENTS.letterReveal.start, SEGMENTS.letterReveal.end],
    [0, 1],
    { clamp: true }
  );
  const hintOpacity = useTransform(
    progress,
    [SEGMENTS.bloomGrow.start, SEGMENTS.bloomGrow.end],
    [1, 0],
    { clamp: true }
  );

  // The hint lives only before the book opens: once a leaf is mid-air or the first spread
  // is on the table it is unmounted, so no timeline bug can ever bring it back (symptom 2).
  const hintVisible = !scene.letter && scene.turn === null && scene.spread === SPREAD.cover;

  // The parcel stays SEALED while the reader is on the mail spread, so every visit they
  // can tap through the unboxing themselves. `parcelAutoOpen` (set in the scene listener)
  // only becomes true once the mail → florist turn is past its midpoint, so a reader who
  // scrolls on without tapping is still carried off with an open box.

  const renderPage: PageRenderer = useCallback(
    (spread, side, ctx) => {
      // `active` drives the spread's entry/reveal animations. It is true only once the reader
      // has SETTLED on this spread (`ctx.arrived`) and this is not a leaf copy — so content
      // never animates mid-air in the turning leaf, and re-arriving from the other direction
      // re-plays the reveal once (scene-based, not mount-based).
      // `active` drives the spread's reveal animations. It is true once the reader has
      // EVER settled on this spread (not just the first time), so:
      //   - a leaf copy is always final (`variant="leaf"`), it never animates mid-air;
      //   - re-arriving from the other direction does not replay the drop/write-in;
      //   - leaving does not animate content back out (the "disappears then pops up" report).
      // The first arrival still animates because `arrivedEver` gains the spread on that frame.
      const leaf = ctx.variant === "leaf";
      const active = !leaf && arrivedEver.current.has(spread);
      // The plate spread (spread 1) takes `{ variant, reveal }` instead of `active`: a leaf
      // copy and reduced motion are always `final` (pixel-identical, no motion). The `intro`
      // is gated on the reader ACTUALLY ARRIVING for the first time (`ctx.arrived` = settled
      // on this spread) AND the intro not yet done — so the spread (mounted for the whole
      // session, hidden) does NOT play its reveal at page load, but does play it on arrival.
      // Every later render (re-arrival, departure, leaf) is `final`, and nothing here can
      // animate to a hidden pose.
      const plateReveal: PlateReveal =
        leaf || reduced ? "final" : ctx.arrived && !plateRevealed ? "intro" : "final";

      if (mobile) {
        switch (spread) {
          case SPREAD.cover:
            return <CoverPage name={name} onNameChange={handleName} />;
          case SPREAD.plate:
            return (
              <PlateMobilePage
                flower={flower}
                reveal={plateReveal}
                readerName={displayName}
                tracking={tracking}
              />
            );
          case SPREAD.scrapbook:
            return <ScrapbookMobilePage sway={scrapbookSway} />;
          case SPREAD.garden:
            return (
              <GardenMobilePage
                flower={flower}
                planted={planted}
                freshKeys={freshKeys}
                onPlant={handlePlant}
                onClear={ctx.variant === "page" ? handleClearGarden : undefined}
                polaroid={polaroid.state}
                polaroidDispatch={polaroid.dispatch}
                onPickFile={handlePickFile}
                onScratchSound={() => playSound("scratch")}
                reduced={reduced}
                variant={ctx.variant}
              />
            );
          case SPREAD.mail:
            return (
              <MailMobilePage
                flower={flower}
                name={displayName}
                tracking={tracking}
                burst={burst}
                step={parcelStep}
                onTap={advanceParcel}
              />
            );
          case SPREAD.florist:
            return (
              <FloristMobilePage
                bouquet={bouquet}
                dispatch={dispatch}
                flower={flower}
                reduced={reduced}
                arrived={ctx.arrived}
                variant={ctx.variant}
                onRemoved={handleRemoved}
                selectedKey={selectedHead}
                onSelect={setSelectedHead}
              />
            );
          default:
            return null;
        }
      }

      if (side === "left") {
        switch (spread) {
          case SPREAD.plate:
            return (
              <PlatePage
                flower={flower}
                reveal={plateReveal}
                readerName={displayName}
                tracking={tracking}
              />
            );
          case SPREAD.scrapbook:
            return <ScrapbookLeftPage sway={scrapbookSway} />;
          case SPREAD.garden:
            return (
              <PolaroidPage
                flower={flower}
                polaroid={polaroid.state}
                polaroidDispatch={polaroid.dispatch}
                onPickFile={handlePickFile}
                onScratchSound={() => playSound("scratch")}
                reduced={reduced}
                variant={ctx.variant}
              />
            );
          case SPREAD.mail:
            return <MailNotePage flower={flower} name={displayName} tracking={tracking} />;
          case SPREAD.florist:
            return (
              <FloristShelfPage
                bouquet={bouquet}
                dispatch={dispatch}
                flower={flower}
                onRemoved={handleRemoved}
              />
            );
          default:
            return null;
        }
      }

      switch (spread) {
        case SPREAD.cover:
          return <CoverPage name={name} onNameChange={handleName} />;
        case SPREAD.plate:
          return <ReadingPage flower={flower} reveal={plateReveal} readerName={displayName} />;
        case SPREAD.scrapbook:
          return <ScrapbookRightPage sway={scrapbookSway} />;
        case SPREAD.garden:
          return (
            <GardenPage
              flower={flower}
              planted={planted}
              freshKeys={freshKeys}
              onPlant={handlePlant}
              onClear={ctx.variant === "page" ? handleClearGarden : undefined}
              variant={ctx.variant}
            />
          );
        case SPREAD.mail:
          return (
            <MailParcelPage
              flower={flower}
              name={displayName}
              tracking={tracking}
              burst={burst}
              step={parcelStep}
              onTap={advanceParcel}
            />
          );
        case SPREAD.florist:
          return (
            <FloristBouquetPage
              bouquet={bouquet}
              dispatch={dispatch}
              flower={flower}
              reduced={reduced}
              arrived={ctx.arrived}
              variant={ctx.variant}
              onRemoved={handleRemoved}
              selectedKey={selectedHead}
              onSelect={setSelectedHead}
            />
          );
        default:
          return null;
      }
    },
    [
      mobile,
      reduced,
      plateRevealed,
      name,
      handleName,
      flower,
      displayName,
      tracking,
      scrapbookSway,
      burst,
      parcelStep,
      advanceParcel,
      bouquet,
      dispatch,
      handleRemoved,
      selectedHead,
      planted,
      freshKeys,
      handlePlant,
      handleClearGarden,
      handlePickFile,
      polaroid,
    ]
  );

  return (
    <main data-womans-day className="relative min-h-dvh overflow-x-clip">
      <div ref={trackRef} className="relative" style={{ height: `${SCROLL_SCREENS * 100}dvh` }}>
        <div className="sticky top-0 h-dvh overflow-hidden">
          <FlowerWall progress={progress} velocity={velocity} reduced={reduced} mobile={mobile} />

          <motion.div
            className="absolute inset-0 z-10"
            style={{
              opacity: letterOpacity,
              pointerEvents: scene.letter ? "auto" : "none",
            }}
          >
            <LetterScene
              name={displayName}
              flower={flower}
              visible={scene.letter}
              reduced={reduced}
              onSave={handleSaveKeepsake}
            />
          </motion.div>

          <div
            className="absolute inset-0 z-20"
            style={{ pointerEvents: scene.letter ? "none" : "auto" }}
          >
            <Textbook
              progress={progress}
              reduced={reduced}
              mobile={mobile}
              spread={scene.spread}
              turn={scene.turn}
              letter={scene.letter}
              arrivedSpread={scene.letter ? null : arrivedSpread}
              renderPage={renderPage}
              onTurn={handleTurn}
            />
            {/* Screen-reader page-turn controls (visually hidden, but real buttons). */}
            {!scene.letter ? (
              <div className="sr-only">
                <button type="button" onClick={() => handleTurn(-1)}>
                  Previous page
                </button>
                <button type="button" onClick={() => handleTurn(1)}>
                  Next page
                </button>
              </div>
            ) : null}
          </div>

          {/* First-visit hint: once the book is open and only until the first click-turn. */}
          {!scene.letter && !turnedOnce && scene.turn === null && scene.spread >= SPREAD.plate ? (
            <div className="pointer-events-none absolute bottom-[9%] left-1/2 z-30 -translate-x-1/2">
              <p className="font-[family-name:var(--font-note)] text-[clamp(11px,1.2vw,15px)] text-[#5b4636]/80">
                {mobile ? "tap the page edge to turn" : "click the page edge to turn"}
              </p>
            </div>
          ) : null}

          <motion.div
            style={{ opacity: hintOpacity }}
            aria-hidden={!hintVisible}
            className={`pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center text-center ${
              hintVisible ? "" : "hidden"
            }`}
          >
            <Sticker
              name="envelope-sealed"
              className="relative w-[clamp(84px,10vw,132px)] -rotate-3 drop-shadow-[0_10px_18px_rgba(80,55,35,0.18)]"
            />
            <p className="mt-5 font-[family-name:var(--font-book)] text-[clamp(20px,2.4vw,30px)] italic text-[#5b4636]">
              Scroll to bloom
            </p>
            <p className="mt-1.5 font-[family-name:var(--font-type)] text-[clamp(9px,0.9vw,11px)] tracking-[0.26em] text-[#8a745c]">
              {WOMANS_DAY_SHORT}
            </p>
          </motion.div>

          <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
            <span className="hidden font-[family-name:var(--font-type)] text-[10px] tracking-[0.22em] text-[#8a745c] sm:block">
              20.10
            </span>
            <button
              type="button"
              onClick={() => toggleSound()}
              aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
              aria-pressed={soundOn}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#8a6a4c]/35 bg-[#f7efdf]/85 text-[#5b4636] backdrop-blur-none transition-colors hover:bg-[#efe3cd] focus-visible:ring-2 focus-visible:ring-[#b0566b]"
            >
              {soundOn ? (
                <Volume2 aria-hidden className="h-4 w-4" />
              ) : (
                <VolumeX aria-hidden className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* The stage footer belongs to the book scenes. When the letter takes over it is
              unmounted: otherwise it sits above the letter layer (z-30 > z-10) and lands on
              top of the letter's own footer / actions card on short viewports. The letter
              keeps its own footer at the end of its scroll column. */}
          {!scene.letter ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-2 text-[#8a745c] md:flex">
              <Art src="/womans-day/stickers/washi-beige.webp" className="h-2 w-10 opacity-70" />
              <span className="font-[family-name:var(--font-type)] text-[9px] tracking-[0.22em]">
                Ronan SAT Workbook · Special Edition
              </span>
              <Art src="/womans-day/stickers/washi-beige.webp" className="h-2 w-10 opacity-70" />
            </div>
          ) : null}
        </div>
      </div>

      <KeepsakeCard name={displayName} flower={flower} bouquet={bouquet} tracking={tracking} />

      {/* The polaroid photo picker: local-only, never uploaded (the file is processed to a
          small WebP blob and kept in IndexedDB). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          void handleFile(file);
        }}
      />

      {shareOpen ? (
        <ShareImageDialog
          captureTargetId={KEEPSAKE_ID}
          captureOptions={KEEPSAKE_CAPTURE}
          fileName="ronan-sat-womens-day.png"
          shareTitle="A Women's Day keepsake from Ronan SAT"
          onClose={() => setShareOpen(false)}
        />
      ) : null}

      <span className="sr-only" aria-live="polite">
        {parcelOpened ? "Parcel opened." : ""}
        {photoError ? ` ${photoError}` : ""}
      </span>
    </main>
  );
}
