"use client";

import { useEffect, useRef, useState } from "react";

type TypeaheadProps = {
  name: string;
  type: "title" | "location";
  defaultValue?: string;
  placeholder: string;
  className?: string;
  ariaLabel: string;
};

/**
 * Debounced typeahead over /api/suggest — used for the job-title and
 * location fields on /jobs (P1.6). Renders as a plain `<input name=...>`
 * so it still submits through the existing GET filter form untouched;
 * suggestions are purely a client-side affordance layered on top.
 */
export function Typeahead({ name, type, defaultValue, placeholder, className, ariaLabel }: TypeaheadProps) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function onChange(next: string) {
    setValue(next);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/suggest?type=${type}&q=${encodeURIComponent(next.trim())}`);
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const next2: string[] = data.suggestions ?? [];
      setSuggestions(next2);
      setOpen(next2.length > 0);
    }, 200);
  }

  function select(s: string) {
    setValue(s);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
        aria-label={ariaLabel}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded border border-ink-line bg-bone text-ink shadow-lg">
          {suggestions.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep the input focused so this click registers before blur closes the list
                onClick={() => select(s)}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-ink/5 ${i === activeIndex ? "bg-ink/5" : ""}`}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
