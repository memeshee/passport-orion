"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { verifyAttestation } from "@/lib/passport";

type NetworkKey = "84532" | "8453";

export default function VerifyPage() {
  const [uid, setUid] = useState<string>("");
  const [network, setNetwork] = useState<NetworkKey>("84532");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    const raw = uid.trim();
    if (!raw) {
      setError("Paste a passport or action UID (starts with 0x, 66 chars).");
      return;
    }
    const normalized = raw.startsWith("0x") ? raw : "0x" + raw;
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
      setError(
        "That doesn't look like an attestation UID. A UID is 0x + 64 hex chars. The agent name (kiter-trader-01) or a random hash won't work — copy the UID shown right after you mint a passport."
      );
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await verifyAttestation(normalized, network);
      setResult(res);
    } catch (e: any) {
      setError("Verify failed: " + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const explorerBase = network === "8453" ? "https://basescan.org" : "https://sepolia.basescan.org";

  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          PASS<span className="dot">·</span>PORT
        </Link>
        <nav className="nav">
          <Link href="/register">Register</Link>
          <Link href="/verify">Verify</Link>
        </nav>
      </header>

      <section className="hero" style={{ paddingTop: 60 }}>
        <div className="kicker">Trustless verification</div>
        <h1 style={{ fontSize: "clamp(38px,6vw,72px)" }}>
          Prove the <em>receipt</em>.
        </h1>
        <p className="lede">
          Paste any passport or action UID. Verification is a lookup against the EAS
          GraphQL endpoint — anyone can run it, no trust required.
        </p>

        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 620 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label>Attestation UID</label>
              <input
                className="input mt-1 mono"
                placeholder="0x… (66 chars)"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
              />
            </div>
            <div>
              <label>Network</label>
              <select className="input mt-1" value={network} onChange={(e) => setNetwork(e.target.value as NetworkKey)}>
                <option value="84532">Base Sepolia</option>
                <option value="8453">Base mainnet</option>
              </select>
            </div>
          </div>
          <button className="btn" onClick={verify} disabled={busy} style={{ marginTop: 22, width: "100%", justifyContent: "center" }}>
            {busy ? "Verifying…" : "Verify"}
          </button>
        </motion.div>

        {error && (
          <p className="mono" style={{ marginTop: 16, fontSize: 13, color: "var(--seal)", maxWidth: 620 }}>
            {error}
          </p>
        )}

        {result && (
          <motion.div
            className="card"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ maxWidth: 620, marginTop: 22, borderColor: result.valid ? "var(--moss)" : "var(--seal)" }}
          >
            <p className={result.valid ? "status-ok" : "status-bad"} style={{ fontWeight: 600 }}>
              {result.valid ? "✓ VALID — " : "✗ INVALID — "}
              {result.reason}
            </p>
            {result.attestation && (
              <div className="mono" style={{ marginTop: 14, fontSize: 13, color: "var(--ink-soft)" }}>
                <div>
                  UID: <span style={{ color: "var(--ink)" }}>{result.attestation.id}</span>
                </div>
                <div>
                  Schema: <span style={{ color: "var(--ink)" }}>{result.attestation.schemaId?.slice(0, 18)}…</span>
                </div>
                <div>
                  Attester: <span style={{ color: "var(--ink)" }}>{result.attestation.attester}</span>
                </div>
                <div>
                  Recipient: <span style={{ color: "var(--ink)" }}>{result.attestation.recipient}</span>
                </div>
                <div>
                  Revocable: <span style={{ color: "var(--ink)" }}>{String(result.attestation.revocable)}</span>
                </div>
                <a
                  className="mono"
                  style={{ color: "var(--seal)", display: "inline-block", marginTop: 8 }}
                  href={`https://${network === "8453" ? "easscan" : "sepolia.easscan"}.org/attestation/view/${result.attestation.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on EAS scan ↗
                </a>
              </div>
            )}
          </motion.div>
        )}
      </section>

      <footer className="footer">
        <span>PASS·PORT — verifiable AI agent identity on Base</span>
      </footer>
    </div>
  );
}
