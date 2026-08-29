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
      <body>{children}</body>
    </html>
  );
}
