# ◈ PASSPORT — Verifiable AI Agent Identity on Base

> **Built for the Orion Builder Hackathon** · [Live demo](https://passport-orion.vercel.app) · [GitHub](https://github.com/memeshee/passport-orion)
>
> An on-chain **identity & action-attestation layer for AI agents**, settling on **Base** via the **Ethereum Attestation Service (EAS)**.

---

## What is PASSPORT?

PASSPORT is the trust primitive the agentic-commerce era is missing. It does two things, on-chain:

1. **Mint a passport** for any AI agent — a tamper-evident EAS attestation that binds an `agentName → DID → owner wallet → scoped mandate (JSON)`. The passport UID *is* the agent's verifiable identity.
2. **Issue action receipts** — every meaningful action the agent takes emits a second EAS attestation that references the passport UID and a hash of the action payload. Anyone can verify both with a public EAS GraphQL query. No trust required.

Think of it as **TLS for agents**: passport = certificate, action receipts = signed handshake logs.

## Why does PASSPORT exist?

The agentic-commerce wave is here. **Google's AP2** (Agent Payments Protocol), **Mastercard Agent Pay**, and **Visa's Trusted Agent Protocol** all assume the same primitive — trust in the agent — and none of them ships it. Before any of these protocols can spend real money on our behalf, three questions need answers:

| Question | PASSPORT's answer |
|---|---|
| **Who is this agent?** | The passport UID on Base — tied to an owner wallet via `attester`/`recipient` |
| **Who authorized it?** | The owner wallet that signed the mint — `EAS.attest()` is the signature |
| **What did it actually do?** | Action receipts — one EAS attestation per action, payload hash included |

Every top-scoring Orion entry shows its receipt. **PASSPORT is the receipt primitive.**

## How does it work?

### Three calls, two schemas, one stack

```
┌──────────────┐    createPassport()     ┌──────────────────────────┐
│  /register   │ ───────────────────────▶│  EAS attest (passport)   │
│  (UI: Next)  │                          │  schema: agentName, did, │
└──────┬───────┘                          │  owner, agentType,       │
       │                                  │  mandateJson             │
       │ attestAction()                   └──────────────────────────┘
       ▼                                  ┌──────────────────────────┐
┌──────────────┐ ────────────────────────▶│  EAS attest (action)     │
│  /register   │                          │  refUID=passport,        │
│  (UI: Next)  │                          │  payloadHash, timestamp   │
└──────────────┘                          └──────────────────────────┘
       │                                              │
       │ verifyAttestation(uid)                       │ anyone can read
       ▼                                              ▼
┌──────────────┐                          ┌──────────────────────────┐
│   /verify    │ ───── EAS GraphQL ─────▶ │  public attestation log  │
│  (UI: Next)  │  + on-chain fallback     │  (Base Sepolia + mainnet)│
└──────────────┘                          └──────────────────────────┘
```

### Passport schema (registered on Base)
```
string agentName, string did, address owner, string agentType, string mandateJson
```

### Action schema (registered on Base)
```
bytes32 refUID, bytes32 payloadHash, uint256 timestamp
```

### Stack
**TypeScript · Next.js 14 (App Router) · ethers v6 · EAS SDK · Tailwind · Base (Sepolia + mainnet)**

### Indexer-bypass diagnostic
`/verify` does not trust the EAS GraphQL indexer blindly. When it returns `null`, the page also calls `EAS.getAttestation(uid)` directly via the v1.5 ABI (`uid, schema, time, expirationTime, revocationTime, refUID, recipient, attester, revocable, data`) and reports one of three honest states: ✓ "indexer hasn't picked it up yet", ⚠ "phantom UID — the EAS call reverted silently", or "the attestation truly does not exist on-chain". This was the only way to debug a real production issue during build.

---

## Live routes

| Path | Purpose |
|---|---|
| `/` | Landing — concept, live EAS ledger, why-it-matters grid |
| `/register` | Connect wallet → mint passport → mint action receipts → revoke on-chain |
| `/verify` | Paste any UID → decoded passport/action fields + EAScan link. Deep-link with `?uid=…&network=…` |
| `/schemas` | The two registered EAS schemas with deterministic UIDs and EAScan links per network |
| `/profile` | Portfolio — every EAS attestation where the address is attester or recipient, across Base mainnet + Sepolia. Indexer-bypass via direct `eth_getLogs` |

## Quick start

```bash
npm install
cp .env.example .env   # add a funded Base Sepolia key for the demo
npm run dev            # http://localhost:3000
```

## End-to-end demo (real on-chain)

```bash
# 1. fund a Base Sepolia wallet (https://www.alchemy.com/faucets/base-sepolia)
# 2. put its private key in .env as DEMO_PRIVATE_KEY
npm run demo
```

The demo mints a passport, emits two action receipts, and verifies them against EAS — printing real UIDs you can paste into `/verify`.

---

## Roadmap

### ✅ Shipped (hackathon scope)
- [x] Passport + action schemas registered on Base (idempotent registration, deterministic UIDs)
- [x] `/register` — full mint → action receipt → revoke flow with one wallet signature per step
- [x] `/verify` — trustless proof + ABI-decoder + indexer-bypass diagnostic (3 honest failure modes)
- [x] `/schemas` — protocol surface, public
- [x] `/profile` — agent portfolio with indexer-bypass `eth_getLogs` fallback
- [x] Deployed to Vercel — `passport-orion.vercel.app` (production build green, all routes prerendered)
- [x] End-to-end demo script — `npm run demo` runs real on-chain

### 🔜 Next 30 days (post-hackathon)
- [ ] **Wallet-less delegation** — agent receives a passport the owner mints off-chain, signs actions with a session key (EIP-7715 friendly)
- [ ] **Mandate enforcement hook** — on-chain check that an action's `payloadHash` matches the `mandateJson` policy; revert on scope violation
- [ ] **Revocation receipts** — every `revoke()` emits a third attestation (`type: revoked`) so the audit log shows the revocation event, not just the post-revocation state
- [ ] **Multi-chain attestations** — same passport schema on Optimism + Arbitrum; resolver picks cheapest network at verify-time

### 🌱 Q4 2026 → Q1 2027 (GTM)
- [ ] **AP2 / Agent Pay adapters** — drop-in middleware so any AP2-compliant agent gets a passport for free
- [ ] **SDK** — `npm i @passport-orion/sdk` with one-call `mint()` and `receipt()` for Node, browser, and Python
- [ ] **Verifiable Agents directory** — public list of every minted passport (opt-in), filterable by `agentType`, `mandateJson` schema
- [ ] **DAO governance for schema upgrades** — schema UIDs are stable, but new fields (e.g. zkKYC proof, reputation score) need a versioning process

---

## Go-to-Market

### Beachhead (hackathon → first 100 agents)
- **Orion Agent Store** — every accepted hackathon entry is auto-listed. PASSPORT's `/profile` is the natural fit for the agent-detail page; the action receipts are the audit log judges and users both want.
- **Hackathon community as reference set** — judges and partner-judges (WEEX, BingX, HuoStarter, Up10, Pivot, Noah AI) become first validators.

### Land (next 3 months)
- **x402 + agentic-commerce integrations** — AP2, Mastercard Agent Pay, Visa TAP. All three are "where is the trust primitive?" conversations. PASSPORT slots in directly.
- **Agent frameworks (Eliza, LangChain, CrewAI)** — add PASSPORT as the default identity module. Distribution through frameworks beats direct sales.
- **EAS ecosystem partnership** — co-marketing, joint grants, and shared tooling. EAS already has the schema registry; we add the agent-specific schemas.

### Expand (Q2 2027+)
- **Reputation aggregation** — passport UIDs become the public reputation layer across the agentic web. Score agents by action-receipt density, mandate-scope adherence, and revocation history.
- **Underwriting primitive** — DeFi protocols (Aave, Morpho, Compound) accept agent-managed wallets only if they carry a passport; PASSPORT becomes the KYC-of-agents.
- **Insurance products** — passport holders get on-chain SLAs backed by an insurance pool funded by the ignition fee.

### Pricing model
- **Ignition fee** (~$10 ETH at submit) covers on-chain verification of every agent, identical to the rest of the Orion platform — no hackathon surcharge.
- **SDK** — free for <1k attestations/month; usage-based above that.
- **Enterprise adapters** — paid SLA for AP2/Agent Pay integration support.

---

## Team

**kiter** — solo builder
- GitHub: [@PhiBao](https://github.com/PhiBao)
- X: [@kiter_agent](https://x.com/kiter_agent)
- Discord/Telegram: linked in profile

---

## Submission kit (Orion)
- ✅ Website / demo: https://passport-orion.vercel.app (live `/verify` proof)
- ✅ GitHub: https://github.com/memeshee/passport-orion
- ✅ X profile: @kiter_agent
- ✅ Discord/Telegram: linked in profile
- ✅ Base wallet: registered builder (ignition fee paid at submit time)

## License

MIT