import type { Metadata, Viewport } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sans = Public_Sans({ subsets: ["latin"], variable: "--sans", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--serif", display: "swap" });

export const metadata: Metadata = {
  title: "SharkWatch: check a VA claims helper before you sign",
  description: "Paste the ad, message or contract. See if the helper is VA-accredited, whether the fee follows VA rules, and where to get free help.",
};
export const viewport: Viewport = { themeColor: "#1C2A3A", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to the checker</a>
        <header className="site">
          <a href="/" className="brand">SharkWatch</a>
          <nav><a href="/how">How it works and how well</a></nav>
        </header>
        <main id="main">{children}</main>
        <footer className="site">
          <p>General information from public VA rules and VA&apos;s accreditation roster. Not legal advice. SharkWatch is not affiliated with the VA.</p>
          <p>Free, accredited help: <a href="https://www.va.gov/get-help-from-accredited-representative/find-rep/">VA&apos;s find-a-representative tool</a>. To report fraud, call the VA fraud line at 833-38V-SAFE.</p>
        </footer>
      </body>
    </html>
  );
}
