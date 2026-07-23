"use client";

import { useMemo, useState } from "react";
import { COUNTRIES, EU_MEMBER_CODES, countryName } from "@/lib/countries";

/**
 * Type-to-filter country picker that only ever adds a code from the fixed
 * COUNTRIES list — used for right-to-work declarations so entries stay
 * uniform (no "UK" vs "United Kingdom" vs free-text typos). Selected codes
 * render as removable tags below the input.
 */
export function CountryMultiSelect(props: {
  value: string[];
  onChange: (codes: string[]) => void;
  id?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const codeMatches = COUNTRIES.filter(
      (c) => !props.value.includes(c.code) && (c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
    ).slice(0, 8);
    return codeMatches;
  }, [query, props.value]);

  const showEuShortcut =
    query.trim().toLowerCase().length > 1 &&
    "european union".startsWith(query.trim().toLowerCase()) &&
    !EU_MEMBER_CODES.every((c) => props.value.includes(c));

  function add(code: string) {
    if (!props.value.includes(code)) props.onChange([...props.value, code]);
    setQuery("");
    setOpen(false);
  }

  function addEu() {
    const merged = Array.from(new Set([...props.value, ...EU_MEMBER_CODES]));
    props.onChange(merged);
    setQuery("");
    setOpen(false);
  }

  function remove(code: string) {
    props.onChange(props.value.filter((c) => c !== code));
  }

  return (
    <div>
      <div className="relative">
        <input
          id={props.id}
          className="field"
          placeholder={props.placeholder ?? "Start typing a country…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches[0]) add(matches[0].code);
              else if (showEuShortcut) addEu();
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {open && (matches.length > 0 || showEuShortcut) && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-card border border-ink/20 bg-white shadow-md">
            {showEuShortcut && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={addEu}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/5"
                >
                  European Union <span className="text-ink/50">— adds all 27 member states</span>
                </button>
              </li>
            )}
            {matches.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(c.code)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ink/5"
                >
                  {c.name} <span className="text-ink/40">({c.code})</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {props.value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {props.value.map((code) => (
            <span key={code} className="tag flex items-center gap-1.5">
              {countryName(code)}
              <button
                type="button"
                aria-label={`Remove ${countryName(code)}`}
                onClick={() => remove(code)}
                className="text-ink/50 hover:text-ink"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
