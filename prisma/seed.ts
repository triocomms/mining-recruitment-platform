/**
 * Seed data for local development.
 *   npx prisma db seed
 *
 * Accounts (password for all: "fifodido-dev"):
 *   admin@fifodido.local      — ADMIN
 *   employer@fifodido.local   — EMPLOYER (verified, no subscription → 1 free ad used)
 *   candidate@fifodido.local  — CANDIDATE (public profile, resume key is a placeholder)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("fifodido-dev", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@fifodido.local" },
    update: {},
    create: { email: "admin@fifodido.local", passwordHash, role: "ADMIN" },
  });

  const employerUser = await prisma.user.upsert({
    where: { email: "employer@fifodido.local" },
    update: {},
    create: {
      email: "employer@fifodido.local",
      passwordHash,
      role: "EMPLOYER",
      consents: {
        create: [
          { type: "TERMS", granted: true },
          { type: "PRIVACY_POLICY", granted: true },
        ],
      },
    },
  });

  const company = await prisma.company.upsert({
    where: { ownerId: employerUser.id },
    update: {},
    create: {
      ownerId: employerUser.id,
      name: "Red Range Resources",
      slug: "red-range-resources",
      website: "https://example.com",
      description:
        "Mid-tier gold and copper producer operating three open-pit sites in Western Australia and one underground development in Ontario. People-first rosters, industry-leading safety record.",
      countryCode: "AU",
      size: "201–1000",
      verificationStatus: "VERIFIED",
    },
  });

  const candidateUser = await prisma.user.upsert({
    where: { email: "candidate@fifodido.local" },
    update: {},
    create: {
      email: "candidate@fifodido.local",
      passwordHash,
      role: "CANDIDATE",
      consents: {
        create: [
          { type: "TERMS", granted: true },
          { type: "PRIVACY_POLICY", granted: true },
          { type: "PROFILE_VISIBILITY", granted: true },
        ],
      },
    },
  });

  const candidate = await prisma.candidateProfile.upsert({
    where: { userId: candidateUser.id },
    update: {},
    create: {
      userId: candidateUser.id,
      firstName: "Mia",
      lastName: "Tanaka",
      headline: "HD Fitter — 8 yrs open pit, Pilbara & Goldfields",
      summary:
        "Heavy diesel fitter with 8 years across CAT 793/789 fleets. Comfortable with 2/1 and 8/6 FIFO rosters, open to residential roles in regional WA. Strong shutdown planning experience.",
      countryCode: "AU",
      region: "Western Australia",
      city: "Perth",
      yearsExperience: 8,
      fifoPreference: "FIFO",
      willingToRelocate: true,
      visibility: "PUBLIC",
      siteExperience: ["OPEN_PIT", "WORKSHOP_MAINTENANCE"],
      commodities: ["GOLD", "IRON_ORE"],
      certifications: {
        create: [
          { name: "HR Licence" },
          { name: "Working at Heights", issuer: "RIIWHS204E" },
          { name: "First Aid", issuer: "HLTAID011" },
        ],
      },
    },
  });

  const jobs = [
    {
      title: "Senior Mine Geologist — 8/6 FIFO",
      slug: "senior-mine-geologist-8-6-fifo",
      description:
        "Lead grade-control geology at our flagship open pit, 8/6 roster ex-Perth. You'll run the ore-block model, mentor two grads, and work closely with drill & blast. Requires 5+ years open-pit experience, unrestricted WA driver's licence, and strong Leapfrog/Vulcan skills. Camp is renowned for the best kitchen in the Goldfields.",
      roleCategory: "Geology",
      commodity: "GOLD" as const,
      siteType: "OPEN_PIT" as const,
      fifo: true,
      rosterPattern: "8/6",
      countryCode: "AU",
      region: "Western Australia",
      city: "Kalgoorlie",
      salaryMin: 160000,
      salaryMax: 185000,
      salaryCurrency: "AUD",
      salaryPeriod: "YEAR" as const,
      isPriority: true,
    },
    {
      title: "HD Fitter — CAT Fleet, 2/1 Roster",
      slug: "hd-fitter-cat-fleet-2-1",
      description:
        "Join a 14-person maintenance crew keeping a CAT 793 fleet turning. 2/1 FIFO ex-Perth, brand-new workshop, genuine overtime available on R&M shutdowns. Trade cert essential; dealer experience highly regarded.",
      roleCategory: "Fixed & Mobile Plant Maintenance",
      commodity: "GOLD" as const,
      siteType: "WORKSHOP_MAINTENANCE" as const,
      fifo: true,
      rosterPattern: "2/1",
      countryCode: "AU",
      region: "Western Australia",
      salaryMin: 75,
      salaryMax: 85,
      salaryCurrency: "AUD",
      salaryPeriod: "HOUR" as const,
      isPriority: false,
    },
    {
      title: "Underground Shift Supervisor — Ontario",
      slug: "underground-shift-supervisor-ontario",
      description:
        "Residential role at our Ontario development project. Supervise jumbo and bogger crews on a 7/7 rotation, drive our critical-controls safety program, and help commission the new decline. Ontario supervisor certification required; relocation package available for the right candidate.",
      roleCategory: "Mining Operations",
      commodity: "COPPER" as const,
      siteType: "UNDERGROUND" as const,
      fifo: false,
      rosterPattern: "7/7",
      countryCode: "CA",
      region: "Ontario",
      city: "Sudbury",
      salaryMin: 130000,
      salaryMax: 150000,
      salaryCurrency: "CAD",
      salaryPeriod: "YEAR" as const,
      isPriority: false,
    },
  ];

  for (const j of jobs) {
    await prisma.job.upsert({
      where: { slug: j.slug },
      update: {},
      create: {
        ...j,
        companyId: company.id,
        status: "PUBLISHED",
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
  }

  await prisma.blogPost.upsert({
    where: { slug: "why-we-moved-to-8-6-rosters" },
    update: {},
    create: {
      type: "COMPANY",
      companyId: company.id,
      title: "Why we moved our whole workforce to 8/6 rosters",
      slug: "why-we-moved-to-8-6-rosters",
      excerpt:
        "Twelve months after switching from 2/1, here's what changed: retention up 22%, recordable injuries down, and what we'd do differently.",
      body:
        "When we announced the roster change last year, the response was split down the middle...\n\nA year on, the numbers speak for themselves. Voluntary turnover fell from 31% to 24%. Our TRIFR improved two quarters running. And exit interviews stopped mentioning fatigue as the top reason for leaving.\n\nIt wasn't free — we carry roughly 8% more headcount to cover the roster — but the reduction in re-hiring and re-training costs covered most of that gap.\n\nIf you're weighing the same move: start with one crew, measure everything, and involve the workforce in the swing design from day one.",
      status: "PUBLISHED",
      curatedRank: 0,
      publishedAt: new Date(),
    },
  });

  await prisma.blogPost.upsert({
    where: { slug: "lithium-hiring-outlook-2026" },
    update: {},
    create: {
      type: "EDITORIAL",
      authorId: admin.id,
      title: "Lithium hiring outlook: what converters' ramp-ups mean for site roles",
      slug: "lithium-hiring-outlook-2026",
      excerpt:
        "Downstream expansion is reshaping demand for process operators and chemical engineers across WA, Chile, and Québec.",
      body:
        "The story of the last cycle was pit crews; the story of this one is processing plants.\n\nAs hydroxide conversion capacity comes online, we're tracking a clear shift in job-ad mix toward process technicians, control-room operators, and chemical engineers — often residential rather than FIFO, clustered near existing industrial hubs.\n\nFor candidates: cross-training from gold or alumina processing transfers well, and employers are increasingly funding the gap. For employers: the talent pool is thin, and the companies winning it are the ones selling a lifestyle, not just a rate.",
      status: "PUBLISHED",
      curatedRank: 1,
      publishedAt: new Date(),
    },
  });

  // A demo application so dashboards & messaging have content.
  const job = await prisma.job.findUnique({ where: { slug: "hd-fitter-cat-fleet-2-1" } });
  if (job) {
    await prisma.application.upsert({
      where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } },
      update: {},
      create: {
        jobId: job.id,
        candidateId: candidate.id,
        status: "SHORTLISTED",
        coverNote: "8 years on 793s, currently on a 2/1 swing — available from next month.",
      },
    });
  }

  console.log("Seed complete. Sign in with *@fifodido.local / fifodido-dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
