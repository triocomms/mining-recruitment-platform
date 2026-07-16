export const metadata = {
  title: "Privacy — Orebridge",
  description: "How Orebridge collects, uses, and protects your personal data, and how to exercise your rights.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl uppercase tracking-wide">Privacy at Orebridge</h1>
      <p className="mt-2 text-ink/70">
        Job seeking involves some of your most sensitive information. Here is exactly how we handle
        it, in plain language. This summary complements our full policy and applies globally,
        including under GDPR (EU/UK), CCPA (California), and the Australian Privacy Act.
      </p>

      <div className="strata mt-6" aria-hidden />

      <section className="mt-8 space-y-6 text-ink/85">
        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">What we collect</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Account details (name, email), the profile information you choose to add (resume, work
            history, certifications, location and work preferences), your applications and messages
            on the platform, and consent records. For employers, we also collect business
            verification documents. We collect only what the product needs — no data brokering, no
            selling of personal information, ever.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Who can see your profile</h2>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed">
            <li>
              <strong>Private (default):</strong> only companies you apply to can see your details,
              and only in the context of that application.
            </li>
            <li>
              <strong>Open to verified employers (opt-in):</strong> signed-in, identity-verified
              employers can find you in the resume database. Your profile is <em>never</em> shown to
              anonymous visitors, and all candidate pages carry a <code className="font-mono text-xs">noindex</code>{" "}
              header so search engines cannot index them.
            </li>
          </ul>
          <p className="mt-2 text-sm leading-relaxed">
            Switching visibility is recorded in an auditable consent log you can view any time, and
            you can switch back whenever you like.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Your rights & self-service controls</h2>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed">
            <li><strong>Access & portability:</strong> download a complete JSON export of your data from your privacy dashboard, instantly.</li>
            <li><strong>Erasure:</strong> delete your account yourself — profile, files, applications and bookmarks are permanently removed, and your messages to others are redacted.</li>
            <li><strong>Rectification:</strong> edit any profile field at any time.</li>
            <li><strong>Consent withdrawal:</strong> marketing emails and profile visibility are opt-in and reversible, with every change logged.</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Storage & security</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Files (resumes, photos, documents) are stored in private object storage and served only
            through short-lived signed links after an authorization check — there are no public file
            URLs. Passwords are hashed with bcrypt. Payment card details never touch our servers;
            billing is handled by Stripe.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Cookies</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Essential cookies keep you signed in. Analytics cookies are used only if you accept them
            in the consent banner, and you can decline with one tap without losing any functionality.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl uppercase tracking-wide">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Questions or requests we haven&rsquo;t automated yet? Email{" "}
            <a href="mailto:privacy@orebridge.example" className="underline">privacy@orebridge.example</a>.
            We respond to all data-rights requests within 30 days as required by law — usually much faster.
          </p>
        </div>
      </section>
    </main>
  );
}
