/** نام رنگ رایج فارسی/انگلیسی → hex.
 * رنگ‌های منتشرشده از روی عکس واقعی محصول نمونه‌برداری شده‌اند.
 * واریانت‌های زنده color_name دارند و color_hex خالی است؛ این نقشه همان مسیر فروشگاه است.
 */
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function colorKey(raw: string): string {
 return raw.replace(/\u200c/g, "").replace(/\s+/g, "").toLowerCase();
}

/** بدنه نارنجی فانتا و آبستره طرح‌دار — از پیکسل‌های اشباع عکس. */
const FANTA_ORANGE = "#E83F0C";
const INK_BLACK = "#111111";
/** قلاب مشکی بالا، بدنه نارنجی پایین — نه میانگین دو رنگ. */
const BLACK_ORANGE_SWATCH = `linear-gradient(to bottom, ${INK_BLACK} 38%, ${FANTA_ORANGE} 38%)`;

const SPLIT_KEYS = new Set([
 "مشکینارنجی",
 "آبسترهطرحدارمشکینارنجی",
]);

export function resolveColorHex(
 nameOrHex: string | null | undefined,
 explicitHex?: string | null,
): string {
 const hex = (explicitHex || "").trim();
 if (HEX.test(hex)) return hex;
 const raw = (nameOrHex || "").trim();
 if (HEX.test(raw)) return raw;
 if (raw.startsWith("linear-gradient(")) return raw;
 const key = colorKey(raw);
 if (SPLIT_KEYS.has(key)) return FANTA_ORANGE;
 const map: Record<string, string> = {
 سفید: "#FFFFFF",
 سفیدکرم: "#F5F0E6",
 طنابسفید: "#FFFFFF",
 مشکی: "#111111",
 سیاه: "#111111",
 آبی: "#5B8FA8",
 آبیرون: "#5B8FA8",
 آبیروشن: "#A8C5D4",
 آبیتیره: "#1E3A5F",
 سرمه‌ای: "#1B2A4A",
 سرمه: "#1B2A4A",
 خاکستری: "#9CA3AF",
 طوسی: "#6B7280",
 قرمز: "#C41E3A",
 سبز: "#2D6A4F",
 زرد: "#EAB308",
 بژ: "#D4C4A8",
 کرم: "#F5E6C8",
 قهوه‌ای: "#6B4423",
 قهوه: "#6B4423",
 نارنجی: FANTA_ORANGE,
 فانتانارنجی: FANTA_ORANGE,
 صورتی: "#EC4899",
 سرخابی: "#C0489C",
 مجنتا: "#C0489C",
 مجنتاسرخابی: "#C0489C",
 بنفش: "#7C3AED",
 یاسی: "#A878CC",
 یاسیاسی: "#A878CC",
 زرشکی: "#4A1C22",
 آبسترهستارهزرشکی: "#4A1C22",
 طلایی: "#D4AF37",
 نقره‌ای: "#C0C0C0",
 white: "#FFFFFF",
 black: "#111111",
 blue: "#5B8FA8",
 red: "#C41E3A",
 green: "#2D6A4F",
 gray: "#9CA3AF",
 grey: "#9CA3AF",
 navy: "#1B2A4A",
 beige: "#D4C4A8",
 };
 return map[key] || map[raw] || "#E5E7EB";
}

/** رنگ نقاشی سواچ. هگز صریح مقدم است؛ وگرنه نام‌های دو رنگ به‌صورت دونیمه. */
export function resolveSwatchColor(
 nameOrHex: string | null | undefined,
 explicitHex?: string | null,
): string {
 const hex = (explicitHex || "").trim();
 if (HEX.test(hex)) return hex;
 const raw = (nameOrHex || "").trim();
 if (raw.startsWith("linear-gradient(")) return raw;
 if (SPLIT_KEYS.has(colorKey(raw))) return BLACK_ORANGE_SWATCH;
 return resolveColorHex(nameOrHex, explicitHex);
}

/** برچسب قابل‌خواندن؛ مقدار دونیمه همان نام رنگ می‌ماند. */
export function swatchLabel(color: string | null | undefined): string {
 const raw = (color || "").trim();
 if (raw === BLACK_ORANGE_SWATCH) return "مشکی نارنجی";
 return raw;
}
