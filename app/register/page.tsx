"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { createPassport, deriveDid, PassportInput } from "@/lib/passport";

type NetworkKey = "84532" | "8453";

export default function RegisterPage() {
  const [account, setAccount] = useState<string>("");
  const [agentName, setAgentName] = useState("kiter-trader-01");
  const [agentType, setAgentType] = useState("trading");
  const [mandate, setMandate] = useState('{"maxUSD":500,"venues":["phoenix"],"revocable":true}');
  const [network, setNetwork] = useState<NetworkKey>("84532");
  const [status, setStatus] = useState<string>("");
  const [uid, setUid] = useState<string>("");
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
      // 4902 = chain not added to wallet yet. Offer to add Base / Base Sepolia.
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
    try {
      setBusy(true);
      setStatus("Requesting network switch to Base " + (network === "8453" ? "mainnet" : "Sepolia") + "…");
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      await switchNetwork();
      const signer = await provider.getSigner();
      const owner = await signer.getAddress();

      let parsedMandate = mandate;
      try { JSON.parse(mandate); } catch { setStatus("Mandate must be valid JSON."); setBusy(false); return; }

      const input: PassportInput = {
        agentName,
        owner,
        agentType,
        mandateJson: parsedMandate,
        ext: "",
      };
      setStatus("Submitting passport attestation on-chain…");
      const res = await createPassport(signer, network, input);
      setUid(res.uid);
      setStatus("PASSPORT minted! DID = " + res.did);
    } catch (e: any) {
      setStatus("Error: " + (e?.shortMessage ?? e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Register an agent passport</h1>
      <button className="btn" onClick={connect} disabled={busy}>
        {account ? "Connected ✓" : "Connect wallet"}
      </button>

      <div className="card p-5 space-y-4">
        <div>
          <label className="text-sm text-[#9a9aab]">Agent name</label>
          <input className="input mt-1" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-[#9a9aab]">Agent type</label>
          <input className="input mt-1" value={agentType} onChange={(e) => setAgentType(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-[#9a9aab]">Scoped mandate (JSON)</label>
          <textarea className="input mt-1 h-24" value={mandate} onChange={(e) => setMandate(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-[#9a9aab]">Network</label>
          <select
            className="input mt-1"
            value={network}
            onChange={(e) => setNetwork(e.target.value as NetworkKey)}
          >
            <option value="84532">Base Sepolia (testnet — recommended for demo)</option>
            <option value="8453">Base mainnet</option>
          </select>
        </div>
        <button className="btn" onClick={mint} disabled={busy || !account}>
          {busy ? "Minting…" : "Mint PASSPORT"}
        </button>
      </div>

      {uid && (
        <div className="card p-4 text-sm">
          <p className="text-[#7CFC9B] mb-1">✓ Passport UID (your receipt):</p>
          <p className="mono text-[#bcd]">{uid}</p>
          <p className="mt-2 text-[#9a9aab]">
            Copy this and paste it on the <a href="/verify" className="text-base underline">Verify</a>{" "}
            page — anyone can prove it independently via EAS.
          </p>
        </div>
      )}

      {status && <p className="text-sm text-[#9a9aab]">{status}</p>}
    </div>
  );
}
