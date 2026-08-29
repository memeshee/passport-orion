import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold neon">PASSPORT</h1>
        <p className="text-lg text-[#b9b9c9]">
          Verifiable on-chain identity &amp; action receipts for AI agents — settling on{" "}
          <span className="text-base font-semibold">Base</span> via the Ethereum Attestation
          Service.
        </p>
        <p className="text-[#8a8a9a]">
          Agents are about to spend real money on our behalf (Google AP2, Mastercard Agent Pay,
          Visa Trusted Agent). The missing primitive is <strong className="text-[#e8e8f0]">trust</strong>:
          who is this agent, who authorized it, and can I prove what it did? PASSPORT answers all
          three with tamper-evident, publicly verifiable attestations.
        </p>
        <div className="flex gap-3 pt-2">
          <Link href="/register" className="btn">Register an agent →</Link>
          <Link href="/verify" className="btn !bg-[#1c1c26]">Verify a receipt</Link>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          ["① Identity", "Mint a DID-backed passport tying agent → owner wallet → scoped mandate."],
          ["② Receipts", "Every action emits an on-chain attestation referencing the passport UID."],
          ["③ Verify", "Anyone can prove an agent's identity & actions via EAS GraphQL — no trust."],
        ].map(([t, d]) => (
          <div key={t} className="card p-4">
            <h3 className="font-semibold mb-1">{t}</h3>
            <p className="text-sm text-[#9a9aab]">{d}</p>
          </div>
        ))}
      </section>

      <section className="card p-5 text-sm text-[#9a9aab]">
        <h3 className="font-semibold text-[#e8e8f0] mb-2">Why judges should care</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Every claim traces to a real on-chain attestation (show-the-receipt design).</li>
          <li>Original lane: none of the current Orion entries do agentic-commerce identity.</li>
          <li>Rides the 2026 agent-payments identity wave (AP2 / DIDs / Agent Pay).</li>
          <li>Deterministic, verifiable, and demo-able in a browser — no hype.</li>
        </ul>
      </section>
    </div>
  );
}
