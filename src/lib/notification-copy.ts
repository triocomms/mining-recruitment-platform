import type { ApplicationStatus } from "@prisma/client";

export type NotificationCopy = { title: string; body: string };

/**
 * What the candidate sees (in-app + email) when an employer moves their
 * application to a new status. Returns null for statuses that shouldn't
 * trigger a notification at all:
 *  - SUBMITTED is the starting state, not a change.
 *  - VIEWED fires on nearly every applicant-list open — notifying on it
 *    would be noise, not signal.
 *  - WITHDRAWN is candidate-initiated; they don't need to be told about
 *    their own action.
 * Rejection copy is deliberately short and neutral per the brief: don't
 * over-explain a "no".
 */
export function statusNotificationCopy(
  status: ApplicationStatus,
  jobTitle: string,
  companyName: string
): NotificationCopy | null {
  switch (status) {
    case "SHORTLISTED":
      return {
        title: "You've been shortlisted",
        body: `${companyName} has shortlisted your application for "${jobTitle}". Keep an eye out for next steps.`,
      };
    case "INTERVIEW":
      return {
        title: "Interview stage",
        body: `${companyName} would like to move ahead to interview for "${jobTitle}". They'll be in touch with details.`,
      };
    case "OFFER":
      return {
        title: "You've received an offer",
        body: `Congratulations — ${companyName} has extended an offer for "${jobTitle}".`,
      };
    case "REJECTED":
      return {
        title: "Application update",
        body: `${companyName} has moved forward with other candidates for "${jobTitle}". Thanks for applying — keep browsing other roles that fit.`,
      };
    default:
      return null;
  }
}

/** Truncates a message body for a notification/email preview without
 *  cutting a word in half. Never throws on short input. */
export function truncateForPreview(text: string, maxLen = 140): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
