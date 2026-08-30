"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PASSPORT_SCHEMA, ACTION_SCHEMA, SCHEMA_UIDS, NetworkKey } from "@/lib/eas";

const NETWORKS: { key: NetworkKey; label: string; eascan: string; explorer: string }[] = [
  { key: "84532", label: "Base Sepolia", eascan: "sepolia.easscan.org", explorer: "sepolia.basescan.org" },
  { key: "8453", label: "Base mainnet", eascan: "easscan.org", explorer: "basescan.org" },
];

export default function SchemasPage() {
  const [copied, setCopied] = useState<string | null>(null);

  function copy(uid: string) {
    navigator.clipboard?.writeText(uid);
    setCopied(uid);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          PASS<span className="dot">·</span>PORT
        </Link>
        <nav className="nav">
          <Link href="/register">Register</Link>
          <Link href="/verify">Verify</Link>
          <Link href="/schemas">Schemas</Link>
        </nav>
      </header>

      <section className="hero" style={{ paddingTop: 60 }}>
        <div className="kicker">EAS schemas · the source of truth</div>
        <h1 style={{ fontSize: "clamp(38px,6vw,72px)" }}>
          The <em>schemas</em> behind every passport.
        </h1>
        <p className="lede">
          PASSPORT defines two on-chain EAS schemas — one for an agent's identity
          (the passport), one for its actions (the receipts). These are registered
          idempotently per network and referenced by UID from every attestation.
          Inspect them live on EAS scan.
        </p>
      </section>

      <section className="section">
        {NETWORKS.map((net) => (
          <div key={net.key} style={{ marginBottom: 40 }}>
            <h2 className="section-title" style={{ fontSize: 28 }}>{net.label}</h2>
            <p className="section-sub" style={{ fontSize: 14 }}>
              Schema UIDs are deterministic: <code className="mono">keccak256(schemaString, resolver, revocable)</code>.
              The same string always resolves to the same UID across networks.
            </p>

            <motion.div
              className="card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <p className="serif-display" style={{ fontSize: 20, marginBottom: 6 }}>PASSPORT schema</p>
              <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 12 }}>
                Identity attestation: <code className="mono">agent → owner → mandate</code>.
              </p>
              <pre className="mono" style={{
                fontSize: 12,
                background: "var(--paper)",
                padding: 12,
                border: "1px solid var(--line)",
                borderRadius: 2,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}>{PASSPORT_SCHEMA}</pre>

              <p className="kicker" style={{ marginTop: 16, marginBottom: 6 }}>Schema UID</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <code className="mono" style={{ fontSize: 13, color: "var(--ink)", wordBreak: "break-all" }}>
                  {SCHEMA_UIDS[net.key].passport}
                </code>
                <button className="btn ghost" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => copy(SCHEMA_UIDS[net.key].passport)}>
                  {copied === SCHEMA_UIDS[net.key].passport ? "Copied ✓" : "Copy"}
                </button>
                <a className="btn ghost" style={{ fontSize: 11, padding: "6px 10px" }}
                   href={`https://${net.eascan}/schema/view/${SCHEMA_UIDS[net.key].passport}`}
                   target="_blank" rel="noreferrer">
                  View on EAS scan ↗
                </a>
              </div>
            </motion.div>

            <motion.div
              className="card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{ marginTop: 18 }}
            >
              <p className="serif-display" style={{ fontSize: 20, marginBottom: 6 }}>ACTION schema</p>
              <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 12 }}>
                Action receipt: <code className="mono">passportUid → action → target → payloadHash → timestamp</code>.
              </p>
              <pre className="mono" style={{
                fontSize: 12,
                background: "var(--paper)",
                padding: 12,
                border: "1px solid var(--line)",
                borderRadius: 2,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}>{ACTION_SCHEMA}</pre>

              <p className="kicker" style={{ marginTop: 16, marginBottom: 6 }}>Schema UID</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <code className="mono" style={{ fontSize: 13, color: "var(--ink)", wordBreak: "break-all" }}>
                  {SCHEMA_UIDS[net.key].action}
                </code>
                <button className="btn ghost" style={{ fontSize: 11, padding: "6px 10px" }} onClick={() => copy(SCHEMA_UIDS[net.key].action)}>
                  {copied === SCHEMA_UIDS[net.key].action ? "Copied ✓" : "Copy"}
                </button>
                <a className="btn ghost" style={{ fontSize: 11, padding: "6px 10px" }}
                   href={`https://${net.eascan}/schema/view/${SCHEMA_UIDS[net.key].action}`}
                   target="_blank" rel="noreferrer">
                  View on EAS scan ↗
                </a>
              </div>
            </motion.div>
          </div>
        ))}
      </section>

      <section className="section">
        <h2 className="section-title">Why this matters</h2>
        <p className="section-sub" style={{ fontSize: 14, maxWidth: 700 }}>
          The schemas ARE the protocol. Because they're registered on EAS — a
          public, censorship-resistant attestation layer — anyone can read them,
          reference them, or fork PASSPORT without asking permission. The UIDs
          are deterministic, so the same schemas will resolve to the same UIDs
          on every EAS-supported chain. That's the "show the receipt" primitive
          made composable.
        </p>
      </section>

      <footer className="footer">
        <span>PASS·PORT — verifiable AI agent identity on Base</span>
      </footer>
    </div>
  );
}
