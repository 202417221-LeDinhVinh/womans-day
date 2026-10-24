"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

/**
 * The app's single-select PILL TOGGLE, as one component.
 *
 * The style is not new — it is the reference treatment recorded in
 * `memory/0.3/151-pill-toggle-style-consistency.md` and set by the About You page's
 * Notes/Memory-graph switch: a `bg-surface-white` container with a hairline border and
 * `p-1`, the active option filled `bg-brand-tint` with a `border-brand` hairline, the
 * inactive ones transparent and `text-ink-muted`. Three separate screens had
 * hand-rolled it (nav rail Menu/Chat, the Verbal/Math chart tabs, the About You
 * original) and one of them had already drifted to a heavier solid `bg-brand`, which is
 * what that memory note was written to repair. A fourth hand-rolled copy for the sets
 * library would have restarted the drift, so the style lives here now and new call
 * sites take it by using this component.
 *
 * The moving part is a framer-motion `layoutId` HIGHLIGHT rather than a per-button
 * background: one shared element slides from the old option to the new one, so
 * switching filters reads as one control changing state instead of two independent
 * fades. `useReducedMotion` disables the slide (the highlight still moves, it just
 * arrives instantly), because a travelling element is exactly what that preference is
 * about.
 *
 * SUB-OPTIONS (2026-09-03). An option may carry its own `options`, which are revealed
 * INSIDE the control — in a recessed well next to their parent — while that branch is
 * selected, and removed when it is not. The parent pill stays visible and stays clickable
 * as the branch's own "no narrowing" state, so the control never replaces what the student
 * was looking at; it grows. This is the /practice feed's
 * `All | [Practice · [SAT · [Digital · Paper]] · IELTS] | Learn`.
 *
 * Nesting is RECURSIVE and depth is the caller's business. It is still ONE selection at
 * any depth — the highlight glides from `SAT` to `Paper` exactly as it glides from `All`
 * to `Practice` — because there is only ever one selected value in this control. What
 * depth costs is horizontal room and a reader's patience, not code: pick the levels
 * because the axis really is hierarchical (exam family -> exam format), not because the
 * component allows it.
 *
 * Generic over the value type so a caller keeps its own string union and gets an
 * exhaustive check rather than passing raw strings around.
 */
export type PillToggleOption<T extends string> = {
  value: T;
  label: string;
  /** Optional leading glyph (Appearance: Monitor / Sun / Moon). */
  icon?: LucideIcon;
  /**
   * Narrowings of this option, shown only while this branch is selected. Selecting the
   * parent again clears the narrowing, which is why the parent is not itself listed here.
   */
  options?: readonly PillToggleOption<T>[];
};

const PILL_CLASS =
  // `relative` + `isolate`: the highlight is an absolutely positioned sibling
  // of the label INSIDE the button, so the label always paints over it.
  "relative isolate inline-flex h-7 items-center gap-1.5 rounded-[var(--ui-radius-sm)] px-3 text-xs font-semibold transition-colors workbook-press";

/** Is `value` this option, or anywhere inside it? */
function branchHolds<T extends string>(option: PillToggleOption<T>, value: T): boolean {
  if (option.value === value) return true;
  return (option.options ?? []).some((child) => branchHolds(child, value));
}

export function PillToggleGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  /**
   * Unique per mounted group. `layoutId` is GLOBAL in framer-motion: two groups on one
   * screen sharing an id would make their highlights fly across the page into each
   * other.
   */
  layoutIdPrefix,
  className = "",
}: {
  options: readonly PillToggleOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  layoutIdPrefix: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const highlightTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };
  // Reveal/collapse of sub-options. A touch slower than the highlight, so the pills
  // settle just after it lands rather than moving underneath it.
  const revealTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const };
  // EVERY box between the shell and a pill is layout-animated. framer fakes a size
  // change with a transform, so a child that is not itself layout-animated visibly
  // stretches while its parent resizes; and it is what makes the pills AFTER an
  // expanding group glide sideways instead of jumping a frame.
  const layout = !reduceMotion;

  const renderPill = (option: PillToggleOption<T>) => {
    const active = option.value === value;
    return (
      <motion.button
        layout={layout}
        transition={revealTransition}
        type="button"
        onClick={() => onChange(option.value)}
        aria-pressed={active}
        className={`${PILL_CLASS} ${active ? "text-ink-fg" : "text-ink-muted hover:text-ink-fg"}`}
      >
        {active ? (
          <motion.span
            aria-hidden
            layoutId={`${layoutIdPrefix}-pill-toggle-highlight`}
            transition={highlightTransition}
            className="absolute inset-0 -z-10 rounded-[var(--ui-radius-sm)] border border-brand bg-brand-tint"
          />
        ) : null}
        {option.icon ? <option.icon aria-hidden className="h-3.5 w-3.5" /> : null}
        {option.label}
      </motion.button>
    );
  };

  // One option, plus its branch if it has one. `depth` is 0 for the shell's own row.
  const renderOption = (option: PillToggleOption<T>, depth: number) => {
    const subOptions = option.options ?? [];
    if (subOptions.length === 0) {
      return (
        <span key={option.value} className="inline-flex">
          {renderPill(option)}
        </span>
      );
    }

    const branchOpen = branchHolds(option, value);

    return (
      <motion.div
        key={option.value}
        layout={layout}
        transition={revealTransition}
        role="group"
        aria-label={`${option.label} filters`}
        // DEPTH BY ALTERNATION, not by stacking borders. A well is the surface its parent
        // is NOT — `bg-paper-bg` inside the white shell, white again inside that — so a
        // group nested inside a group is still legible, while a second hairline per level
        // would read as three separate controls in a row.
        //
        // HORIZONTAL PADDING ONLY (`px-1`, never `p-1`). Vertical padding here would make
        // the control's height a function of how deep the student has drilled: 2px per
        // side per level, so the whole pill row — and the page below it — grew a few pixels
        // taller the moment `SAT` was clicked and again for `Digital`. With `py-0` the
        // height is 2px border + 8px shell padding + the 28px pill at EVERY depth, and the
        // well reads as a horizontal groove flush with the pills it holds (which is also
        // what the reference control does).
        className={`inline-flex items-center gap-1 rounded-[var(--ui-radius-sm)] px-1 transition-colors ${
          branchOpen ? (depth % 2 === 0 ? "bg-paper-bg" : "bg-surface-white") : "bg-transparent"
        }`}
      >
        {renderPill(option)}
        {/* NO `AnimatePresence`. An exit animation here left GHOST PILLS behind: the
            collapse has to shrink the group, so the sub-pills were being animated out
            (`mode="popLayout"` pulls an exiting child out of flow and paints it
            absolutely) at the same moment the layout animation was moving the real pills
            over the same ground — two "SAT"s on screen for a quarter second. So a
            sub-pill LEAVES instantly and the shrink is carried entirely by the layout
            animation, which has one copy of everything by construction. The enter
            animation needs no presence wrapper — it is a mount. */}
        {branchOpen
          ? subOptions.map((child) => (
              <motion.div
                key={child.value}
                layout={layout}
                initial={reduceMotion ? false : { opacity: 0, scale: 0.85, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={revealTransition}
                className="inline-flex"
              >
                {renderOption(child, depth + 1)}
              </motion.div>
            ))
          : null}
      </motion.div>
    );
  };

  return (
    <motion.div
      layout={layout}
      transition={revealTransition}
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1 rounded-[var(--ui-radius)] border border-border bg-surface-white p-1 ${className}`}
    >
      {options.map((option) => renderOption(option, 0))}
    </motion.div>
  );
}
