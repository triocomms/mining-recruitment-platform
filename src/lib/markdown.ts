/**
 * Minimal, safe markdown renderer, used for blog post bodies, job
 * descriptions, and company "about" text.
 *
 * Security model: ALL input is HTML-escaped first, then a small set of
 * markdown constructs is transformed back into tags we control. Raw HTML in
 * the source can never reach the output, so no sanitizer dependency is needed.
 *
 * Supported: ## / ### headings, **bold**, *italic*, [links](https://…),
 * ![alt](image-url), - bullet lists, 1. numbered lists, paragraphs, and
 * YouTube/Vimeo embeds (a bare video URL on its own line becomes a
 * responsive iframe).
 *
 * Plain text with no markdown syntax at all (e.g. RSS/CSV-imported job
 * descriptions run through stripHtml()) still renders correctly — it just
 * falls through to the paragraph case below — so this is safe to use
 * uniformly across every description field regardless of source.
 */

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const SAFE_URL = /^(https:\/\/|http:\/\/|\/api\/files\?key=)/;

function youtubeId(url: string) {
  const m = url.match(
    /^https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,20})/
  );
  return m?.[1] ?? null;
}
function vimeoId(url: string) {
  const m = url.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(\d{6,12})/);
  return m?.[1] ?? null;
}

function inline(md: string): string {
  let out = md;
  // images first (so links don't consume them)
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) =>
    SAFE_URL.test(url)
      ? `<img src="${url}" alt="${alt}" loading="lazy" class="my-4 rounded-lg" />`
      : ""
  );
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) =>
    SAFE_URL.test(url)
      ? `<a href="${url}" rel="noopener noreferrer" class="underline">${text}</a>`
      : text
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  return out;
}

export function renderMarkdown(source: string): string {
  const escaped = escapeHtml(source.replace(/\r\n/g, "\n"));
  const blocks = escaped.split(/\n{2,}/);
  const html: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Video embed: a bare YouTube/Vimeo URL on its own block.
    const yt = youtubeId(trimmed);
    const vm = !yt ? vimeoId(trimmed) : null;
    if ((yt || vm) && !trimmed.includes(" ")) {
      const src = yt
        ? `https://www.youtube-nocookie.com/embed/${yt}`
        : `https://player.vimeo.com/video/${vm}`;
      html.push(
        `<div class="my-4 aspect-video"><iframe src="${src}" title="Embedded video" class="h-full w-full rounded-lg" allowfullscreen loading="lazy" referrerpolicy="no-referrer"></iframe></div>`
      );
      continue;
    }

    if (trimmed.startsWith("### ")) {
      html.push(`<h3 class="mt-6 font-display text-lg uppercase tracking-wide">${inline(trimmed.slice(4))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      html.push(`<h2 class="mt-8 font-display text-xl uppercase tracking-wide">${inline(trimmed.slice(3))}</h2>`);
      continue;
    }

    const lines = trimmed.split("\n");
    if (lines.every((l) => /^[-*] /.test(l.trim()))) {
      const items = lines.map((l) => `<li>${inline(l.trim().slice(2))}</li>`).join("");
      html.push(`<ul class="my-4 list-disc space-y-1 pl-6">${items}</ul>`);
      continue;
    }
    if (lines.every((l) => /^\d+\. /.test(l.trim()))) {
      const items = lines.map((l) => `<li>${inline(l.trim().replace(/^\d+\. /, ""))}</li>`).join("");
      html.push(`<ol class="my-4 list-decimal space-y-1 pl-6">${items}</ol>`);
      continue;
    }

    html.push(`<p class="my-4 leading-relaxed">${inline(trimmed).replace(/\n/g, "<br/>")}</p>`);
  }

  return html.join("\n");
}

/**
 * Reduces markdown source to plain text: strips list/heading markers and
 * emphasis, unwraps links/images to their visible text, and collapses
 * whitespace. Used anywhere raw markdown syntax (**, [text](url), etc.)
 * would otherwise leak into a place that expects plain text — meta
 * descriptions, sponsored-ad previews, and candidate/job certification
 * matching.
 */
export function stripMarkdown(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}
