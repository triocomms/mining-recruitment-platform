import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="font-display text-3xl uppercase tracking-wide">Contact us</h1>
      <p className="mt-2 text-sm text-ink/70">
        Questions, feedback, or something not working right? Send us a message and we&rsquo;ll reply by email.
      </p>
      <ContactForm />
    </main>
  );
}
