import { prisma } from "./prisma";

/**
 * Admin audit trail. Every privileged admin action writes one entry.
 * Failures are logged but never block the underlying action.
 */
export type AuditTargetType =
  | "JOB"
  | "USER"
  | "COMPANY"
  | "REPORT"
  | "BLOG_POST"
  | "PAYMENT"
  | "CERTIFICATION"
  | "EMPLOYMENT_HISTORY";

export async function logAdminAction(
  adminId: string,
  action: string,
  targetType: AuditTargetType,
  targetId: string,
  notes?: string
) {
  try {
    await prisma.adminAuditLog.create({
      data: { adminId, action, targetType, targetId, notes },
    });
  } catch (err) {
    // Never let audit failures break the admin action itself.
    console.error("[audit] failed to write audit log entry", { action, targetType, targetId, err });
  }
}
