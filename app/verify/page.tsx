"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { verifyAttestation, diagnoseAttestation } from "@/lib/passport";

type NetworkKey = "84532" | "8453";

/** Render a decoded schema field. Strings that look like JSON get pretty-printed,
 *  addresses get shortened, and the rest is shown as-is. */
function renderFieldValue(f: { name: string; type: string; value: any }) {
  const v = f.value;
  if (v === null || v === undefined) return <span style={{ color: "var(--ink-soft)" }}>∅</span>;
  if (f.type === "address") {
    return (
      <a
        href={`https://${f.name === "owner" ? "" : ""}sepolia.basescan.org/address/${v}`}
        target="_blank"
        rel="noreferrer"
        style={{ color: "var(--seal)" }}
      >
        {v}
      </a>
    );
  }
  if (f.type === "string") {
    // If the string is JSON, pretty-print it so the mandate is readable.
    const s = String(v);
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try {
        return <pre style={{ margin: 0, fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(JSON.parse(s), null, 2)}</pre>;
      } catch {
        /* fall through */
      }
    }
    return <span>{s || <span style={{ color: "var(--ink-soft)" }}>∅</span>}</span>;
  }
  if (f.type === "uint64" || f.type === "uint256") {
    return <span>{String(v)} ({new Date(Number(v) * 1000).toISOString().replace("T", " ").slice(0, 19)} UTC)</span>;
  }
  return <span>{String(v)}</span>;
}

export default function VerifyPage() {
  // useSearchParams() must live inside a Suspense boundary, so we render the
  // real (URL-aware) component below inside a fallback. This is the standard
  // Next.js 14 App Router pattern.
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyPageInner />
    </Suspense>
  );
}

function VerifyFallback() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">PASS<span className="dot">·</span>PORT</Link>
        <nav className="nav">
          <Link href="/register">Register</Link>
          <Link href="/verify">Verify</Link>
          <Link href="/profile">Profile</Link>
          <Link href="/schemas">Schemas</Link>
        </nav>
      </header>
      <section className="hero" style={{ paddingTop: 60 }}>
        <p className="mono" style={{ color: "var(--ink-soft)" }}>Loading…</p>
      </section>
    </div>
  );
}

