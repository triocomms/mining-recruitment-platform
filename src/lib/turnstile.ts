/**
 * Cloudflare Turnstile bot-check for public, unauthenticated write endpoints
 * (currently just /api/register). See RegisterForm.tsx for the client widget.
 *
 * Fails OPEN (does not block the request) when:
 *  - TURNSTILE_SECRET_KEY isn't configured yet — so registration keeps working
 *    the moment this ships, before the Cloudflare keys are added to Vercel.
 *  - the Cloudflare verify call itself errors out (network blip / outage) —
 *    a transient Cloudflare issue shouldn't lock real users out of sign-up.
 * Fails CLOSED only when Cloudflare explicitly says the token is invalid,
 * which is the actual bot-detection signal this exists to catch.
 */
export async function verifyTurnstileToken(
  token: string | undefined,
  ip: string | null
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — skipping bot check");
    return { ok: true };
  }
  if (!token) {
    return { ok: false, reason: "Please complete the verification challenge" };
  }

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    });
    const data = (await res.json()) as { success: boolean };
    if (!data.success) {
      return { ok: false, reason: "Verification failed — please try again" };
    }
    return { ok: true };
  } catch (e) {
    console.error("[turnstile] verify request failed", e);
    return { ok: true };
  }
}
