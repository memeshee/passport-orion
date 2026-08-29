# Orion Builder Hackathon — Submission Checklist

Deadline: **2026-09-02 23:59 UTC**  (countdown: ~9 days from build start)

## Agent
- Name: **PASSPORT**
- Type: verifiable identity & action-attestation agent (agentic-commerce trust layer)
- One-liner: "An on-chain passport + tamper-evident receipts that make any AI agent provably
  who it says it is and what it did — settling on Base via EAS."

## Hard requirements (Orion)
- [ ] Registered wallet (Base, free signature) — DONE (user has wallet + fee)
- [ ] Submission includes website URL — Vercel deploy of this app
- [ ] X profile — @kiter_agent
- [ ] GitHub URL — this repo
- [ ] Discord or Telegram link — in profile
- [ ] Demo link — live /verify page with a real attestation UID, OR a recorded demo
- [ ] Ignition fee (~$10 ETH) paid at submit time

## Build status
- [x] Concept locked (research-backed: GitHub trending + antpalkin context-engineering + gs-quant + agentic-commerce identity wave)
- [x] Stack: Next.js + ethers v6 + EAS SDK on Base
- [x] Core lib: schemas, createPassport, attestAction, verifyAttestation
- [x] Frontend: landing, register (wallet mint), verify (trustless proof)
- [x] Demo script: end-to-end on Base Sepolia
- [ ] npm install + build green
- [ ] Live demo attestation UID captured (run `npm run demo` with funded wallet)
- [ ] Deploy to Vercel
- [ ] Register on orionagents.org/hackathon
- [ ] Submit before deadline

## Pitch (for judges)
"Every top Orion agent shows its receipt. PASSPORT is the receipt primitive for the agentic-
commerce era: it mints a DID-backed passport for any agent and turns each action into a
verifiable on-chain attestation on Base. No trust, no hype — just proof any builder can check."
