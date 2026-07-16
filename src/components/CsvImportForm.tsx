"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ImportResult = {
  summary: {
    totalRows: number;
    published: number;
    draftedOverQuota: number;
    skippedDuplicates: number;
    failed: number;
  };
  errors: { line: number; message: string }[];
};

export function CsvImportForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
    const file = input?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);

    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/jobs/import", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    setResult(data);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <p className="text-sm text-ink/60">
        Upload up to 200 jobs at once. Re-imports with the same <code className="font-mono text-xs">external_ref</code> are
        skipped as duplicates. Rows beyond your quota are saved as drafts.{" "}
        <a href="/docs/job-import-template.csv" className="underline" download>Download the template</a>
      </p>
      <input type="file" accept=".csv,text/csv" required className="field" />
      <button type="submit" className="btn-dark" disabled={busy}>
        {busy ? "Importing…" : "Import CSV"}
      </button>

      {error && <p className="text-sm text-oxide" role="alert">{error}</p>}

      {result && (
        <div className="rounded-md bg-bone p-3 text-sm">
          <p className="font-semibold">
            {result.summary.published} published · {result.summary.draftedOverQuota} drafted (over quota) ·{" "}
            {result.summary.skippedDuplicates} duplicates skipped · {result.summary.failed} failed
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-oxide">
              {result.errors.map((e, i) => (
                <li key={i}>Line {e.line}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
