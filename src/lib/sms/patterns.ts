/**
 * رجیستری پترن‌های ملی‌پیامک
 * bodyId از env: MELIPAYAMAK_BODY_<KEY>
 */

export type SmsPatternKey =
 | "OTP_REGISTER"
 | "OTP_LOGIN"
 | "OTP_RECOVERY"
 | "SECURITY_PHONE_CHANGE"
 | "SECURITY_PASSWORD_CHANGE"
 | "SECURITY_SUSPICIOUS_LOGIN"
 | "ORDER_NEW_ADMIN"
 | "ORDER_PLACED"
 | "ORDER_CONFIRMED"
 | "ORDER_CANCELLED"
 | "ORDER_REMINDER_ADMIN"
 | "ORDER_DEADLINE_ADMIN"
 | "PAYMENT_SUCCESS"
 | "PAYMENT_FAILED"
 | "PAYMENT_REVERSED"
 | "SHIPPED"
 | "TRACKING_CODE"
 | "SHIP_DELAY"
 | "DELIVERY_FAILED"
 | "SELLER_PAYOUT_PROCESSING"
 | "SELLER_PAYOUT_SUCCESS"
 | "SELLER_PAYOUT_FAILED"
 | "SELLER_BANK_CHANGED"
 | "RETURN_REQUESTED_ADMIN"
 | "RETURN_DECISION"
 | "RETURN_RECEIVED"
 | "REFUND_REQUESTED"
 | "REFUND_APPROVED"
 | "REFUND_DONE"
 | "REFUND_FAILED"
 | "DISPUTE_OPENED"
 | "DISPUTE_ACTION_NEEDED"
 | "DISPUTE_RESULT"
 | "ADMIN_CRITICAL"
 | "ADMIN_FRAUD"
 | "ADMIN_PAYMENT_OUTAGE"
 | "ADMIN_SMS_OUTAGE"
 | "STOCK_ALERT"
 | "PRICE_ALERT";

export type PatternDef = {
 key: SmsPatternKey;
 envKey: string;
 arity: number;
 panelText: string;
 priority: "required" | "recommended";
};

function p(
 key: SmsPatternKey,
 arity: number,
 panelText: string,
 priority: "required" | "recommended" = "required",
): PatternDef {
 return { key, envKey: `MELIPAYAMAK_BODY_${key}`, arity, panelText, priority };
}

/** Approved Melipayamak OTP body (pattern 592258): one var = verification code only. */
export const OTP_PANEL_TEXT =
 "کد تأیید شما در اکسسوری شاد: {0} میباشد. https://shadjewel.ir/";

const OTP_KEYS = new Set<SmsPatternKey>(["OTP_REGISTER", "OTP_LOGIN", "OTP_RECOVERY"]);

