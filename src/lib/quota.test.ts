import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted above imports, so the mock object itself must
// be built inside vi.hoisted() — a plain top-level const would still be in
// its temporal dead zone when the hoisted factory below runs.
const mockPrisma = vi.hoisted(() => {
  const m: any = {
    subscription: { findUnique: vi.fn(), update: vi.fn() },
    overagePurchase: { count: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    job: { count: vi.fn() },
  };
  // consumePublishSlot runs its logic inside prisma.$transaction(async (tx) => ...);
  // handing back the same mock as `tx` lets the real transaction body run
  // unmodified against our fakes.
  m.$transaction = vi.fn((cb: any) => cb(m));
  return m;
});

vi.mock("./prisma", () => ({ prisma: mockPrisma }));

import { getJobQuota, consumePublishSlot } from "./quota";

const COMPANY_ID = "company-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getJobQuota", () => {
  it("uses the plan's job quota and jobsUsedThisPeriod for an active subscriber", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      companyId: COMPANY_ID,
      status: "ACTIVE",
      tier: "SILVER",
      jobsUsedThisPeriod: 10,
    });
    mockPrisma.overagePurchase.count.mockResolvedValue(0);

    const quota = await getJobQuota(COMPANY_ID);
    expect(quota.tier).toBe("SILVER");
    expect(quota.quota).toBe(50); // Silver plan
    expect(quota.used).toBe(10);
    expect(quota.remaining).toBe(40);
    expect(quota.canPublish).toBe(true);
    expect(quota.needsOveragePurchase).toBe(false);
  });

  it("falls back to the lifetime free allowance when there's no active subscription", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.overagePurchase.count.mockResolvedValue(0);
    mockPrisma.job.count.mockResolvedValue(0);

    const quota = await getJobQuota(COMPANY_ID);
    expect(quota.tier).toBeNull();
    expect(quota.quota).toBe(1); // FREE_JOB_ALLOWANCE
    expect(quota.used).toBe(0);
    expect(quota.canPublish).toBe(true);
  });

  it("counts PUBLISHED and EXPIRED jobs (but not drafts) against the free allowance", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.overagePurchase.count.mockResolvedValue(0);
    mockPrisma.job.count.mockResolvedValue(1);

    const quota = await getJobQuota(COMPANY_ID);
    expect(mockPrisma.job.count).toHaveBeenCalledWith({
      where: { companyId: COMPANY_ID, status: { in: ["PUBLISHED", "EXPIRED"] } },
    });
    expect(quota.remaining).toBe(0);
    expect(quota.needsOveragePurchase).toBe(true); // no overage credits either
    expect(quota.canPublish).toBe(false);
  });

  it("never lets remaining go negative when usage exceeds quota", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      companyId: COMPANY_ID,
      status: "ACTIVE",
      tier: "BRONZE",
      jobsUsedThisPeriod: 999,
    });
    mockPrisma.overagePurchase.count.mockResolvedValue(0);

    const quota = await getJobQuota(COMPANY_ID);
    expect(quota.remaining).toBe(0);
  });

  it("can still publish over quota if unconsumed overage credits exist", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      companyId: COMPANY_ID,
      status: "ACTIVE",
      tier: "BRONZE",
      jobsUsedThisPeriod: 25,
    });
    mockPrisma.overagePurchase.count.mockResolvedValue(2);

    const quota = await getJobQuota(COMPANY_ID);
    expect(quota.remaining).toBe(0);
    expect(quota.overageCredits).toBe(2);
    expect(quota.canPublish).toBe(true);
    expect(quota.needsOveragePurchase).toBe(false);
  });

  it("treats a subscription row with a non-ACTIVE status the same as no subscription", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      companyId: COMPANY_ID,
      status: "CANCELED",
      tier: "GOLD",
      jobsUsedThisPeriod: 500,
    });
    mockPrisma.overagePurchase.count.mockResolvedValue(0);
    mockPrisma.job.count.mockResolvedValue(0);

    const quota = await getJobQuota(COMPANY_ID);
    expect(quota.tier).toBeNull();
    expect(quota.quota).toBe(1); // fell back to FREE_JOB_ALLOWANCE, ignoring the Gold tier row
  });
});

describe("consumePublishSlot", () => {
  it("increments jobsUsedThisPeriod for an active subscriber under quota", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      companyId: COMPANY_ID,
      status: "ACTIVE",
      tier: "BRONZE",
      jobsUsedThisPeriod: 5,
    });

    const ok = await consumePublishSlot(COMPANY_ID);
    expect(ok).toBe(true);
    expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
      where: { companyId: COMPANY_ID },
      data: { jobsUsedThisPeriod: { increment: 1 } },
    });
    expect(mockPrisma.overagePurchase.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to an overage credit when an active subscriber is at quota", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      companyId: COMPANY_ID,
      status: "ACTIVE",
      tier: "BRONZE",
      jobsUsedThisPeriod: 25, // Bronze quota is 25 — already at the limit
    });
    mockPrisma.overagePurchase.findFirst.mockResolvedValue({ id: "credit-1" });

    const ok = await consumePublishSlot(COMPANY_ID);
    expect(ok).toBe(true);
    expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    expect(mockPrisma.overagePurchase.update).toHaveBeenCalledWith({
      where: { id: "credit-1" },
      data: { consumed: true },
    });
  });

  it("returns false when at quota with no overage credit and an active subscription", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      companyId: COMPANY_ID,
      status: "ACTIVE",
      tier: "BRONZE",
      jobsUsedThisPeriod: 25,
    });
    mockPrisma.overagePurchase.findFirst.mockResolvedValue(null);

    const ok = await consumePublishSlot(COMPANY_ID);
    expect(ok).toBe(false);
  });

  it("without a subscription, allows the first free job then blocks the second", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.overagePurchase.findFirst.mockResolvedValue(null);

    mockPrisma.job.count.mockResolvedValue(0);
    expect(await consumePublishSlot(COMPANY_ID)).toBe(true);

    mockPrisma.job.count.mockResolvedValue(1); // FREE_JOB_ALLOWANCE already used
    expect(await consumePublishSlot(COMPANY_ID)).toBe(false);
  });

  it("prefers an overage credit over the free allowance when both exist", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.overagePurchase.findFirst.mockResolvedValue({ id: "credit-2" });

    const ok = await consumePublishSlot(COMPANY_ID);
    expect(ok).toBe(true);
    expect(mockPrisma.overagePurchase.update).toHaveBeenCalledWith({
      where: { id: "credit-2" },
      data: { consumed: true },
    });
    expect(mockPrisma.job.count).not.toHaveBeenCalled();
  });
});
