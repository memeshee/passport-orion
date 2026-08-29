import { EAS, SchemaEncoder, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

/**
 * PASSPORT on-chain schemas (created once per network, then referenced by UID).
 * These are the verifiable backbone: every claim an agent makes is anchored
 * on EAS as an attestation that anyone can look up and verify.
 */

// Passport: an agent's verifiable identity + scoped mandate.
// (agentName, did, owner, agentType, mandateJson, ext)
export const PASSPORT_SCHEMA =
  "string agentName,string did,bytes32 owner,string agentType,string mandateJson,string ext";

// Action receipt: proof that a specific agent action happened under a passport.
// (passportUid, action, target, payloadHash, timestamp, ext)
export const ACTION_SCHEMA =
  "bytes32 passportUid,string action,string target,string payloadHash,uint64 timestamp,string ext";

export const SCHEMA_UIDS: Record<string, { passport: string; action: string }> = {
  // Base Sepolia testnet (demo) — filled at runtime if not pre-registered.
  "84532": { passport: "", action: "" },
  // Base mainnet — filled at runtime if not pre-registered.
  "8453": { passport: "", action: "" },
};

export type NetworkKey = "84532" | "8453";

export function getEAS(network: NetworkKey, signer: ethers.Signer) {
  // Official EAS deployment on Base (same address on Base mainnet + Base Sepolia).
  const easAddress = "0x4200000000000000000000000000000000000021";
  return new EAS(easAddress).connect(signer);
}

export function getSchemaRegistry(network: NetworkKey, signer: ethers.Signer) {
  // Official SchemaRegistry deployment on Base (mainnet + Sepolia share this address).
  const registryAddress = "0x4200000000000000000000000000000000000020";
  return new SchemaRegistry(registryAddress).connect(signer);
}

export function encodePassport(data: {
  agentName: string;
  did: string;
  owner: string;
  agentType: string;
  mandateJson: string;
  ext: string;
}) {
  const encoder = new SchemaEncoder(PASSPORT_SCHEMA);
  return encoder.encodeData([
    { name: "agentName", type: "string", value: data.agentName },
    { name: "did", type: "string", value: data.did },
    { name: "owner", type: "bytes32", value: data.owner },
    { name: "agentType", type: "string", value: data.agentType },
    { name: "mandateJson", type: "string", value: data.mandateJson },
    { name: "ext", type: "string", value: data.ext },
  ]);
}

export function encodeAction(data: {
  passportUid: string;
  action: string;
  target: string;
  payloadHash: string;
  timestamp: number;
  ext: string;
}) {
  const encoder = new SchemaEncoder(ACTION_SCHEMA);
  return encoder.encodeData([
    { name: "passportUid", type: "bytes32", value: data.passportUid },
    { name: "action", type: "string", value: data.action },
    { name: "target", type: "string", value: data.target },
    { name: "payloadHash", type: "string", value: data.payloadHash },
    { name: "timestamp", type: "uint64", value: data.timestamp },
    { name: "ext", type: "string", value: data.ext },
  ]);
}

export const EAS_GRAPHQL: Record<string, string> = {
  "8453": "https://easscan.org/graphql",
  "84532": "https://sepolia.easscan.org/graphql",
};
