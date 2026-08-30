"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ethers } from "ethers";
import {
  fetchProfileAllNetworks,
  fetchProfileFromChain,
  hydrateFromChain,
  ProfileAttestation,
  DecodedField,
} from "@/lib/passport";

function ProfileInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initial = sp.get("address") ?? "";
  const [address, setAddress] = useState(initial);
  const [connectedAddr, setConnectedAddr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ProfileAttestation[]>([]);
  const [filter, setFilter] = useState<"all" | "passport" | "action">("all");
  const [copied, setCopied] = useState<string | null>(null);

  // Auto-load from query param
  useEffect(() => {
    if (initial && ethers.isAddress(initial)) {
      void doFetch(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Try to grab the connected wallet (so the "Use my wallet" button can fill in)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w: any = (window as any).ethereum;
    if (!w?.request) return;
    w.request({ method: "eth_accounts" })
      .then((accs: string[]) => setConnectedAddr(accs?.[0] ?? ""))
      .catch(() => {});
  }, []);

  async function doFetch(addr: string) {
    setError("");
    setBusy(true);
    setItems([]);
    try {
      // Try the EAS indexer first (fast, has data + decoded fields)
      let r = await fetchProfileAllNetworks(addr);
      // If the indexer returned nothing, fall back to a direct chain scan
      // so the user sees their attestations even if the indexer is lagging.
      if (r.length === 0) {
        try {
          const chainSepolia = await fetchProfileFromChain(addr, "84532");
          const chainMainnet = await fetchProfileFromChain(addr, "8453");
          r = [...chainSepolia, ...chainMainnet];
          if (r.length > 0) {
            // Hydrate the partial results with the on-chain data blob
            // so the UI shows real agentName, did, owner, etc. — not "?".
            await hydrateFromChain(r);
            setItems(r);
            setError(
              "These attestations were found by scanning the chain directly. The EAS indexer is lagging — the data shown is fully on-chain and authoritative."
            );
            return;
          }
        } catch {
          /* chain scan failed (RPC throttle, etc) — keep the indexer result */
        }
      } else {
        // Indexer returned results, but they may not have decoded data
        // (e.g. for non-standard schemas). Try to hydrate any partial ones
        // so the cards show as much detail as possible.
        await hydrateFromChain(r);
      }
      setItems(r);
      if (r.length === 0) {
        setError("No EAS attestations found for this address on Base mainnet or Base Sepolia yet. Mint a passport on /register to get started.");
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ethers.isAddress(address)) {
      setError("Invalid address. Expected 0x…");
      return;
    }
    router.replace(`/profile?address=${address}`);
    void doFetch(address);
  }

  function useMyWallet() {
    if (!connectedAddr) {
      setError("No wallet connected. Open a wallet extension and connect first.");
      return;
    }
    setAddress(connectedAddr);
    router.replace(`/profile?address=${connectedAddr}`);
    void doFetch(connectedAddr);
  }

  function copy(uid: string) {
    navigator.clipboard?.writeText(uid);
    setCopied(uid);
    setTimeout(() => setCopied(null), 1500);
  }

  const filtered = items.filter((x) => filter === "all" ? true : x.kind === filter);
  const passportCount = items.filter((x) => x.kind === "passport").length;
  const actionCount = items.filter((x) => x.kind === "action").length;
  const networkSet = new Set(items.map((x) => x.network));

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
        <h1 className="title">
          Agent <span className="accent">Profile</span>
        </h1>
        <p className="lede">
          Every EAS attestation where this address is the attester or recipient —
          passports, action receipts, and any third-party schemas.
        </p>

        <form onSubmit={submit} className="form" style={{ maxWidth: 720, marginTop: 24 }}>
          <div className="field">
            <label className="label">Wallet address</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="0x…"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{ flex: 1, fontFamily: "monospace" }}
              />
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? "Loading…" : "Fetch"}
              </button>
              {connectedAddr && (
                <button type="button" className="btn" onClick={useMyWallet}>
                  Use my wallet
                </button>
              )}
            </div>
            {connectedAddr && (
              <div className="hint" style={{ marginTop: 4 }}>
                Connected: <code>{connectedAddr.slice(0, 8)}…{connectedAddr.slice(-6)}</code>
              </div>
            )}
          </div>
        </form>

        {error && (
          <div className="alert" style={{ marginTop: 16, color: "var(--ink-2)" }}>{error}</div>
        )}

        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}
          >
            <span className="pill">Total: {items.length}</span>
            <span className="pill" style={{ background: "var(--paper)" }}>Passports: {passportCount}</span>
            <span className="pill" style={{ background: "var(--paper)" }}>Actions: {actionCount}</span>
            <span className="pill" style={{ background: "var(--paper)" }}>
              Networks: {[...networkSet].map((n) => n === "8453" ? "mainnet" : "Sepolia").join(", ")}
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                type="button"
                className={filter === "all" ? "btn primary" : "btn"}
                onClick={() => setFilter("all")}
              >All</button>
              <button
                type="button"
                className={filter === "passport" ? "btn primary" : "btn"}
                onClick={() => setFilter("passport")}
              >Passports</button>
              <button
                type="button"
                className={filter === "action" ? "btn primary" : "btn"}
                onClick={() => setFilter("action")}
              >Actions</button>
            </div>
          </motion.div>
        )}
      </section>

      <section className="grid" style={{ marginTop: 24 }}>
        <AnimatePresence>
          {filtered.map((it) => (
            <AttestationCard
              key={it.uid}
              item={it}
              copied={copied === it.uid}
              onCopy={() => copy(it.uid)}
            />
          ))}
        </AnimatePresence>
      </section>

      <footer className="footer">
        <Link href="/">← Back home</Link>
      </footer>
    </div>
  );
}