function VerifyPageInner() {
  const sp = useSearchParams();
  const [uid, setUid] = useState<string>("");
  const [network, setNetwork] = useState<NetworkKey>("84532");
  const [result, setResult] = useState<any>(null);
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // If we were deep-linked with ?uid=...&network=..., pre-fill the form
  // and auto-verify so the action receipt links from /register "just work".
  useEffect(() => {
    const qUid = sp.get("uid");
    const qNet = sp.get("network") as NetworkKey | null;
    if (qNet === "84532" || qNet === "8453") setNetwork(qNet);
    if (qUid) {
      setUid(qUid);
      // schedule a verify tick on the next frame (state has settled)
      setTimeout(() => doVerify(qUid, qNet || network), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  async function doVerify(rawUid: string, net: NetworkKey) {
    const normalized = rawUid.trim().startsWith("0x") ? rawUid.trim() : "0x" + rawUid.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
      setError("That doesn't look like an attestation UID. A UID is 0x + 64 hex chars.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setDiagnostic(null);
    try {
      const res = await verifyAttestation(normalized, net);
      setResult(res);
      // If the indexer says not found, also probe the contract directly so
      // the user can see whether the attestation truly doesn't exist or
      // whether the indexer just hasn't picked it up yet.
      if (!res.valid) {
        const diag = await diagnoseAttestation(normalized, net);
        setDiagnostic(diag);
      }
    } catch (e: any) {
      setError("Verify failed: " + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!uid.trim()) {
      setError("Paste a passport or action UID (starts with 0x, 66 chars).");
      return;
    }
    await doVerify(uid, network);
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
          <Link href="/profile">Profile</Link>
          <Link href="/schemas">Schemas</Link>
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
            {!result.valid && (result as any).attestationOnNetwork && (
              <div style={{ marginTop: 12, padding: 12, background: "var(--paper)", border: "1px solid var(--seal)", borderRadius: 2 }}>
                <p style={{ fontSize: 13, color: "var(--ink)", marginBottom: 8 }}>
                  💡 We auto-checked the other network and found your attestation there. One click to verify it:
                </p>
                <button
                  className="btn"
                  style={{ fontSize: 12, padding: "8px 14px" }}
                  onClick={() => {
                    const otherNet = (result as any).attestationOnNetwork as NetworkKey;
                    setNetwork(otherNet);
                    doVerify(uid, otherNet);
                  }}
                >
                  Verify on Base {(result as any).attestationOnNetwork === "8453" ? "mainnet" : "Sepolia"} instead ↗
                </button>
              </div>
            )}

            {/* On-chain diagnostic — shown when the indexer says "not found"
                but the user wants to know if the contract storage has the
                attestation (or, for a phantom, shows the partial struct). */}
            {!result.valid && diagnostic && (
              <div style={{ marginTop: 14, padding: 12, background: "var(--paper)", border: "1px dashed var(--line)", borderRadius: 2, fontSize: 12 }}>
                <p className="kicker" style={{ marginBottom: 8 }}>On-chain diagnostic</p>
                {diagnostic.onChain ? (
                  <div>
                    <p style={{ color: "var(--moss)", marginBottom: 6 }}>
                      ✓ The EAS contract <em>does</em> hold this attestation. The indexer just hasn't picked it up yet — try again in a few seconds.
                    </p>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                      <div>attester: <span style={{ color: "var(--ink)" }}>{diagnostic.attester}</span></div>
                      <div>recipient: <span style={{ color: "var(--ink)" }}>{diagnostic.recipient}</span></div>
                      <div>time: <span style={{ color: "var(--ink)" }}>{diagnostic.time > 0 ? new Date(diagnostic.time * 1000).toISOString() : "0 (epoch)"}</span></div>
                      <div>schema: <span style={{ color: "var(--ink)" }}>{diagnostic.schema?.slice(0, 18)}…</span></div>
                    </div>
                  </div>
                ) : diagnostic.time === 0 && diagnostic.attester === "0x0000000000000000000000000000000000000000" ? (
                  <div>
                    <p style={{ color: "var(--seal)", marginBottom: 6 }}>
                      ⚠ The contract returned a default struct (attester: 0x0, time: 0). This is the canonical "phantom UID" — the EAS call likely reverted mid-flight and the SDK/wallet showed a fake success.
                    </p>
                    <p style={{ color: "var(--ink-soft)" }}>
                      → Re-mint the passport. The lib now catches this and throws a clear error.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: "var(--ink-soft)" }}>
                      The contract returned empty data for this UID. The attestation truly does not exist on-chain.
                    </p>
                  </div>
                )}
              </div>
            )}
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

            {/* Decoded schema fields — the "this attestation actually means
                something" moment. Renders for PASSPORT and ACTION attestations. */}
            {result.decoded && (
              <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <p className="kicker" style={{ marginBottom: 12 }}>
                  Decoded {result.decoded.kind === "passport" ? "passport" : "action"} fields
                </p>
                <div style={{ display: "grid", gap: 8 }}>
                  {result.decoded.fields.map((f: any) => (
                    <div key={f.name} className="mono" style={{ fontSize: 12, lineHeight: 1.45 }}>
                      <span style={{ color: "var(--seal)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{f.name}</span>
                      <span style={{ color: "var(--ink-soft)" }}> ({f.type})</span>
                      <div
                        style={{
                          color: "var(--ink)",
                          wordBreak: "break-all",
                          marginTop: 2,
                          background: "var(--paper)",
                          padding: "6px 8px",
                          borderRadius: 2,
                          border: "1px solid var(--line)",
                          fontFamily: f.type === "string" ? "Spectral, Georgia, serif" : "var(--mono)",
                        }}
                      >
                        {renderFieldValue(f)}
                      </div>
                    </div>
                  ))}
                </div>
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
