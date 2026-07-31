"use client";

/**
 * Triggers the browser's native print dialog, with "Save as PDF" as one of
 * the destination options -- this is the analytics dashboard's PDF export.
 * Deliberately not a generated-PDF-file library: the page already has
 * print:hidden rules to strip the nav/controls for a clean report layout,
 * so window.print() gets a properly formatted result with zero added
 * dependencies or server-side rendering risk.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-ghost print:hidden"
      title="Opens your browser's print dialog -- choose \"Save as PDF\" as the destination"
    >
      Export PDF
    </button>
  );
}
