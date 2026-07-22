import { prisma } from "./prisma";
import { sendEmail } from "./email";
import type { NotificationType } from "@prisma/client";

export type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
  email?: { to: string; subject: string; body: string; template: string };
};

/**
 * Single entry point for "something happened, tell this user" — always
 * writes an in-app Notification row, and optionally sends an email in the
 * same call. Both are best-effort: a failure here must never fail the
 * caller's primary action (an application-status update, a message send,
 * etc.), the same way the pre-existing NEW_APPLICATION employer email
 * (src/app/api/applications/route.ts) is already fire-and-forget.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  await prisma.notification
    .create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        linkUrl: input.linkUrl,
      },
    })
    .catch((e) => console.error("[notify] failed to write Notification", e));

  if (input.email) {
    await sendEmail({
      to: input.email.to,
      subject: input.email.subject,
      body: input.email.body,
      template: input.email.template,
    }).catch((e) => console.error("[notify] email send failed", e));
  }
}
