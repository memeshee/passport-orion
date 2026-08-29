import { ethers } from "ethers";
import {
  createPassport,
  attestAction,
  verifyAttestation,
  PassportInput,
  ActionInput,
} from "../lib/passport";
import { NetworkKey } from "../lib/eas";

/**
 * End-to-end demo:
 *  1. Mint a PASSPORT (agent identity) on Base Sepolia
 *  2. Emit two action receipts referencing that passport
 *  3. Verify the passport + an action against EAS (public, trustless)
 *
 * Requires: a funded testnet wallet in .env (DEMO_PRIVATE_KEY) and testnet ETH
 * from https://www.alchemy.com/faucets/base-sepolia
 */
async function main() {
  const pk = process.env.DEMO_PRIVATE_KEY;
  if (!pk || pk.startsWith("0x0000")) {
    throw new Error("Set DEMO_PRIVATE_KEY in .env (Base Sepolia funded wallet).");
  }
  const network = (process.env.NETWORK || "84532") as NetworkKey;
  const rpc =
    network === "8453"
      ? process.env.BASE_MAINNET_RPC!
      : process.env.BASE_SEPOLIA_RPC!;

  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = new ethers.Wallet(pk, provider);
  console.log("Demo agent owner:", await signer.getAddress());

  // 1. Passport
  const pInput: PassportInput = {
    agentName: "demo-trader",
    owner: await signer.getAddress(),
    agentType: "trading",
    mandateJson: JSON.stringify({ maxUSD: 500, venues: ["phoenix"], revocable: true }),
    ext: "orion-hackathon-demo",
  };
  console.log("\n→ Minting PASSPORT…");
  const passport = await createPassport(signer, network, pInput);
  console.log("  PASSPORT UID:", passport.uid);
  console.log("  DID:", passport.did);

  // 2. Action receipts
  const actions: ActionInput[] = [
    {
      passportUid: passport.uid,
      action: "swap",
      target: "PHOENIX/SOL-PERP",
      payload: JSON.stringify({ side: "long", size: 1.5, price: 152.3 }),
    },
    {
      passportUid: passport.uid,
      action: "settle",
      target: "0xrecipient…",
      payload: JSON.stringify({ usdc: 12.5, status: "paid" }),
    },
  ];
  for (const a of actions) {
    console.log(`\n→ Attesting action "${a.action}"…`);
    const r = await attestAction(signer, network, a);
    console.log("  ACTION UID:", r.uid, "| payloadHash:", r.payloadHash);
  }

  // 3. Verify (trustless, public)
  console.log("\n→ Verifying passport via EAS GraphQL…");
  const v = await verifyAttestation(passport.uid, network);
  console.log("  valid:", v.valid, "| reason:", v.reason);
  if (!v.valid) process.exit(1);
  console.log("\n✓ PASSPORT demo complete. Share the passport UID for independent verification.");
}

main().catch((e) => {
  console.error("DEMO FAILED:", e.shortMessage ?? e.message ?? e);
  process.exit(1);
});
