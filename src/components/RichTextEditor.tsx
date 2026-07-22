"use client";

import { useRef, useState, type ReactNode } from "react";
import { renderMarkdown } from "@/lib/markdown";

/**
 * Lightweight markdown editor: a plain textarea with a toolbar that inserts
 * markdown syntax around the current selection, plus a live preview toggle
 * (rendered through the same renderMarkdown() used on every public page).
 *
 * Deliberately not a WYSIWYG/contenteditable editor — the stored value stays
 * plain markdown text (same column, no schema change, degrades gracefully
 * anywhere it isn't rendered yet).
 */

type ListAction = "ul" | "ol";

function applyInlineWrap(value: string, start: number, end: number, mark: string) {
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + mark + selected + mark + value.slice(end);
  return { next, selStart: start + mark.length, selEnd: start + mark.length + selected.length };
}

function applyLink(value: string, start: number, end: number, url: string) {
  const label = value.slice(start, end) || "link text";
  const insert = `[${label}](${url})`;
  const next = value.slice(0, start) + insert + value.slice(end);
  return { next, selStart: start, selEnd: start + insert.length };
}

function applyListPrefix(value: string, start: number, end: number, kind: ListAction) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = value.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  let n = 0;
  const prefixed = lines
    .map((l) => {
      if (!l.trim()) return l;
      const bare = l.replace(/^\s*([-*]|\d+\.)\s+/, "");
      n += 1;
      return kind === "ul" ? `- ${bare}` : `${n}. ${bare}`;
    })
    .join("\n");
  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
  return { next, selStart: lineStart, selEnd: lineStart + prefixed.length };
}

export function RichTextEditor(props: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function commit(result: { next: string; selStart: number; selEnd: number }) {
    props.onChange(result.next);
    const el = ref.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.selStart, result.selEnd);
    });
  }

  function inline(mark: string) {
    const el = ref.current;
    if (!el) return;
    commit(applyInlineWrap(el.value, el.selectionStart, el.selectionEnd, mark));
  }

  function list(kind: ListAction) {
    const el = ref.current;
    if (!el) return;
    commit(applyListPrefix(el.value, el.selectionStart, el.selectionEnd, kind));
  }

  function link() {
    const el = ref.current;
    if (!el) return;
    const url = window.prompt("Link URL (https://…)");
    if (!url) return;
    commit(applyLink(el.value, el.selectionStart, el.selectionEnd, url));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 rounded-t-card border border-b-0 border-ink/20 bg-ink/[0.03] p-1">
        <ToolbarButton label="Bold" onClick={() => inline("**")}>
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => inline("*")}>
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton label="Bullet list" onClick={() => list("ul")}>
          • List
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => list("ol")}>
          1. List
        </ToolbarButton>
        <ToolbarButton label="Link" onClick={link}>
          Link
        </ToolbarButton>
        <button
          type="button"
          className="ml-auto rounded px-2 py-1 text-xs font-semibold text-ink/60 hover:bg-ink/10"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {preview ? (
        <div
          className={`${props.className ?? ""} min-h-36 overflow-auto rounded-b-card border border-ink/20 bg-white px-3.5 py-3 text-sm`}
          dangerouslySetInnerHTML={{
            __html:
              renderMarkdown(props.value) ||
              '<p class="text-ink/40">Nothing to preview yet.</p>',
          }}
        />
      ) : (
        <textarea
          ref={ref}
          id={props.id}
          className={`${props.className ?? "min-h-36"} field rounded-t-none`}
          required={props.required}
          minLength={props.minLength}
          maxLength={props.maxLength}
          placeholder={props.placeholder}
          rows={props.rows}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
      <p className="mt-1 text-xs text-ink/50">
        Formatting: <strong>bold</strong>, <em>italic</em>, bullet/numbered lists, and links.
      </p>
    </div>
  );
}

function ToolbarButton(props: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={props.label}
      aria-label={props.label}
      className="rounded px-2 py-1 text-xs hover:bg-ink/10"
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
