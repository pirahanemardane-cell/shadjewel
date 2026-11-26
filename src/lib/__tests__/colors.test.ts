import { describe, expect, it } from "vitest";
import { resolveColorHex, resolveSwatchColor, swatchLabel } from "@/lib/colors";

describe("published product swatches", () => {
 it("maps live color names to the sampled product colors", () => {
 expect(resolveSwatchColor("سرخابی")).toBe("#C0489C");
 expect(resolveSwatchColor("مجنتا سرخابی")).toBe("#C0489C");
 expect(resolveSwatchColor("نارنجی")).toBe("#E83F0C");
 expect(resolveSwatchColor("فانتا نارنجی")).toBe("#E83F0C");
 expect(resolveSwatchColor("یاسی")).toBe("#A878CC");
 expect(resolveSwatchColor("یاس یاسی")).toBe("#A878CC");
 expect(resolveSwatchColor("زرشکی")).toBe("#4A1C22");
 expect(resolveSwatchColor("آبستره ستاره زرشکی")).toBe("#4A1C22");
 expect(resolveSwatchColor("سفید")).toBe("#FFFFFF");
 expect(resolveSwatchColor("طناب سفید")).toBe("#FFFFFF");
 });

 it("paints مشکی نارنجی as both real colors, not a blend or the gray fallback", () => {
 const paint = resolveSwatchColor("مشکی نارنجی");
 expect(paint).toContain("#111111");
 expect(paint).toContain("#E83F0C");
 expect(paint.startsWith("linear-gradient")).toBe(true);
 expect(paint).not.toBe("#E5E7EB");
 const withZwnj = resolveSwatchColor("آبستره طرح\u200cدار مشکی نارنجی");
 expect(withZwnj).toBe(paint);
 expect(swatchLabel(paint)).toBe("مشکی نارنجی");
 });

 it("keeps a real hex for admin saves of the two-tone name", () => {
 expect(resolveColorHex("مشکی نارنجی")).toBe("#E83F0C");
 expect(resolveColorHex("مشکی نارنجی").startsWith("#")).toBe(true);
 });

 it("prefers an explicit catalog hex over the name", () => {
 expect(resolveSwatchColor("سرخابی", "#112233")).toBe("#112233");
 expect(resolveSwatchColor("مشکی نارنجی", "#112233")).toBe("#112233");
 });

 it("still falls back when the name is unknown", () => {
 expect(resolveColorHex("رنگ‌ناشناخته")).toBe("#E5E7EB");
 });
});
