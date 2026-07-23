export const metadata = {
  title: "Terms of Service — Orebridge",
  description: "The terms that govern use of Orebridge by candidates and employers.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl uppercase tracking-wide">Terms of Service</h1>
      <p className="mt-2 text-ink/70">
        These terms govern your use of Orebridge. By creating an account you agree to them. If
        anything here is unclear, email us before you sign up — see Contact below.
      </p>
      <p className="mt-2 text-xs text-ink/40">Last updated 22 July 2026.</p>

      <div className="strata mt-6" aria-hidden />

      <section className="mt-8 space-y-6 text-ink/85">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Who can use Orebridge</h2>
          <p className="mt-2 text-sm leading-relaxed">
            You must be at least 18 and able to form a binding contract in your jurisdiction. Employer
            accounts must represent a real, currently operating business — company profiles are subject
            to our identity (KYB) verification before certain features unlock, such as publishing news
            posts or displaying a verified badge.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Your account</h2>
          <p className="mt-2 text-sm leading-relaxed">
            You&rsquo;re responsible for the accuracy of the information you provide and for keeping your
            login secure. One account per person or company. We can suspend or close an account that
            provides false information, is used to abuse the platform, or breaches these terms.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Job ads &amp; content standards</h2>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed">
            <li>Job ads must describe a genuine, currently open role and may not request payment, banking details, or upfront fees from candidates.</li>
            <li>All listings — manually posted, CSV-imported, or RSS-synced — pass through our moderation queue and can be removed, flagged, or edited (e.g. to clear unresolved fields) if they don&rsquo;t meet these standards.</li>
            <li>Company reviews, news posts, and any other content you submit must be truthful and must not be discriminatory, harassing, or defamatory.</li>
            <li>Anyone can report a listing they believe is spam, misleading, discriminatory, or expired using the report button on that ad; we review every report.</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Content you submit</h2>
          <p className="mt-2 text-sm leading-relaxed">
            You keep ownership of what you post (job ads, resumes, company pages, reviews, news articles).
            By posting it, you give Orebridge a licence to host, display, and distribute it on the
            platform — including in search results and, for job ads, structured data feeds to job search
            engines — for as long as it stays live or as required to operate the service.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Subscriptions &amp; billing</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Employer plans are billed monthly at the price shown on our{" "}
            <a href="/pricing" className="underline">pricing page</a> at the time of purchase, in flat
            tiers rather than per click or per application. Payments are processed by Stripe — Orebridge
            never sees or stores your card details. Plans renew automatically until cancelled from your
            billing dashboard; cancelling stops the next renewal but doesn&rsquo;t refund the current period
            unless required by law.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Your data</h2>
          <p className="mt-2 text-sm leading-relaxed">
            How we collect, use, and protect personal data — and the rights you have over it — is set out
            in full in our <a href="/privacy" className="underline">Privacy Policy</a>, which forms part of
            these terms.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">No warranty &amp; limitation of liability</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Orebridge is provided &ldquo;as is.&rdquo; We moderate listings but can&rsquo;t guarantee every ad,
            application outcome, or piece of user-submitted content (including reviews and news posts) is
            accurate. To the extent permitted by law, Orebridge isn&rsquo;t liable for indirect or
            consequential losses arising from your use of the platform, and our total liability for any
            claim is limited to the amount you paid us in the twelve months before the claim arose.
            Nothing here limits liability that can&rsquo;t be excluded under Australian Consumer Law or
            equivalent local law.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Ending your account</h2>
          <p className="mt-2 text-sm leading-relaxed">
            You can delete your account at any time from your privacy dashboard. We can suspend or close an
            account for breach of these terms, with notice where practical.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Changes to these terms</h2>
          <p className="mt-2 text-sm leading-relaxed">
            We may update these terms as the product changes. We&rsquo;ll update the date at the top of this
            page when we do; continued use after a change means you accept the update.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Governing law</h2>
          <p className="mt-2 text-sm leading-relaxed">
            These terms are governed by the laws of Western Australia, Australia, without regard to
            conflict-of-law rules.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Questions about these terms? Email{" "}
            <a href="mailto:legal@orebridge.example" className="underline">legal@orebridge.example</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
