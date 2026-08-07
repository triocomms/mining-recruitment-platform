"use client";

import { useState } from "react";

type Template = { id: string; name: string; body: string };

function EditableTemplate({
  template,
  onSaved,
  onDeleted,
}: {
  template: Template;
  onSaved: (t: Template) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const [body, setBody] = useState(template.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/rejection-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not save");
      return;
    }
    onSaved(data.template);
    setEditing(false);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/rejection-templates/${template.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not delete");
      return;
    }
    onDeleted(template.id);
  }

  if (!editing) {
    return (
      <li className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{template.name}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink/70">{template.body}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="btn-ghost text-xs" onClick={() => setEditing(true)}>Edit</button>
            <button type="button" className="btn-ghost text-xs text-oxide" disabled={busy} onClick={remove}>
              {busy ? "Removing…" : "Delete"}
            </button>
          </div>
        </div>
        {error && <p className="mt-1 text-xs text-oxide">{error}</p>}
      </li>
    );
  }

  return (
    <li className="card space-y-2">
      <input className="field text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
      <textarea className="field text-sm" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message sent to the candidate" />
      <div className="flex gap-2">
        <button type="button" className="btn-primary text-xs" disabled={busy || !name.trim() || !body.trim()} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => { setEditing(false); setName(template.name); setBody(template.body); setError(null); }}>
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-oxide">{error}</p>}
    </li>
  );
}

export function RejectionTemplateManager({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/rejection-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not create template");
      return;
    }
    setTemplates((prev) => [data.template, ...prev]);
    setName("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-2">
        <p className="font-semibold">New template</p>
        <input className="field text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder='Name (e.g. "Not enough site experience")' maxLength={80} />
        <textarea className="field text-sm" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message sent to the candidate" maxLength={2000} />
        <button type="button" className="btn-primary text-sm" disabled={busy || !name.trim() || !body.trim()} onClick={create}>
          {busy ? "Adding…" : "Add template"}
        </button>
        {error && <p className="text-xs text-oxide">{error}</p>}
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-ink/60">No templates yet — add one above to reuse it from the applicant pipeline.</p>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <EditableTemplate
              key={t.id}
              template={t}
              onSaved={(updated) => setTemplates((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
              onDeleted={(id) => setTemplates((prev) => prev.filter((p) => p.id !== id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
