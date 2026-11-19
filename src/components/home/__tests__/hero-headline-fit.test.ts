import { describe, expect, it } from "vitest";
import { fitOneLineFontPx, HERO_H1_FIT_SCALE } from "@/components/home/hero-headline";

describe("fitOneLineFontPx", () => {
  it("scales probe width to fill available", () => {
    // At 100px, text is 500px wide → available 250 → 50px
    expect(fitOneLineFontPx(250, 500, 100)).toBe(50);
  });

  it("floors to one decimal", () => {
    expect(fitOneLineFontPx(333, 500, 100)).toBe(66.6);
  });

  it("respects minimum", () => {
    expect(fitOneLineFontPx(10, 500, 100)).toBe(18);
  });

  it("guards invalid inputs", () => {
    expect(fitOneLineFontPx(0, 500, 100)).toBe(18);
    expect(fitOneLineFontPx(250, 0, 100)).toBe(18);
  });

  it("render scale is 90% of max fit", () => {
    expect(HERO_H1_FIT_SCALE).toBe(0.9);
    expect(Math.floor(fitOneLineFontPx(250, 500, 100) * HERO_H1_FIT_SCALE * 10) / 10).toBe(45);
  });
});
