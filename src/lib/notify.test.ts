import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  notification: { create: vi.fn() },
}));
const mockSendEmail = vi.hoisted(() => vi.fn());

vi.mock("./prisma", () => ({ prisma: mockPrisma }));
vi.mock("./email", () => ({ sendEmail: mockSendEmail }));

import { notifyUser } from "./notify";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.notification.create.mockResolvedValue({ id: "notif-1" });
  mockSendEmail.mockResolvedValue({ ok: true });
});

describe("notifyUser", () => {
  it("always writes an in-app Notification row", async () => {
    await notifyUser({
      userId: "user-1",
      type: "APPLICATION_STATUS",
      title: "You've been shortlisted",
      body: "Some body",
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "APPLICATION_STATUS",
        title: "You've been shortlisted",
        body: "Some body",
        linkUrl: undefined,
      },
    });
  });

  it("does not send an email when no email input is given", async () => {
    await notifyUser({ userId: "user-1", type: "NEW_MESSAGE", title: "t", body: "b" });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends an email in addition to the in-app row when email input is given", async () => {
    await notifyUser({
      userId: "user-1",
      type: "NEW_MESSAGE",
      title: "t",
      body: "b",
      email: { to: "candidate@example.com", subject: "New message", body: "Preview text", template: "NEW_MESSAGE" },
    });

    expect(mockPrisma.notification.create).toHaveBeenCalled();
    expect(mockSendEmail).toHaveBeenCalledWith({
      to: "candidate@example.com",
      subject: "New message",
      body: "Preview text",
      template: "NEW_MESSAGE",
    });
  });

  it("does not throw when the Notification write fails (best-effort)", async () => {
    mockPrisma.notification.create.mockRejectedValue(new Error("db down"));
    await expect(notifyUser({ userId: "user-1", type: "NEW_MESSAGE", title: "t", body: "b" })).resolves.toBeUndefined();
  });

  it("does not throw when the email send fails (best-effort)", async () => {
    mockSendEmail.mockRejectedValue(new Error("resend down"));
    await expect(
      notifyUser({
        userId: "user-1",
        type: "NEW_MESSAGE",
        title: "t",
        body: "b",
        email: { to: "x@example.com", subject: "s", body: "b", template: "NEW_MESSAGE" },
      })
    ).resolves.toBeUndefined();
  });

  it("passes linkUrl through to the Notification row when given", async () => {
    await notifyUser({
      userId: "user-1",
      type: "APPLICATION_STATUS",
      title: "t",
      body: "b",
      linkUrl: "/dashboard/candidate",
    });
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ linkUrl: "/dashboard/candidate" }) })
    );
  });
});
