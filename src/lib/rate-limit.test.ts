import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  message: { count: vi.fn() },
  company: { findUnique: vi.fn() },
  messageThread: { count: vi.fn() },
}));

vi.mock("./prisma", () => ({ prisma: mockPrisma }));

import { checkMessageAllowance, checkEmployerOutreachAllowance } from "./rate-limit";

const USER_ID = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkMessageAllowance", () => {
  it("blocks once the hard daily cap is hit, even for a subscribed account", async () => {
    mockPrisma.message.count.mockResolvedValue(200); // DAILY_MESSAGE_HARD_CAP
    mockPrisma.company.findUnique.mockResolvedValue({ subscription: { status: "ACTIVE" } });

    const result = await checkMessageAllowance(USER_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/daily message limit/i);
  });

  it("blocks a free (no active subscription) account past its lower daily cap", async () => {
    mockPrisma.message.count.mockResolvedValue(5); // FREE_DAILY_MESSAGE_CAP
    mockPrisma.company.findUnique.mockResolvedValue(null);

    const result = await checkMessageAllowance(USER_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/free accounts/i);
  });

  it("allows a free account still under its daily cap", async () => {
    mockPrisma.message.count.mockResolvedValue(4);
    mockPrisma.company.findUnique.mockResolvedValue(null);

    expect((await checkMessageAllowance(USER_ID)).ok).toBe(true);
  });

  it("allows a subscribed account past the free cap but under the hard cap", async () => {
    mockPrisma.message.count.mockResolvedValue(50);
    mockPrisma.company.findUnique.mockResolvedValue({ subscription: { status: "ACTIVE" } });

    expect((await checkMessageAllowance(USER_ID)).ok).toBe(true);
  });

  it("treats a subscription that exists but isn't ACTIVE as unsubscribed", async () => {
    mockPrisma.message.count.mockResolvedValue(5);
    mockPrisma.company.findUnique.mockResolvedValue({ subscription: { status: "CANCELED" } });

    const result = await checkMessageAllowance(USER_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/free accounts/i);
  });
});

describe("checkEmployerOutreachAllowance", () => {
  it("requires a company profile to exist at all", async () => {
    mockPrisma.company.findUnique.mockResolvedValue(null);
    const result = await checkEmployerOutreachAllowance(USER_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/no company profile/i);
  });

  it("requires KYB verification before opening new conversations", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      verificationStatus: "PENDING",
      subscription: { status: "ACTIVE", tier: "BRONZE" },
    });
    const result = await checkEmployerOutreachAllowance(USER_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/must be verified/i);
  });

  it("requires an active subscription even if verified", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ verificationStatus: "VERIFIED", subscription: null });
    const result = await checkEmployerOutreachAllowance(USER_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/active subscription/i);
  });

  it("blocks once the tier's daily new-thread cap is reached", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      verificationStatus: "VERIFIED",
      subscription: { status: "ACTIVE", tier: "BRONZE" }, // dailyOutreachCap: 10
    });
    mockPrisma.messageThread.count.mockResolvedValue(10);

    const result = await checkEmployerOutreachAllowance(USER_ID);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/daily outreach limit/i);
  });

  it("allows outreach under the tier's daily cap", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      id: "co-1",
      verificationStatus: "VERIFIED",
      subscription: { status: "ACTIVE", tier: "GOLD" }, // dailyOutreachCap: 60
    });
    mockPrisma.messageThread.count.mockResolvedValue(59);

    expect((await checkEmployerOutreachAllowance(USER_ID)).ok).toBe(true);
  });

  it("scopes the new-thread count to this company only", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      id: "co-42",
      verificationStatus: "VERIFIED",
      subscription: { status: "ACTIVE", tier: "SILVER" },
    });
    mockPrisma.messageThread.count.mockResolvedValue(0);

    await checkEmployerOutreachAllowance(USER_ID);
    expect(mockPrisma.messageThread.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: "co-42" }) })
    );
  });
});
