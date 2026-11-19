import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
 OTP_PANEL_TEXT,
 SMS_PATTERNS,
 otpPatternArgs,
 resolveBodyId,
} from "@/lib/sms/patterns";

const OTP_ENV_KEYS = [
 "MELIPAYAMAK_USERNAME",
 "MELIPAYAMAK_PASSWORD",
 "MELIPAYAMAK_FROM",
 "MELIPAYAMAK_BODY_ID",
 "MELIPAYAMAK_BODY_OTP_LOGIN",
 "MELIPAYAMAK_BODY_OTP_REGISTER",
 "MELIPAYAMAK_BODY_OTP_RECOVERY",
] as const;

function clearOtpEnv() {
 for (const k of OTP_ENV_KEYS) delete process.env[k];
}

function formFromFetchCall(call: unknown): URLSearchParams {
 const init = (call as [string, RequestInit])[1];
 return new URLSearchParams(String(init.body));
}

describe("OTP pattern registry (592258 contract)", () => {
 it("defines single-variable approved panel text for login/register/recovery", () => {
  for (const key of ["OTP_LOGIN", "OTP_REGISTER", "OTP_RECOVERY"] as const) {
   expect(SMS_PATTERNS[key].arity).toBe(1);
   expect(SMS_PATTERNS[key].panelText).toBe(OTP_PANEL_TEXT);
   expect(SMS_PATTERNS[key].panelText).toContain("{0}");
   expect(SMS_PATTERNS[key].panelText).not.toMatch(/\{[1-9]\}/);
  }
  expect(OTP_PANEL_TEXT).toBe(
   "کد تأیید شما در اکسسوری شاد: {0} میباشد. https://shadjewel.ir/",
  );
 });

 it("otpPatternArgs sends only the verification code", () => {
  expect(otpPatternArgs("482913")).toEqual(["482913"]);
  expect(otpPatternArgs(482913)).toEqual(["482913"]);
 });
});

describe("resolveBodyId OTP fallbacks", () => {
 beforeEach(clearOtpEnv);
 afterEach(clearOtpEnv);

 it("prefers MELIPAYAMAK_BODY_OTP_LOGIN over MELIPAYAMAK_BODY_ID", () => {
  process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592258";
  process.env.MELIPAYAMAK_BODY_ID = "999999";
  expect(resolveBodyId("OTP_LOGIN")).toBe("592258");
 });

 it("falls back to MELIPAYAMAK_BODY_ID when OTP_LOGIN unset", () => {
  process.env.MELIPAYAMAK_BODY_ID = "592258";
  expect(resolveBodyId("OTP_LOGIN")).toBe("592258");
 });

 it("shares OTP_LOGIN / BODY_ID for register and recovery when specific unset", () => {
  process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592258";
  expect(resolveBodyId("OTP_REGISTER")).toBe("592258");
  expect(resolveBodyId("OTP_RECOVERY")).toBe("592258");
 });
});

describe("meliSendLoginCode (mocked network)", () => {
 beforeEach(() => {
  clearOtpEnv();
  vi.resetModules();
  vi.unstubAllGlobals();
 });

 afterEach(() => {
  clearOtpEnv();
  vi.unstubAllGlobals();
  vi.resetModules();
 });

 it("posts BaseServiceNumber with pattern id and code-only text", async () => {
  process.env.MELIPAYAMAK_USERNAME = "test-user";
  process.env.MELIPAYAMAK_PASSWORD = "test-pass";
  process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592258";

  const fetchMock = vi.fn().mockResolvedValue({
   ok: true,
   status: 200,
   text: async () => JSON.stringify({ RetStatus: 1, Value: "12345678901" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const { meliSendLoginCode } = await import("@/lib/sms/melipayamak");
  const result = await meliSendLoginCode({ to: "09121234567", code: "482913" });

  expect(result).toEqual({ ok: true, recId: "12345678901" });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe("https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber");

  const form = formFromFetchCall(fetchMock.mock.calls[0]);
  expect(form.get("bodyId")).toBe("592258");
  expect(form.get("text")).toBe("482913");
  expect(form.get("text")).not.toContain(";");
  expect(form.get("to")).toBe("09121234567");
  // Must not smuggle name/domain as extra pattern args
  expect(form.get("text")).not.toMatch(/shadjewel|اکسسوری|@/);
 });

 it("uses MELIPAYAMAK_BODY_ID when MELIPAYAMAK_BODY_OTP_LOGIN absent", async () => {
  process.env.MELIPAYAMAK_USERNAME = "test-user";
  process.env.MELIPAYAMAK_PASSWORD = "test-pass";
  process.env.MELIPAYAMAK_BODY_ID = "592258";

  const fetchMock = vi.fn().mockResolvedValue({
   ok: true,
   status: 200,
   text: async () => JSON.stringify({ RetStatus: 1, Value: "99988877766" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const { meliSendLoginCode } = await import("@/lib/sms/melipayamak");
  await meliSendLoginCode({ to: "09120000000", code: "111222" });

  const form = formFromFetchCall(fetchMock.mock.calls[0]);
  expect(form.get("bodyId")).toBe("592258");
  expect(form.get("text")).toBe("111222");
 });

 it("returns config error when credentials missing", async () => {
  process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592258";
  // no username/password

  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  const { meliSendLoginCode } = await import("@/lib/sms/melipayamak");
  const result = await meliSendLoginCode({ to: "09121234567", code: "123456" });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe("config_missing_credentials");
  expect(fetchMock).not.toHaveBeenCalled();
 });

 it("surfaces Melipayamak service / HTTP errors", async () => {
  process.env.MELIPAYAMAK_USERNAME = "test-user";
  process.env.MELIPAYAMAK_PASSWORD = "test-pass";
  process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592258";

  const fetchMock = vi.fn().mockResolvedValue({
   ok: false,
   status: 503,
   text: async () => "unavailable",
  });
  vi.stubGlobal("fetch", fetchMock);

  const { meliSendLoginCode } = await import("@/lib/sms/melipayamak");
  const result = await meliSendLoginCode({ to: "09121234567", code: "654321" });

  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBe("http_503");
 });

 it("surfaces Melipayamak API error payload without throwing", async () => {
  process.env.MELIPAYAMAK_USERNAME = "test-user";
  process.env.MELIPAYAMAK_PASSWORD = "test-pass";
  process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592258";

  const fetchMock = vi.fn().mockResolvedValue({
   ok: true,
   status: 200,
   text: async () => JSON.stringify({ RetStatus: 0, Value: "0" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  const { meliSendLoginCode } = await import("@/lib/sms/melipayamak");
  const result = await meliSendLoginCode({ to: "09121234567", code: "654321" });

  expect(result.ok).toBe(false);
 });
});
