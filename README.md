# ◈ PASSPORT — Verifiable AI Agent Identity on Base

> **Built for the Orion Builder Hackathon**
> An on-chain **identity & action-attestation layer for AI agents**, settling on **Base** via the **Ethereum Attestation Service (EAS)**.

Agents are about to spend real money on our behalf — Google's AP2, Mastercard Agent Pay, and
Visa's Trusted Agent Protocol all assume a missing primitive: **trust**. Who is this agent, who
authorized it, and can I prove what it did? PASSPORT answers all three with **tamper-evident,
publicly verifiable attestations**.

- **① Identity** — mint a DID-backed *passport* tying `agent → owner wallet → scoped mandate`.
- **② Receipts** — every action emits an on-chain attestation referencing the passport UID.
- **③ Verify** — anyone can prove an agent's identity & actions via EAS GraphQL. No trust required.

## Why this wins
- **Verifiable by design** — every claim traces to a real on-chain attestation (the pattern the
  Orion judges reward: "show the receipt").
- **Original lane** — none of the current Orion entries do *agentic-commerce identity*.
- **On-trend** — rides the 2026 agent-payments identity wave (AP2 / DIDs / Agent Pay).
- **Deterministic & honest** — no hype; the verification step can fail loudly and that's fine.

## Stack
TypeScript · Next.js 14 (App Router) · ethers v6 · EAS SDK · Tailwind · Base (Sepolia + mainnet)

## Quick start
```bash
npm install
cp .env.example .env   # add a funded Base Sepolia key for the demo
npm run dev            # http://localhost:3000
```
- **Live demo:** https://passport-orion.vercel.app
- **GitHub:** https://github.com/memeshee/passport-orion
- **Register** (`/register`): connect a wallet, mint a passport, and — once minted — issue action receipts that reference your passport UID. The page also lets you **revoke** the passport on-chain.
- **Verify** (`/verify`): paste any passport/action UID for a trustless proof. The page also **decodes the ABI-encoded data** back into named fields (agentName, did, owner, mandateJson, …) and pretty-prints JSON mandate strings. Deep-link with `?uid=…&network=…` to auto-verify.
- **Schemas** (`/schemas`): inspect the two EAS schemas PASSPORT registers — passport and action — with their deterministic UIDs and direct EAScan links per network.

## End-to-end demo (real on-chain)
```bash
# 1. fund a Base Sepolia wallet (https://www.alchemy.com/faucets/base-sepolia)
# 2. put its private key in .env as DEMO_PRIVATE_KEY
npm run demo
```
The demo mints a passport, emits two action receipts, and verifies them against EAS — printing
real UIDs you can paste into `/verify`.

## How it works
| Step | What | On-chain artifact |
|---|---|---|
| Register | `createPassport()` | EAS attestation (schema: agentName, did, owner, agentType, mandateJson) |
| Act | `attestAction()` | EAS attestation referencing the passport UID + payload hash |
| Prove | `verifyAttestation()` | EAS GraphQL lookup (public, trustless) |

Schemas are registered idempotently per network. The passport UID is the agent's verifiable
identity; each action UID is a receipt anyone can audit.

## Submission kit (Orion)
- ✅ Website / demo: https://passport-orion.vercel.app (live `/verify` proof)
- ✅ GitHub: https://github.com/memeshee/passport-orion
- ✅ X profile: `@kiter_agent`
- ✅ Discord/Telegram: linked in profile
- ✅ Base wallet: registered builder (ignition fee paid)

## License
MIT
