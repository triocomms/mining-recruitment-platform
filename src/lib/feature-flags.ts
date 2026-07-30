/**
 * Site features that are fully built and wired up, but toggled off for
 * now. Flip a flag back to true to re-enable -- no other code changes
 * needed. Nothing here should be deleted when a feature is "turned off".
 */
export const FEATURES = {
  /**
   * Candidate "Promote Me" paid boost (top-of-search placement in the
   * employer resume database). Disabled until there's enough employer
   * search volume for the boost to be worth paying for.
   */
  promoteMe: false,

  /**
   * Homepage "Sponsored employer" placement. Currently just showcases
   * the top verified company for free -- see FeaturedEmployerAd.tsx --
   * not an actual paid product yet. Disabled until there's a real
   * sponsorship or ad-network unit to put in that slot.
   */
  featuredEmployerAd: false,
} as const;