export const SMS_PATTERNS: Record<SmsPatternKey, PatternDef> = {
 // Login / signup / OTP recovery share one approved single-variable template.
 OTP_REGISTER: p("OTP_REGISTER", 1, OTP_PANEL_TEXT),
 OTP_LOGIN: p("OTP_LOGIN", 1, OTP_PANEL_TEXT),
 OTP_RECOVERY: p("OTP_RECOVERY", 1, OTP_PANEL_TEXT),
 SECURITY_PHONE_CHANGE: p("SECURITY_PHONE_CHANGE", 2, "{0} عزیز شماره موبایل حساب شما در اکسسوری شاد به {1} تغییر یافت. اگر شما نبودید فوراً با پشتیبانی تماس بگیرید. https://shadjewel.ir لغو11"),
 SECURITY_PASSWORD_CHANGE: p("SECURITY_PASSWORD_CHANGE", 1, "{0} عزیز رمز عبور حساب شما در اکسسوری شاد با موفقیت تغییر کرد. اگر شما نبودید فوراً اقدام کنید. https://shadjewel.ir لغو11"),
 SECURITY_SUSPICIOUS_LOGIN: p("SECURITY_SUSPICIOUS_LOGIN", 2, "{0} عزیز ورود جدید از دستگاه/IP مشکوک به حساب اکسسوری شاد شما ثبت شد. زمان: {1} https://shadjewel.ir لغو11", "recommended"),
 ORDER_NEW_ADMIN: p("ORDER_NEW_ADMIN", 3, "{0} عزیز سفارش جدید شماره {1} به مبلغ {2} تومان در اکسسوری شاد ثبت شد. لطفاً بررسی کنید. https://shadjewel.ir لغو11"),
 ORDER_PLACED: p("ORDER_PLACED", 3, "{0} عزیز سفارش شما با شماره {1} در اکسسوری شاد با موفقیت ثبت شد. مبلغ: {2} تومان https://shadjewel.ir لغو11", "recommended"),
 ORDER_CONFIRMED: p("ORDER_CONFIRMED", 2, "{0} عزیز سفارش {1} شما در اکسسوری شاد تأیید شد و در حال آماده‌سازی است. https://shadjewel.ir لغو11"),
 ORDER_CANCELLED: p("ORDER_CANCELLED", 4, "{0} عزیز سفارش {1} شما در اکسسوری شاد {2} شد. دلیل: {3} https://shadjewel.ir لغو11"),
 ORDER_REMINDER_ADMIN: p("ORDER_REMINDER_ADMIN", 2, "{0} عزیز سفارش {1} در اکسسوری شاد هنوز اقدام نشده است. لطفاً بررسی کنید. https://shadjewel.ir لغو11", "recommended"),
 ORDER_DEADLINE_ADMIN: p("ORDER_DEADLINE_ADMIN", 3, "{0} عزیز Deadline پردازش سفارش {1} در اکسسوری شاد نزدیک است ({2}). https://shadjewel.ir لغو11", "recommended"),
 PAYMENT_SUCCESS: p("PAYMENT_SUCCESS", 3, "{0} عزیز پرداخت سفارش {1} به مبلغ {2} تومان در اکسسوری شاد با موفقیت انجام شد. https://shadjewel.ir لغو11"),
 PAYMENT_FAILED: p("PAYMENT_FAILED", 2, "{0} عزیز پرداخت سفارش {1} در اکسسوری شاد ناموفق بود. لطفاً مجدداً تلاش کنید. https://shadjewel.ir لغو11"),
 PAYMENT_REVERSED: p("PAYMENT_REVERSED", 3, "{0} عزیز مبلغ {1} تومان از سفارش {2} در اکسسوری شاد به حساب شما برگشت خورد. https://shadjewel.ir لغو11", "recommended"),
 SHIPPED: p("SHIPPED", 2, "{0} عزیز سفارش {1} شما از اکسسوری شاد ارسال شد. https://shadjewel.ir لغو11"),
 TRACKING_CODE: p("TRACKING_CODE", 3, "{0} عزیز کد رهگیری سفارش {1} از اکسسوری شاد: {2} https://shadjewel.ir لغو11"),
 SHIP_DELAY: p("SHIP_DELAY", 2, "{0} عزیز ارسال/تحویل سفارش {1} از اکسسوری شاد با تأخیر مواجه شده است. https://shadjewel.ir لغو11", "recommended"),
 DELIVERY_FAILED: p("DELIVERY_FAILED", 2, "{0} عزیز تحویل سفارش {1} از اکسسوری شاد ناموفق بود. لطفاً با پشتیبانی تماس بگیرید. https://shadjewel.ir لغو11", "recommended"),
 SELLER_PAYOUT_PROCESSING: p("SELLER_PAYOUT_PROCESSING", 2, "{0} عزیز مبلغ {1} تومان از فروش شما در اکسسوری شاد در حال پردازش است. https://shadjewel.ir لغو11", "recommended"),
 SELLER_PAYOUT_SUCCESS: p("SELLER_PAYOUT_SUCCESS", 2, "{0} عزیز تسویه مبلغ {1} تومان در اکسسوری شاد با موفقیت انجام شد. https://shadjewel.ir لغو11"),
 SELLER_PAYOUT_FAILED: p("SELLER_PAYOUT_FAILED", 3, "{0} عزیز تسویه مبلغ {1} تومان در اکسسوری شاد ناموفق بود. دلیل: {2} https://shadjewel.ir لغو11"),
 SELLER_BANK_CHANGED: p("SELLER_BANK_CHANGED", 1, "{0} عزیز اطلاعات حساب بانکی شما در اکسسوری شاد تغییر یافت. اگر شما نبودید فوراً اقدام کنید. https://shadjewel.ir لغو11"),
 RETURN_REQUESTED_ADMIN: p("RETURN_REQUESTED_ADMIN", 2, "{0} عزیز درخواست مرجوعی برای سفارش {1} در اکسسوری شاد ثبت شد. https://shadjewel.ir لغو11"),
 RETURN_DECISION: p("RETURN_DECISION", 3, "{0} عزیز درخواست مرجوعی سفارش {1} در اکسسوری شاد {2} شد. https://shadjewel.ir لغو11"),
 RETURN_RECEIVED: p("RETURN_RECEIVED", 2, "{0} عزیز کالای مرجوعی سفارش {1} در اکسسوری شاد دریافت شد. https://shadjewel.ir لغو11", "recommended"),
 REFUND_REQUESTED: p("REFUND_REQUESTED", 2, "{0} عزیز درخواست بازپرداخت سفارش {1} در اکسسوری شاد ثبت شد. https://shadjewel.ir لغو11", "recommended"),
 REFUND_APPROVED: p("REFUND_APPROVED", 2, "{0} عزیز بازپرداخت سفارش {1} در اکسسوری شاد تأیید شد. https://shadjewel.ir لغو11"),
 REFUND_DONE: p("REFUND_DONE", 3, "{0} عزیز مبلغ {1} تومان از سفارش {2} در اکسسوری شاد به حساب شما بازگردانده شد. https://shadjewel.ir لغو11"),
 REFUND_FAILED: p("REFUND_FAILED", 2, "{0} عزیز بازپرداخت سفارش {1} در اکسسوری شاد ناموفق بود. https://shadjewel.ir لغو11"),
 DISPUTE_OPENED: p("DISPUTE_OPENED", 2, "{0} عزیز اختلاف برای سفارش {1} در اکسسوری شاد ایجاد شد. لطفاً وارد پنل شوید. https://shadjewel.ir لغو11"),
 DISPUTE_ACTION_NEEDED: p("DISPUTE_ACTION_NEEDED", 2, "{0} عزیز برای اختلاف سفارش {1} در اکسسوری شاد نیاز به اقدام/مدرک دارید. https://shadjewel.ir لغو11"),
 DISPUTE_RESULT: p("DISPUTE_RESULT", 3, "{0} عزیز نتیجه نهایی اختلاف سفارش {1} در اکسسوری شاد: {2} https://shadjewel.ir لغو11"),
 ADMIN_CRITICAL: p("ADMIN_CRITICAL", 2, "خطای Critical سیستم اکسسوری شاد: {0} زمان: {1} https://shadjewel.ir لغو11"),
 ADMIN_FRAUD: p("ADMIN_FRAUD", 2, "فعالیت مشکوک/Fraud در اکسسوری شاد: {0} {1} https://shadjewel.ir لغو11", "recommended"),
 ADMIN_PAYMENT_OUTAGE: p("ADMIN_PAYMENT_OUTAGE", 1, "اختلال جدی در درگاه پرداخت اکسسوری شاد: {0} https://shadjewel.ir لغو11"),
 ADMIN_SMS_OUTAGE: p("ADMIN_SMS_OUTAGE", 1, "اختلال در سرویس پیامک اکسسوری شاد: {0} https://shadjewel.ir لغو11", "recommended"),
 STOCK_ALERT: p("STOCK_ALERT", 2, "{0} عزیز، {1} در اکسسوری شاد دوباره موجود شد. https://shadjewel.ir لغو11", "recommended"),
 PRICE_ALERT: p("PRICE_ALERT", 2, "{0} عزیز، تغییر قیمت/تخفیف برای {1} در اکسسوری شاد. https://shadjewel.ir لغو11", "recommended"),
};

export function resolveBodyId(key: SmsPatternKey): string | undefined {
 const def = SMS_PATTERNS[key];
 const specific = process.env[def.envKey]?.trim();
 if (specific) return specific;
 // OTP family: prefer MELIPAYAMAK_BODY_OTP_LOGIN, then legacy MELIPAYAMAK_BODY_ID.
 if (OTP_KEYS.has(key)) {
  if (key !== "OTP_LOGIN") {
   const shared = process.env.MELIPAYAMAK_BODY_OTP_LOGIN?.trim();
   if (shared) return shared;
  }
  return process.env.MELIPAYAMAK_BODY_ID?.trim() || undefined;
 }
 return undefined;
}

/** Pattern args for OTP sends — code only; never name/domain. */
export function otpPatternArgs(code: string | number): string[] {
 return [String(code).trim()];
}
