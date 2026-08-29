import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "PASSPORT — Verifiable AI Agent Identity on Base",
  description:
    "PASSPORT mints a DID-backed on-chain identity and tamper-evident action receipts for AI agents, settling on Base via EAS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c26]">
          <Link href="/" className="font-mono font-bold text-lg neon text-base">
            ◈ PASSPORT
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/register" className="hover:text-base">Register</Link>
            <Link href="/verify" className="hover:text-base">Verify</Link>
          </nav>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-10">{children}</main>
        <footer className="text-center text-xs text-[#555] py-8">
          Built for the Orion Builder Hackathon · settles on Base via Ethereum Attestation Service
        </footer>
      </body>
    </html>
  );
}
