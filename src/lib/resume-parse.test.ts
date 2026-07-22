import { describe, it, expect } from "vitest";
import { detectResumeFileKind, extractResumeFields } from "./resume-parse";

describe("detectResumeFileKind", () => {
  it("detects a PDF from its magic bytes", () => {
    const buf = Buffer.from("%PDF-1.4\n%rest of file...");
    expect(detectResumeFileKind(buf)).toBe("pdf");
  });

  it("detects a DOCX (zip signature) from its magic bytes", () => {
    const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(detectResumeFileKind(buf)).toBe("docx");
  });

  it("returns 'unknown' for neither signature", () => {
    const buf = Buffer.from("just some plain text, not a real file");
    expect(detectResumeFileKind(buf)).toBe("unknown");
  });

  it("returns 'unknown' for a too-short buffer", () => {
    expect(detectResumeFileKind(Buffer.from([0x50, 0x4b]))).toBe("unknown");
  });
});

describe("extractResumeFields", () => {
  it("returns an empty object for text with no recognizable signal", () => {
    expect(extractResumeFields("Lorem ipsum dolor sit amet.")).toEqual({});
  });

  it("extracts a phone number in a common AU mobile format", () => {
    const { phone } = extractResumeFields("Contact me on 0412 345 678 any time.");
    expect(phone).toBe("0412 345 678");
  });

  it("extracts a phone number with a country code and parens", () => {
    const { phone } = extractResumeFields("Phone: +61 (08) 9123 4567");
    expect(phone).toContain("9123");
  });

  it("does not mistake a short number (e.g. a year) for a phone number", () => {
    const { phone } = extractResumeFields("Worked at BHP from 2018 to 2022.");
    expect(phone).toBeUndefined();
  });

  it("extracts years of experience from '10 years experience'", () => {
    expect(extractResumeFields("10 years experience in open pit mining.").yearsExperience).toBe(10);
  });

  it("extracts years of experience from '8+ yrs'", () => {
    expect(extractResumeFields("8+ yrs as a fitter.").yearsExperience).toBe(8);
  });

  it("ignores an implausible years-of-experience figure", () => {
    // "99 years" is outside the sane 0-50 cap, so nothing is suggested.
    expect(extractResumeFields("99 years experience").yearsExperience).toBeUndefined();
  });

  it("extracts FIFO preference, preferring FIFO over other mentions", () => {
    expect(extractResumeFields("Seeking FIFO roles, previously DIDO.").fifoPreference).toBe("FIFO");
  });

  it("extracts DIDO when FIFO isn't mentioned", () => {
    expect(extractResumeFields("Looking for DIDO opportunities.").fifoPreference).toBe("DIDO");
  });

  it("extracts RESIDENTIAL preference", () => {
    expect(extractResumeFields("Prefer residential positions only.").fifoPreference).toBe("RESIDENTIAL");
  });

  it("returns undefined fifoPreference when none of the terms appear", () => {
    expect(extractResumeFields("Experienced heavy diesel fitter.").fifoPreference).toBeUndefined();
  });

  it("extracts multiple site experience tags", () => {
    const { siteExperience } = extractResumeFields(
      "Five years underground, two years in an open pit operation, some workshop maintenance work."
    );
    expect(siteExperience).toEqual(
      expect.arrayContaining(["UNDERGROUND", "OPEN_PIT", "WORKSHOP_MAINTENANCE"])
    );
  });

  it("does not false-positive PORT_RAIL on words merely containing 'port'", () => {
    const { siteExperience } = extractResumeFields("Provided ongoing support and reporting to management.");
    expect(siteExperience ?? []).not.toContain("PORT_RAIL");
  });

  it("extracts commodity mentions", () => {
    const { commodities } = extractResumeFields("Worked across gold and iron ore operations in WA.");
    expect(commodities).toEqual(expect.arrayContaining(["GOLD", "IRON_ORE"]));
  });

  it("does not false-positive ZINC_LEAD on the word 'lead' used as a verb", () => {
    const { commodities } = extractResumeFields("Led a team of six on a coal operation.");
    expect(commodities ?? []).not.toContain("ZINC_LEAD");
  });

  it("extracts known certifications by name", () => {
    const { certifications } = extractResumeFields(
      "Tickets: White Card, Working at Heights, Forklift Licence."
    );
    expect(certifications).toEqual(
      expect.arrayContaining(["White Card", "Working at Heights", "Forklift Licence"])
    );
  });

  it("matches certifications case-insensitively but returns canonical casing", () => {
    const { certifications } = extractResumeFields("current first aid certificate");
    expect(certifications).toContain("First Aid");
  });

  it("omits keys entirely rather than returning empty arrays/blank strings", () => {
    const result = extractResumeFields("Just a name and an address, nothing else useful.");
    expect(Object.keys(result)).toEqual([]);
  });
});
