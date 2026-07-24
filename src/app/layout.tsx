import type { Metadata } from "next";
import { Barlow_Condensed, Archivo } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { ConsentBanner } from "@/components/ConsentBanner";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const body = Archivo({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: "FiFoDiDo — Mining & Resources Jobs Worldwide", template: "%s · FiFoDiDo" },
  description:
    "The global job board for mining and resources. FIFO, residential and international roles across gold, iron ore, lithium, copper and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Header />
        <div className="strata" aria-hidden="true" />
        <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
        <footer className="border-t border-ink/10 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-ink/60 sm:px-6">
            <div className="strata mb-6 max-w-[120px]" aria-hidden="true" />
            <p className="font-display text-lg font-semibold uppercase tracking-wide text-ink">FiFoDiDo</p>
            <p className="mt-1">Jobs across the global mining and resources industry.</p>
            <nav className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              <a href="/jobs" className="hover:text-ink">Browse jobs</a>
              <a href="/news" className="hover:text-ink">Industry news</a>
              <a href="/pricing" className="hover:text-ink">Employer pricing</a>
              <a href="/privacy" className="hover:text-ink">Privacy &amp; your data</a>
              <a href="/terms" className="hover:text-ink">Terms of Service</a>
            </nav>
          </div>
        </footer>
        <ConsentBanner />
      </body>
    </html>
  );
}
