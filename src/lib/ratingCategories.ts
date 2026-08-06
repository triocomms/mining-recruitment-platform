// Shared between the server-rendered company page (src/app/companies/[slug]/page.tsx)
// and the client-side rating form (src/components/CompanyRatingForm.tsx). This file must
// NOT have "use client" -- every export from a "use client" module becomes a client
// reference, and a Server Component can't call array methods (e.g. .map()) on those.

export const RATING_CATEGORIES = [
  { key: "rosterRotation", label: "Roster & rotation" },
  { key: "accommodation", label: "Accommodation" },
  { key: "food", label: "Food" },
  { key: "downtimeFacilities", label: "Downtime & facilities" },
  { key: "travelLogistics", label: "Travel & logistics" },
  { key: "safetyCulture", label: "Safety culture" },
  ] as const;

export type CategoryKey = (typeof RATING_CATEGORIES)[number]["key"];
export type Scores = Record<CategoryKey, number>;
