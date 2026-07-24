import { prisma } from "./prisma";

/**
 * Transactional + broadcast email via Resend's REST API (no SDK dependency).
 * Every send — success or failure — is recorded in EmailLog so admins can
 * audit and resend. Without RESEND_API_KEY configured, sends are logged as
 * FAILED with a clear reason instead of throwing.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  body: string; // plain text; rendered into a minimal HTML shell
  template: string;
  broadcastId?: string;
};

function htmlShell(subject: string, body: string) {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
<h2 style="font-size:18px">${esc(subject)}</h2>
<div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(body)}</div>
<p style="margin-top:32px;font-size:12px;color:#888">FiFoDiDo — mining &amp; resources jobs worldwide</p>
</body></html>`;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "FiFoDiDo <onboarding@resend.dev>";

  let status = "SENT";
  let error: string | undefined;

  if (!apiKey) {
    status = "FAILED";
    error = "RESEND_API_KEY not configured";
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          html: htmlShell(input.subject, input.body),
          text: input.body,
        }),
      });
      if (!res.ok) {
        status = "FAILED";
        const data = await res.json().catch(() => ({}));
        error = (data as any)?.message ?? `Resend responded ${res.status}`;
      }
    } catch (err: any) {
      status = "FAILED";
      error = err?.message ?? "network error";
    }
  }

  await prisma.emailLog
    .create({
      data: {
        to: input.to,
        subject: input.subject,
        template: input.template,
        body: input.body,
        status,
        error,
        broadcastId: input.broadcastId,
      },
    })
    .catch((e) => console.error("[email] failed to write EmailLog", e));

  return { ok: status === "SENT", error };
}

/** Re-send a previously logged email (creates a fresh log entry). */
export async function resendFromLog(emailLogId: string) {
  const entry = await prisma.emailLog.findUnique({ where: { id: emailLogId } });
  if (!entry) return { ok: false, error: "Log entry not found" };
  return sendEmail({
    to: entry.to,
    subject: entry.subject,
    body: entry.body,
    template: entry.template,
    broadcastId: entry.broadcastId ?? undefined,
  });
}
