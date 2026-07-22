import { describe, it, expect } from "vitest";
import { parseFeedXml, normalizeFeedItem, parseAndNormalizeFeed, stripHtml } from "./rss-feed";

describe("stripHtml", () => {
  it("converts block-level tags to line breaks and strips the rest", () => {
    expect(stripHtml("<p>Line one</p><p>Line two</p>")).toBe("Line one\nLine two");
  });

  it("turns <li> into a bullet and keeps list items on their own line", () => {
    expect(stripHtml("<ul><li>First</li><li>Second</li></ul>")).toBe("• First\n• Second");
  });

  it("decodes double-escaped entities before stripping tags (the BHP feed case)", () => {
    // Some feeds wrap description HTML in CDATA but entity-escape the tags
    // themselves, so what arrives is markup-as-text, not real markup yet.
    const doubleEscaped = "&lt;p style=&quot;color:red&quot;&gt;Hello &amp; welcome&lt;/p&gt;";
    expect(stripHtml(doubleEscaped)).toBe("Hello & welcome");
  });

  it("collapses runs of blank lines to a single blank line", () => {
    expect(stripHtml("<p>A</p>\n\n\n\n<p>B</p>")).toBe("A\n\nB");
  });
});

describe("parseFeedXml", () => {
  it("parses a minimal valid RSS 2.0 feed", () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item><title>Dragline Operator</title><link>https://x.example/1</link><guid>job-1</guid></item>
      </channel></rss>`;
    const items = parseFeedXml(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Dragline Operator");
    expect(items[0].guid).toBe("job-1");
  });

  it("normalizes a single <item> (not an array) into a one-element array", () => {
    const xml = `<rss><channel><item><title>Solo Job</title></item></channel></rss>`;
    expect(parseFeedXml(xml)).toHaveLength(1);
  });

  it("returns an empty array for a channel with no items, rather than throwing", () => {
    const xml = `<rss><channel><title>Empty feed</title></channel></rss>`;
    expect(parseFeedXml(xml)).toEqual([]);
  });

  it("throws a clear error for unparseable XML", () => {
    expect(() => parseFeedXml("this is not xml at all <<<")).toThrow();
  });

  it("throws a clear error when the feed isn't RSS 2.0 (<rss><channel>)", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom, not RSS</title></feed>`;
    expect(() => parseFeedXml(xml)).toThrow(/not a recognizable rss/i);
  });

  it("reads Google Jobs g: namespace fields", () => {
    const xml = `<rss><channel><item>
      <title>Mechanical Fitter</title>
      <g:id>ext-42</g:id>
      <g:location>Perth, Australia</g:location>
    </item></channel></rss>`;
    const [item] = parseFeedXml(xml);
    expect(item.gId).toBe("ext-42");
    expect(item.gLocation).toBe("Perth, Australia");
  });
});

describe("normalizeFeedItem", () => {
  it("returns null for a title that's missing or too short to be real", () => {
    expect(normalizeFeedItem({ title: "" })).toBeNull();
    expect(normalizeFeedItem({ title: "Hi" })).toBeNull();
  });

  it("returns null when there's no stable externalRef to dedupe on", () => {
    expect(normalizeFeedItem({ title: "Senior Mine Geologist" })).toBeNull();
  });

  it("infers country, commodity, FIFO, and roster from title + description", () => {
    const result = normalizeFeedItem({
      title: "Dragline Operator | Saraji (Australia)",
      link: "https://x.example/jobs/1",
      description: "FIFO 8/4 roster, coal handling experience preferred.",
    });
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Dragline Operator");
    expect(result!.city).toBe("Saraji");
    expect(result!.countryCode).toBe("AU");
    expect(result!.commodity).toBe("COAL");
    expect(result!.fifo).toBe(true);
    expect(result!.rosterPattern).toBe("8/4");
    expect(result!.needsReview).toBe(false);
  });

  it("flags needsReview when country or commodity can't be inferred", () => {
    const result = normalizeFeedItem({
      title: "Generalist Recruiter",
      guid: "ext-99",
      description: "Great opportunity, apply now.",
    });
    expect(result!.needsReview).toBe(true);
    expect(result!.countryCode).toBeNull();
    expect(result!.commodity).toBeNull();
  });

  it("prefers g:id, then guid, then link as the externalRef, in that order", () => {
    const withGId = normalizeFeedItem({ title: "Role One", gId: "g-1", guid: "guid-1", link: "https://x/1" });
    expect(withGId!.externalRef).toBe("g-1");

    const withGuidOnly = normalizeFeedItem({ title: "Role Two", guid: "guid-2", link: "https://x/2" });
    expect(withGuidOnly!.externalRef).toBe("guid-2");

    const withLinkOnly = normalizeFeedItem({ title: "Role Three", link: "https://x/3" });
    expect(withLinkOnly!.externalRef).toBe("https://x/3");
  });

  it("skips a trailing (Country) segment from the title but keeps mid-title site segments", () => {
    const result = normalizeFeedItem({
      title: "Electrical Supervisor | South Flank (Australia)",
      guid: "ext-1",
    });
    expect(result!.title).toBe("Electrical Supervisor");
    expect(result!.city).toBe("South Flank");
  });

  it("does not mistake an ALL-CAPS employer acronym segment for a city", () => {
    const result = normalizeFeedItem({
      title: "Dragline Operators | Saraji | BMA",
      guid: "ext-2",
    });
    expect(result!.city).toBe("Saraji");
  });

  it("falls back to the headline as the description when the feed has none", () => {
    const result = normalizeFeedItem({ title: "Truck Driver", guid: "ext-3" });
    expect(result!.description).toBe("Truck Driver");
  });
});

describe("parseAndNormalizeFeed", () => {
  it("counts unparseable/skipped items separately from successfully normalized jobs", () => {
    const xml = `<rss><channel>
      <item><title>Good Role One</title><guid>g1</guid></item>
      <item><title>x</title><guid>g2</guid></item>
      <item><title>Good Role Two</title><guid>g3</guid></item>
    </channel></rss>`;
    const { jobs, skipped } = parseAndNormalizeFeed(xml);
    expect(jobs).toHaveLength(2);
    expect(skipped).toBe(1);
  });
});
