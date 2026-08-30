# Orion Builder Hackathon — Submission Checklist

Deadline: **2026-09-02 23:59 UTC**  (countdown: ~3 days from last build)

## Agent
- Name: **PASSPORT**
- Type: verifiable identity & action-attestation agent (agentic-commerce trust layer)
- One-liner: "An on-chain passport + tamper-evident receipts that make any AI agent provably
  who it says it is and what it did — settling on Base via EAS."

## Hard requirements (Orion)
- [x] Registered wallet (Base, free signature) — done (user has wallet + fee)
- [x] Submission includes website URL — https://passport-orion.vercel.app
- [x] X profile — @kiter_agent
- [x] GitHub URL — https://github.com/memeshee/passport-orion
- [x] Discord or Telegram link — in profile
- [x] Demo link — live `/verify` page with real attestations on Base Sepolia
      (try the deep-link from `/register` action receipts, or paste any passport/action UID)
- [ ] Ignition fee (~$10 ETH) paid at submit time

## Build status
- [x] Concept locked (research-backed: GitHub trending + antpalkin context-engineering + gs-quant + agentic-commerce identity wave)
- [x] Stack: Next.js 14 App Router + ethers v6 + EAS SDK on Base (Sepolia + mainnet)
- [x] Core lib: `lib/eas.ts` + `lib/passport.ts` — `createPassport`, `attestAction`, `revokePassport`, `verifyAttestation` (with on-the-fly ABI decode for our two schemas)
- [x] Frontend: landing, `/register` (mint passport → mint action receipt → revoke), `/verify` (trustless proof + decoder), `/schemas` (the protocol itself, with EAScan links)
- [x] Demo script: end-to-end on Base Sepolia (`npm run demo`)
- [x] Production build green (all 5 routes statically rendered)
- [x] EAS schemas registered on-chain (idempotent registration, deterministic UIDs)
- [x] Deployed to Vercel — `passport-orion.vercel.app` aliased to the latest build
- [ ] Register on orionagents.org/hackathon
- [ ] Submit before deadline

## Routes (live at https://passport-orion.vercel.app)
| Path | What it does |
|---|---|
| `/` | Landing — concept, live EAS ledger, why-it-matters grid |
| `/register` | Connect wallet → mint passport → mint action receipts → revoke on-chain |
| `/verify` | Paste any UID → see the decoded passport/action fields + EAScan link. Deep-link with `?uid=…&network=…` |
| `/schemas` | The two registered EAS schemas with their UIDs and EAScan links per network |
| `/profile` | Agent's portfolio — every EAS attestation where the address is attester or recipient, across Base mainnet and Base Sepolia. Falls back to direct on-chain `eth_getLogs` scan when the EAS indexer is lagging. Deep-link with `?address=0x…` |

## Pitch (for judges)
"Every top Orion agent shows its receipt. PASSPORT is the receipt primitive for the agentic-
commerce era: it mints a DID-backed passport for any agent and turns each action into a
verifiable on-chain attestation on Base. No trust, no hype — just proof any builder can check."

## Recent upgrades (round 2)
- **Action receipts in `/register`** — judges can complete the full mint → receipt → verify flow in one session.
- **`/verify` decodes ABI-encoded data** back into named fields (agentName, did, owner, mandate, payloadHash, timestamp) and pretty-prints JSON mandate strings. Deep-link via `?uid=…&network=…` for auto-verify.
- **Interactive revoke** — the "revocable: true" promise is no longer just JSON; the UI calls `EAS.revoke()`.
- **`/schemas` page** — judges can inspect the protocol itself, with deterministic UIDs and EAScan links.
- **`/profile` portfolio page (round 3)** — the place to "gather your passports". Fetches every EAS attestation where the address is the attester or recipient across both Base networks, dedupes by UID, classifies as passport/action/other, decodes the data field, and renders a card per attestation with copy/verify/EAScan links. Falls back to direct `eth_getLogs` scan of the EAS contract when the EAS GraphQL indexer is lagging (which is the common case — the indexer is currently minutes-behind the chain for fresh mints).
- **Indexer-bypass + on-chain diagnostic** — `/verify` no longer relies on the EAS indexer alone. When the indexer returns `null`, the page also calls `EAS.getAttestation(uid)` directly via the correct v1.5 ABI and shows one of three messages: ✓ "indexer just hasn't picked it up yet", ⚠ "phantom UID — the EAS call reverted silently", or "the attestation truly does not exist on-chain".
- **EAS v1.5 ABI fix** — ethers v6 returns Result objects with numeric indices only when you pass a tuple ABI string. The lib now uses `att[2]` (time) and `att[7]` (attester) on the v1.5 struct order: `uid, schema, time, expirationTime, revocationTime, refUID, recipient, attester, revocable, data`.
- **EAS bug fix** — `lib/eas.ts:66` `owner` type corrected from `bytes32` to `address` (the SDK was throwing `Incompatible param type: bytes32` on every mint).
- **Build hardening** — `useSearchParams` wrapped in Suspense boundary (Next 14 requirement).
