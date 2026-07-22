import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  candidateProfile: { findUnique: vi.fn() },
  company: { findUnique: vi.fn() },
  application: { findFirst: vi.fn() },
}));

vi.mock("./prisma", () => ({ prisma: mockPrisma }));

import { canViewCandidate, canSearchResumeDatabase } from "./visibility";

const CANDIDATE_ID = "candidate-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canViewCandidate", () => {
  it("denies an anonymous (null) viewer outright", async () => {
    expect(await canViewCandidate(null, CANDIDATE_ID)).toBe(false);
    // Should short-circuit before ever touching the database.
    expect(mockPrisma.candidateProfile.findUnique).not.toHaveBeenCalled();
  });

  it("always allows an ADMIN, regardless of the profile", async () => {
    expect(await canViewCandidate({ id: "admin-1", role: "ADMIN" }, CANDIDATE_ID)).toBe(true);
    expect(mockPrisma.candidateProfile.findUnique).not.toHaveBeenCalled();
  });

  it("returns false when the candidate profile doesn't exist", async () => {
    mockPrisma.candidateProfile.findUnique.mockResolvedValue(null);
    expect(await canViewCandidate({ id: "someone", role: "CANDIDATE" }, CANDIDATE_ID)).toBe(false);
  });

  it("always allows the candidate to view their own profile, even if PRIVATE", async () => {
    mockPrisma.candidateProfile.findUnique.mockResolvedValue({ userId: "user-1", visibility: "PRIVATE" });
    expect(await canViewCandidate({ id: "user-1", role: "CANDIDATE" }, CANDIDATE_ID)).toBe(true);
  });

  it("denies a CANDIDATE viewer looking at someone else's profile", async () => {
    mockPrisma.candidateProfile.findUnique.mockResolvedValue({ userId: "other-user", visibility: "PUBLIC" });
    expect(await canViewCandidate({ id: "user-1", role: "CANDIDATE" }, CANDIDATE_ID)).toBe(false);
  });

  it("denies an unverified EMPLOYER even for a PUBLIC profile", async () => {
    mockPrisma.candidateProfile.findUnique.mockResolvedValue({ userId: "other-user", visibility: "PUBLIC" });
    mockPrisma.company.findUnique.mockResolvedValue({ id: "co-1", verificationStatus: "PENDING" });
    expect(await canViewCandidate({ id: "employer-1", role: "EMPLOYER" }, CANDIDATE_ID)).toBe(false);
  });

  it("denies a verified EMPLOYER with no company profile at all", async () => {
    mockPrisma.candidateProfile.findUnique.mockResolvedValue({ userId: "other-user", visibility: "PUBLIC" });
    mockPrisma.company.findUnique.mockResolvedValue(null);
    expect(await canViewCandidate({ id: "employer-1", role: "EMPLOYER" }, CANDIDATE_ID)).toBe(false);
  });

  it("allows a verified EMPLOYER to view a PUBLIC profile with no prior application", async () => {
    mockPrisma.candidateProfile.findUnique.mockResolvedValue({ userId: "other-user", visibility: "PUBLIC" });
    mockPrisma.company.findUnique.mockResolvedValue({ id: "co-1", verificationStatus: "VERIFIED" });

    expect(await canViewCandidate({ id: "employer-1", role: "EMPLOYER" }, CANDIDATE_ID)).toBe(true);
    // A PUBLIC profile shouldn't need the application-relationship check at all.
    expect(mockPrisma.application.findFirst).not.toHaveBeenCalled();
  });

  it("denies a verified EMPLOYER a PRIVATE profile with no application relationship", async () => {
    mockPrisma.candidateProfile.findUnique.mockResolvedValue({ userId: "other-user", visibility: "PRIVATE" });
    mockPrisma.company.findUnique.mockResolvedValue({ id: "co-1", verificationStatus: "VERIFIED" });
    mockPrisma.application.findFirst.mockResolvedValue(null);

    expect(await canViewCandidate({ id: "employer-1", role: "EMPLOYER" }, CANDIDATE_ID)).toBe(false);
  });

  it("allows a verified EMPLOYER a PRIVATE profile once the candidate has applied to their company", async () => {
    mockPrisma.candidateProfile.findUnique.mockResolvedValue({ userId: "other-user", visibility: "PRIVATE" });
    mockPrisma.company.findUnique.mockResolvedValue({ id: "co-1", verificationStatus: "VERIFIED" });
    mockPrisma.application.findFirst.mockResolvedValue({ id: "app-1" });

    expect(await canViewCandidate({ id: "employer-1", role: "EMPLOYER" }, CANDIDATE_ID)).toBe(true);
    expect(mockPrisma.application.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          candidateId: CANDIDATE_ID,
          job: { companyId: "co-1" },
          status: { not: "WITHDRAWN" },
        }),
      })
    );
  });
});

describe("canSearchResumeDatabase", () => {
  it("requires a verified company on an active GOLD subscription", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      verificationStatus: "VERIFIED",
      subscription: { status: "ACTIVE", tier: "GOLD" },
    });
    expect(await canSearchResumeDatabase("employer-1")).toBe(true);
  });

  it("denies a verified GOLD company whose subscription isn't active", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      verificationStatus: "VERIFIED",
      subscription: { status: "PAST_DUE", tier: "GOLD" },
    });
    expect(await canSearchResumeDatabase("employer-1")).toBe(false);
  });

  it("denies a verified, active subscriber on a lower tier", async () => {
    mockPrisma.company.findUnique.mockResolvedValue({
      verificationStatus: "VERIFIED",
      subscription: { status: "ACTIVE", tier: "SILVER" },
    });
    expect(await canSearchResumeDatabase("employer-1")).toBe(false);
  });

  it("denies when there's no company at all", async () => {
    mockPrisma.company.findUnique.mockResolvedValue(null);
    expect(await canSearchResumeDatabase("employer-1")).toBe(false);
  });
});
