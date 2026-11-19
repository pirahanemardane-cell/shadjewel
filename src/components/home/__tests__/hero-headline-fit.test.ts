import { describe, expect, it } from "vitest";
import { fitOneLineFontPx } from "@/components/home/hero-headline";

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
});
