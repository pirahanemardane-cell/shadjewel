"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Confirmed homepage hero H1 — keep exact. */
export const HERO_H1 = "شیک، ظریف، ماندگار";

const PROBE_PX = 100;
const MIN_PX = 18;
/** Horizontal inset matches prior hero (`px-6`) so type never kisses the viewport edge. */
const PAD_CLASS = "px-6";

/**
 * Largest font-size (px) that keeps `scrollWidth` ≤ `available` at the probe ratio,
 * then nudges so +~1px would overflow. Pure for tests.
 */
export function fitOneLineFontPx(
  availablePx: number,
  scrollWidthAtProbe: number,
  probePx = PROBE_PX,
): number {
  if (availablePx <= 0 || scrollWidthAtProbe <= 0 || probePx <= 0) return MIN_PX;
  const raw = availablePx * (probePx / scrollWidthAtProbe);
  return Math.max(MIN_PX, Math.floor(raw * 10) / 10);
}

/**
 * Primary homepage headline above the polaroid slider.
 * Heavy (900) IRANYekanX; fluid one-line fit via ResizeObserver (same idea as footer wordmark).
 */
export function HeroHeadline({ className }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const [fontPx, setFontPx] = useState<number | null>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return;

    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const styles = getComputedStyle(wrap);
      const padX =
        (Number.parseFloat(styles.paddingLeft) || 0) +
        (Number.parseFloat(styles.paddingRight) || 0);
      const available = Math.max(0, wrap.clientWidth - padX);

      // `w-max` keeps scrollWidth = glyph width (block full-width would mask underfill).
      text.style.fontSize = `${PROBE_PX}px`;
      const needed = text.scrollWidth;
      let next = fitOneLineFontPx(available, needed, PROBE_PX);

      text.style.fontSize = `${next}px`;
      // Nudge down if subpixel/hinting overflowed.
      while (text.scrollWidth > available && next > MIN_PX) {
        next = Math.round((next - 0.5) * 10) / 10;
        text.style.fontSize = `${next}px`;
      }
      // Nudge up until one more step would overflow (~1px-at-max rule).
      while (next < 400) {
        text.style.fontSize = `${next + 0.5}px`;
        if (text.scrollWidth > available) {
          text.style.fontSize = `${next}px`;
          break;
        }
        next = Math.round((next + 0.5) * 10) / 10;
      }

      setFontPx((prev) => (prev === next ? prev : next));
    };

    const run = () => {
      measure();
      // Re-measure after Heavy face swaps in (swap/display).
      if (typeof document !== "undefined" && document.fonts?.ready) {
        void document.fonts.ready.then(() => {
          if (!cancelled) measure();
        });
      }
    };

    run();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(wrap);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      // flex + justify-center: true visual center on RTL (avoids mx-auto drift).
      className={["flex w-full justify-center", PAD_CLASS, className]
        .filter(Boolean)
        .join(" ")}
      data-hero-h1-fit={fontPx != null ? "1" : "0"}
    >
      <h1
        ref={textRef}
        className="w-max max-w-full font-black text-primary whitespace-nowrap text-center tracking-tight"
        style={{
          // SSR / pre-measure: short phrase — generous fluid clamp, then JS max-fits.
          fontSize: fontPx != null ? `${fontPx}px` : "clamp(1.75rem, 9vw, 4.5rem)",
          // Beat global `h1 { line-height: 2.5rem }` (fixed rem) so ink doesn't overflow into the polaroid.
          lineHeight: 1.15,
        }}
      >
        {HERO_H1}
      </h1>
    </div>
  );
}
