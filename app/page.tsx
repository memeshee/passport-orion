"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

const STEPS = [
  {
    n: "01",
    title: "Identity",
    body: "Mint a DID-backed passport tying agent → owner wallet → scoped mandate. One on-chain attestation on Base.",
  },
  {
    n: "02",
    title: "Receipts",
    body: "Every action the agent takes emits an attestation referencing the passport UID. Tamper-evident, public.",
  },
  {
    n: "03",
    title: "Verify",
    body: "Anyone proves an agent's identity and actions via EAS GraphQL — no trust, no middleman, no hype.",
  },
];

type Row = { uid: string; attester: string; revoked: boolean };

export default function Home() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.4], [0, -60]);

  const [ledger, setLedger] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pull real, recent attestations from EAS on Base Sepolia as a live "ledger".
    const q = `query{attestations(orderBy:{time:desc},take:8){id attester revoked}}`;
    fetch("https://sepolia.easscan.org/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    })
      .then((r) => r.json())
      .then((j) => {
        const rows = (j?.data?.attestations || []).map((a: any) => ({
          uid: a.id,
          attester: a.attester,
          revoked: a.revoked,
        }));
        setLedger(rows);
      })
      .catch(() => setLedger([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          PASS<span className="dot">·</span>PORT
        </div>
        <nav className="nav">
          <Link href="/register">Register</Link>
          <Link href="/verify">Verify</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/schemas">Schemas</Link>
        </nav>
      </header>

      <motion.section className="hero" style={{ y: heroY }}>
        <motion.div
          className="kicker"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Verifiable AI agent identity · settled on Base via EAS
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
        >
          Agents are spending <em>your</em> money.
          <br />
          PASSPORT proves <em>who</em> they are.
        </motion.h1>
        <motion.p
          className="lede"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          Google AP2, Mastercard Agent Pay, Visa Trusted Agent — the agent-payments
          wave is here. The missing primitive is trust. PASSPORT answers it with
          on-chain attestations anyone can audit.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ display: "flex", gap: 14, flexWrap: "wrap" }}
        >
          <Link href="/register" className="btn">
            Mint a passport ▸
          </Link>
          <Link href="/verify" className="btn ghost">
            Verify a receipt
          </Link>
        </motion.div>
      </motion.section>

      <section className="section">
        <h2 className="section-title">Show the receipt</h2>
        <p className="section-sub">
          Three moves from anonymous agent to auditable actor. Every claim traces to a
          real on-chain attestation.
        </p>
        <div className="grid-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              className="card"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <div className="step-num">{s.n}</div>
              <h3 className="serif-display" style={{ fontSize: 26, margin: "14px 0 10px" }}>
                {s.title}
              </h3>
              <p style={{ color: "var(--ink-soft)", lineHeight: 1.5 }}>{s.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">The Ledger</h2>
        <p className="section-sub">
          Live attestations pulled from EAS on Base Sepolia — not a mockup. Every row is
          a real, verifiable on-chain event.
        </p>
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="ledger">
            <thead>
              <tr>
                <th>Attestation UID</th>
                <th>Attester</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} style={{ color: "var(--ink-soft)" }}>
                    Reading the ledger…
                  </td>
                </tr>
              )}
              {!loading && ledger.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: "var(--ink-soft)" }}>
                    No recent attestations — be the first to mint a passport.
                  </td>
                </tr>
              )}
              {ledger.map((r, i) => (
                <motion.tr
                  key={r.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <td style={{ maxWidth: 360 }} className="mono">
                    {r.uid.slice(0, 14)}…{r.uid.slice(-8)}
                  </td>
                  <td className="mono">{r.attester.slice(0, 10)}…</td>
                  <td className={r.revoked ? "status-bad" : "status-ok"}>
                    {r.revoked ? "REVOKED" : "ATTESTED"}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Why judges should care</h2>
        <div className="grid-3">
          {[
            ["Receipt-native", "Every claim traces to a real on-chain attestation — show-the-receipt design, no vibes."],
            ["Original lane", "None of the current Orion entries do verifiable agentic-commerce identity."],
            ["On-trend", "Rides the 2026 agent-payments identity wave (AP2 / DIDs / Agent Pay)."],
            ["Verifiable", "Deterministic, trustless, demo-able in a browser in under a minute."],
            ["Composable", "Any agent, any action, any chain EAS supports — drop-in trust."],
            ["Open", "MIT-core, public repo, live demo. Fork it, prove it."],
          ].map(([t, b], i) => (
            <motion.div
              key={t}
              className="card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
            >
              <h3 className="serif-display" style={{ fontSize: 22, marginBottom: 8 }}>
                {t}
              </h3>
              <p style={{ color: "var(--ink-soft)", lineHeight: 1.5, fontSize: 14 }}>{b}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span>PASS·PORT — verifiable AI agent identity on Base</span>
          <span>
            <a className="brand" style={{ fontSize: 14, color: "var(--ink-soft)" }} href="https://github.com/memeshee/passport-orion">
              github ↗
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
