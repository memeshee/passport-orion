"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ethers } from "ethers";
import { createPassport, attestAction, revokePassport, PassportInput, ActionInput } from "@/lib/passport";

type NetworkKey = "84532" | "8453";

export default function RegisterPage() {
  const [account, setAccount] = useState<string>("");
  const [agentName, setAgentName] = useState("kiter-trader-01");
  const [agentType, setAgentType] = useState("trading");
  const [mandate, setMandate] = useState('{"maxUSD":500,"venues":["phoenix"],"revocable":true}');
  const [network, setNetwork] = useState<NetworkKey>("84532");
  const [status, setStatus] = useState<string>("");
  const [uid, setUid] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [actionName, setActionName] = useState("swap");
  const [actionTarget, setActionTarget] = useState("PHOENIX/SOL-PERP");
  const [actionPayload, setActionPayload] = useState('{"side":"long","size":1.5,"price":152.3}');
  const [actionUids, setActionUids] = useState<{ uid: string; txHash: string; action: string; target: string }[]>([]);

  async function connect() {
    if (!(window as any).ethereum) {
      setStatus("No wallet found. Install MetaMask.");
      return;
    }
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts[0]);
    setStatus("Wallet connected: " + accounts[0].slice(0, 10) + "…");
  }

  async function switchNetwork() {
    const net = network === "8453" ? 8453 : 84532;
    const hex = "0x" + net.toString(16);
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hex }],
      });
    } catch (e: any) {
      if (e?.code === 4902) {
        const addParams =
          net === 8453
            ? {
                chainId: hex,
                chainName: "Base",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              }
            : {
                chainId: hex,
                chainName: "Base Sepolia",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://sepolia.base.org"],
                blockExplorerUrls: ["https://sepolia.basescan.org"],
              };
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [addParams],
        });
      } else {
        throw e;
      }
    }
  }

  async function mint() {
    if (busy || !account) return; // guard against double-submit
    try {
      setBusy(true);
      setStatus("Switching to Base " + (network === "8453" ? "mainnet" : "Sepolia") + "…");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await switchNetwork();
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();

      let parsedMandate = mandate;
      try {
        JSON.parse(mandate);
      } catch {
        setStatus("Mandate must be valid JSON.");
        setBusy(false);
        return;
      }

      const input: PassportInput = {
        agentName,
        owner,
        agentType,
        mandateJson: parsedMandate,
        ext: "orion-register-ui",
      };
      setStatus("Submitting passport attestation on-chain… (one transaction)");
      const res = await createPassport(signer, network, input);
      setUid(res.uid);
      setTxHash(res.txHash);
      setStatus("PASSPORT minted! DID = " + res.did);
    } catch (e: any) {
      setStatus("Error: " + (e?.shortMessage ?? e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function attest() {
    if (busy || !uid) return; // guard against double-submit
    try {
      setBusy(true);
      let parsedPayload: string;
      try {
        // If the user typed valid JSON, store the canonical form; else pass through as a string.
        const obj = JSON.parse(actionPayload);
        parsedPayload = JSON.stringify(obj);
      } catch {
        parsedPayload = actionPayload;
      }
      setStatus("Switching to Base " + (network === "8453" ? "mainnet" : "Sepolia") + "…");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await switchNetwork();
      const signer = await provider.getSigner();
      setStatus(`Attesting action "${actionName}" → ${actionTarget}…`);
      const aInput: ActionInput = {
        passportUid: uid,
        action: actionName,
        target: actionTarget,
        payload: parsedPayload,
        ext: "orion-register-ui",
      };
      const r = await attestAction(signer, network, aInput);
      setActionUids((cur) => [
        ...cur,
        { uid: r.uid, txHash: "", action: actionName, target: actionTarget },
      ]);
      setStatus(`✓ Action "${actionName}" attested. payloadHash = ${r.payloadHash.slice(0, 14)}…`);
    } catch (e: any) {
      setStatus("Error: " + (e?.shortMessage ?? e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (busy || !uid) return; // guard against double-submit
    if (!window.confirm("Revoke this passport on-chain? The UID will no longer verify, and any actions referencing it become unmoored. This is irreversible.")) return;
    try {
      setBusy(true);
      setStatus("Switching to Base " + (network === "8453" ? "mainnet" : "Sepolia") + "…");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await switchNetwork();
      const signer = await provider.getSigner();
      setStatus("Submitting revoke transaction…");
      const r = await revokePassport(signer, network, uid);
      setStatus("✓ Passport revoked. Tx: " + (r.txHash ? r.txHash.slice(0, 14) + "…" : "submitted"));
    } catch (e: any) {
      setStatus("Error: " + (e?.shortMessage ?? e?.message ?? e));
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
          <Link href="/schemas">Schemas</Link>
        </nav>
      </header>

      <section className="hero" style={{ paddingTop: 60 }}>
        <div className="kicker">Mint an agent passport</div>
        <h1 style={{ fontSize: "clamp(38px,6vw,72px)" }}>
          Issue the <em>identity</em>.
        </h1>
        <p className="lede">
          Connect a wallet, define a scoped mandate, and stamp a verifiable passport
          attestation on Base. One transaction.
        </p>

        <motion.div className="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 620 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button className="btn" onClick={connect} disabled={busy}>
              {account ? "Connected ✓" : "Connect wallet"}
            </button>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              {account ? account.slice(0, 12) + "…" : "no wallet"}
            </span>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label>Agent name</label>
              <input className="input mt-1" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
            </div>
            <div>
              <label>Agent type</label>
              <input className="input mt-1" value={agentType} onChange={(e) => setAgentType(e.target.value)} />
            </div>
            <div>
              <label>Scoped mandate (JSON)</label>
              <textarea className="input mt-1 h-24" value={mandate} onChange={(e) => setMandate(e.target.value)} />
            </div>
            <div>
              <label>Network</label>
              <select
                className="input mt-1"
                value={network}
                onChange={(e) => setNetwork(e.target.value as NetworkKey)}
                disabled={busy}
              >
                <option value="84532">Base Sepolia (testnet — recommended)</option>
                <option value="8453">Base mainnet</option>
              </select>
            </div>
          </div>

          <button className="btn" onClick={mint} disabled={busy || !account} style={{ marginTop: 22, width: "100%", justifyContent: "center" }}>
            {busy ? "Minting…" : "Mint PASSPORT"}
          </button>
        </motion.div>

        {uid && (
          <>
            <motion.div className="card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1 }} style={{ maxWidth: 620, marginTop: 22 }}>
              <p className="serif-display" style={{ fontSize: 22, marginBottom: 6 }}>① Passport minted</p>
              <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 10 }}>
                This is your agent's verifiable identity — a 32-byte on-chain receipt.
              </p>
              <p className="mono" style={{ wordBreak: "break-all", color: "var(--ink)", fontSize: 13 }}>{uid}</p>
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn ghost" style={{ fontSize: 12 }} onClick={() => navigator.clipboard?.writeText(uid)}>
                  Copy UID
                </button>
                <Link className="btn ghost" style={{ fontSize: 12 }} href={`/verify?uid=${uid}&network=${network}`}>
                  Verify ↗
                </Link>
              </div>
              {txHash && (
                <p style={{ marginTop: 12, fontSize: 12 }}>
                  Tx:{" "}
                  <a className="mono" style={{ color: "var(--seal)" }} href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer">
                    {txHash.slice(0, 14)}…{txHash.slice(-8)}
                  </a>
                </p>
              )}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <p style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 10 }}>
                  Need to kill this passport? Revoke it on-chain — the UID will stop verifying and any agent holding it loses authority.
                </p>
                <button className="btn ghost" style={{ fontSize: 12, color: "var(--seal)", borderColor: "var(--seal)" }} onClick={revoke} disabled={busy}>
                  Revoke this passport
                </button>
              </div>
            </motion.div>

            <motion.div className="card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1 }} style={{ maxWidth: 620, marginTop: 22, borderColor: "var(--seal)" }}>
            <p className="serif-display" style={{ fontSize: 22, marginBottom: 6 }}>② Issue a receipt</p>
            <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 18 }}>
              Now that this agent has a passport, every action it takes should be attested.
              Mint one below — it's a second on-chain receipt that references your passport UID.
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label>Action</label>
                  <input className="input mt-1" value={actionName} onChange={(e) => setActionName(e.target.value)} placeholder="swap | post | settle" />
                </div>
                <div>
                  <label>Target</label>
                  <input className="input mt-1" value={actionTarget} onChange={(e) => setActionTarget(e.target.value)} placeholder="pair / url / address" />
                </div>
              </div>
              <div>
                <label>Payload (JSON or string)</label>
                <textarea className="input mt-1 h-20" value={actionPayload} onChange={(e) => setActionPayload(e.target.value)} />
              </div>
            </div>

            <button
              className="btn"
              onClick={attest}
              disabled={busy || !uid}
              style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
            >
              {busy ? "Attesting…" : "Attest action ▸"}
            </button>

            {actionUids.length > 0 && (
              <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                <p className="kicker" style={{ marginBottom: 10 }}>Action receipts</p>
                {actionUids.map((a, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <p className="status-ok mono" style={{ fontSize: 12, marginBottom: 2 }}>
                      ✓ {a.action} → {a.target}
                    </p>
                    <p className="mono" style={{ fontSize: 12, wordBreak: "break-all", color: "var(--ink)" }}>
                      {a.uid}
                    </p>
                    <Link href={`/verify?uid=${a.uid}&network=${network}`} style={{ fontSize: 12, color: "var(--seal)" }}>
                      Verify ↗
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
          </>
        )}

        {status && (
          <p className="mono" style={{ marginTop: 16, fontSize: 13, color: "var(--ink-soft)" }}>
            {status}
          </p>
        )}
      </section>

      <footer className="footer">
        <span>PASS·PORT — verifiable AI agent identity on Base</span>
      </footer>
    </div>
  );
}
