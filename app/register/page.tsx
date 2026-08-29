"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ethers } from "ethers";
import { createPassport, PassportInput } from "@/lib/passport";

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
        ext: "",
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
          <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: 620, marginTop: 22 }}>
            <p className="status-ok" style={{ marginBottom: 6 }}>✓ Passport UID (your receipt):</p>
            <p className="mono" style={{ wordBreak: "break-all", color: "var(--ink)" }}>{uid}</p>
            <button className="btn ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => navigator.clipboard?.writeText(uid)}>
              Copy UID
            </button>
            {txHash && (
              <p style={{ marginTop: 12, fontSize: 13 }}>
                Tx:{" "}
                <a className="mono" style={{ color: "var(--seal)" }} href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer">
                  {txHash.slice(0, 14)}…{txHash.slice(-8)}
                </a>
              </p>
            )}
            <p style={{ marginTop: 10, fontSize: 13, color: "var(--ink-soft)" }}>
              This is a 32-byte attestation UID (0x…). Paste it on{" "}
              <Link href="/verify" style={{ color: "var(--seal)" }}>Verify</Link> with the same network to prove it.
            </p>
          </motion.div>
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
