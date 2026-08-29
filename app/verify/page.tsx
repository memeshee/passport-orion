"use client";

import { useState } from "react";
import { verifyAttestation } from "@/lib/passport";

type NetworkKey = "84532" | "8453";

export default function VerifyPage() {
  const [uid, setUid] = useState("");
  const [network, setNetwork] = useState<NetworkKey>("84532");
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (!uid.trim()) { setError("Paste a passport or action UID."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await verifyAttestation(uid.trim(), network);
      setResult(res);
    } catch (e: any) {
      setError("Verify failed: " + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Verify an attestation</h1>
      <p className="text-[#9a9aab] text-sm">
        Paste a PASSPORT UID (agent identity) or an action receipt UID. Verification is a
        trustless lookup against the EAS GraphQL endpoint — anyone can run it.
      </p>

      <div className="card p-5 space-y-4">
        <div>
          <label className="text-sm text-[#9a9aab]">Attestation UID</label>
          <input className="input mt-1 mono" placeholder="0x…" value={uid} onChange={(e) => setUid(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-[#9a9aab]">Network</label>
          <select className="input mt-1" value={network} onChange={(e) => setNetwork(e.target.value as NetworkKey)}>
            <option value="84532">Base Sepolia</option>
            <option value="8453">Base mainnet</option>
          </select>
        </div>
        <button className="btn" onClick={verify} disabled={busy}>
          {busy ? "Verifying…" : "Verify"}
        </button>
      </div>

      {error && <p className="text-sm text-[#ff8080]">{error}</p>}

      {result && (
        <div className={`card p-4 text-sm ${result.valid ? "border-[#1f7a3f]" : "border-[#7a1f1f]"}`}>
          <p className={result.valid ? "text-[#7CFC9B] font-semibold" : "text-[#ff8080] font-semibold"}>
            {result.valid ? "✓ VALID — " : "✗ INVALID — "}{result.reason}
          </p>
          {result.attestation && (
            <pre className="mono text-[#9a9aab] mt-2 whitespace-pre-wrap text-xs">
              {JSON.stringify(result.attestation, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
