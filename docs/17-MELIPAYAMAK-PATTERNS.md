# Melipayamak patterns

See `src/lib/sms/patterns.ts` for `panelText`, arity, and env keys.

## OTP (login / signup / OTP recovery)

- **Approved pattern ID:** `592258`
- **Panel text:** `کد تأیید شما در اکسسوری شاد: {0} میباشد. https://shadjewel.ir/`
- **Args:** one variable only — `{0}` = verification code. Do not send name or domain.
- **Env:** set `MELIPAYAMAK_BODY_OTP_LOGIN=592258` (falls back to `MELIPAYAMAK_BODY_ID` if unset).
- **Sender:** `meliSendLoginCode` → `BaseServiceNumber` with `text` = code only.

## Hosting

Set `MELIPAYAMAK_USERNAME`, `MELIPAYAMAK_PASSWORD`, `MELIPAYAMAK_BODY_*`, and `ADMIN_SMS_PHONES` in the host (e.g. Vercel). Do not commit secrets.