function AttestationCard({
  item,
  copied,
  onCopy,
}: {
  item: ProfileAttestation;
  copied: boolean;
  onCopy: () => void;
}) {
  const isPassport = item.kind === "passport";
  const accent = isPassport ? "var(--seal)" : "var(--accent)";
  const title = isPassport ? "PASSPORT" : item.kind === "action" ? "ACTION RECEIPT" : "OTHER ATTESTATION";
  const issued = new Date(item.time * 1000).toLocaleString();

  // Pull a few friendly fields from the decoded data for the card subtitle.
  // When the data hasn't been decoded yet (chain-scan fallback path), the
  // decoded array may be null. Show a friendly "(data pending)" hint
  // instead of "?" so the user knows we're working on it.
  const byField = (name: string): string | null => {
    const f = item.decoded?.find((d) => d.name === name);
    return f ? String(f.value) : null;
  };
  const hasDecoded = !!item.decoded && item.decoded.length > 0;
  const subtitle = !hasDecoded
    ? `on-chain (full data loading…)`
    : isPassport
    ? `${byField("agentName") ?? "?"} · DID ${byField("did") ?? "?"}`
    : item.kind === "action"
    ? `${byField("action") ?? "?"} → ${byField("target") ?? "?"}`
    : `schema ${item.schemaId.slice(0, 10)}…`;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="card"
      style={{ borderColor: accent }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          className="pill"
          style={{ background: accent, color: "white", fontWeight: 600 }}
        >
          {title}
        </span>
        {item.revoked && (
          <span className="pill" style={{ background: "#a33", color: "white" }}>REVOKED</span>
        )}
        <span
          className="pill"
          style={{
            background: "var(--paper-2)",
            color: "var(--ink-2)",
            border: "1px solid var(--line)",
            fontWeight: 500,
          }}
        >
          {item.network === "8453" ? "mainnet" : "Sepolia"}
        </span>
      </div>
      <div style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 8 }}>{subtitle}</div>
      <div
        onClick={onCopy}
        title="Click to copy"
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          wordBreak: "break-all",
          padding: 8,
          background: "var(--paper)",
          border: "1px solid var(--line)",
          borderRadius: 6,
          cursor: "pointer",
          marginBottom: 8,
        }}
      >
        {copied ? "✓ Copied" : item.uid}
      </div>
      {isPassport && item.decoded && (
        <ul style={{ fontSize: 12, color: "var(--ink-2)", listStyle: "none", padding: 0, margin: 0 }}>
          {item.decoded.slice(0, 5).map((d) => (
            <li key={d.name} style={{ marginBottom: 2 }}>
              <strong style={{ color: "var(--ink)" }}>{d.name}:</strong>{" "}
              <span style={{ fontFamily: "monospace" }}>{String(d.value)}</span>
            </li>
          ))}
        </ul>
      )}
      {item.kind === "action" && item.decoded && (
        <ul style={{ fontSize: 12, color: "var(--ink-2)", listStyle: "none", padding: 0, margin: 0 }}>
          <li><strong>passportUid:</strong> <Link href={`/verify?uid=${byField("passportUid")}`} style={{ fontFamily: "monospace" }}>{(byField("passportUid") ?? "").slice(0, 18)}…</Link></li>
          <li><strong>timestamp:</strong> {byField("timestamp")}</li>
          <li><strong>ext:</strong> {byField("ext")}</li>
        </ul>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, fontSize: 12 }}>
        <Link className="btn" href={`/verify?uid=${item.uid}`} style={{ padding: "4px 10px", fontSize: 12 }}>
          Verify
        </Link>
        <a
          className="btn"
          href={item.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: "4px 10px", fontSize: 12 }}
        >
          EAScan ↗
        </a>
        <span style={{ marginLeft: "auto", color: "var(--ink-3)", alignSelf: "center" }}>
          {issued}
        </span>
      </div>
    </motion.article>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="shell">
        <header className="topbar">
          <Link href="/" className="brand">PASS<span className="dot">·</span>PORT</Link>
        </header>
        <section className="hero"><div className="title">Profile</div><p>Loading…</p></section>
      </div>
    }>
      <ProfileInner />
    </Suspense>
  );
}
