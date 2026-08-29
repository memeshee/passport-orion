import { ethers } from "ethers";
import { EAS } from "@ethereum-attestation-service/eas-sdk";
import {
  getEAS,
  getSchemaRegistry,
  encodePassport,
  encodeAction,
  PASSPORT_SCHEMA,
  ACTION_SCHEMA,
  EAS_GRAPHQL,
  NetworkKey,
} from "./eas";

export type PassportInput = {
  agentName: string;
  owner: string; // 0x address
  agentType: string; // e.g. "trading" | "research" | "commerce"
  mandateJson: string; // scoped authority, e.g. {"maxUSD":500,"venues":["a","b"]}
  ext?: string;
};

// Derive a deterministic, human-readable did:key-style id from the owner address.
// (We use a base58-like encoding of the address; resolves to the wallet that owns it.)
export function deriveDid(owner: string): string {
  const hex = owner.replace(/^0x/, "").toLowerCase();
  // simple base36 of the address bytes for a compact, unique id
  const bn = BigInt("0x" + hex);
  const id = bn.toString(36);
  return "did:passport:" + id;
}

export type PassportResult = {
  uid: string;
  did: string;
  txHash: string;
};

/**
 * Register a passport schema on the network if not already present, then
 * attest the agent's identity. Returns the attestation UID (the on-chain receipt).
 */
export async function createPassport(
  signer: ethers.Signer,
  network: NetworkKey,
  input: PassportInput
): Promise<PassportResult> {
  const eas: EAS = getEAS(network, signer);
  const registry = getSchemaRegistry(network, signer);
  const owner = input.owner;
  const creator = await signer.getAddress();

  // 1. Register schemas (EAS returns a Transaction; .wait() yields the schema UID).
  //    EAS is idempotent per (schema, creator): re-registering returns the same UID.
  const passportSchemaTx = await registry.register({
    schema: PASSPORT_SCHEMA,
    resolverAddress: ethers.ZeroAddress,
    revocable: true,
  });
  const passportSchemaUid = await passportSchemaTx.wait();

  const actionSchemaTx = await registry.register({
    schema: ACTION_SCHEMA,
    resolverAddress: ethers.ZeroAddress,
    revocable: true,
  });
  const actionSchemaUid = await actionSchemaTx.wait();

  const did = deriveDid(owner);
  const data = encodePassport({
    agentName: input.agentName,
    did,
    owner,
    agentType: input.agentType,
    mandateJson: input.mandateJson,
    ext: input.ext ?? "",
  });

  const tx = await eas.attest({
    schema: passportSchemaUid,
    data: {
      recipient: owner,
      expirationTime: 0n,
      revocable: true,
      data,
    },
  });
  const uid = await tx.wait();

  return { uid, did, txHash: "" };
}

export type ActionInput = {
  passportUid: string;
  action: string; // e.g. "swap" | "post" | "settle"
  target: string; // e.g. pair, url, address
  payload: string; // raw payload (we hash it for verifiability)
  ext?: string;
};

export type ActionResult = { uid: string; payloadHash: string };

export async function attestAction(
  signer: ethers.Signer,
  network: NetworkKey,
  input: ActionInput
): Promise<ActionResult> {
  const eas: EAS = getEAS(network, signer);
  const registry = getSchemaRegistry(network, signer);

  // Ensure the action schema is registered (idempotent per creator).
  const actionSchemaTx = await registry.register({
    schema: ACTION_SCHEMA,
    resolverAddress: ethers.ZeroAddress,
    revocable: true,
  });
  const actionSchemaUid = await actionSchemaTx.wait();

  const payloadHash = ethers
    .keccak256(ethers.toUtf8Bytes(input.payload))
    .replace(/^0x/, "");

  const data = encodeAction({
    passportUid: input.passportUid,
    action: input.action,
    target: input.target,
    payloadHash: "0x" + payloadHash,
    timestamp: Math.floor(Date.now() / 1000),
    ext: input.ext ?? "",
  });

  const tx = await eas.attest({
    schema: actionSchemaUid,
    data: {
      recipient: await signer.getAddress(),
      expirationTime: 0n,
      revocable: true,
      data,
    },
  });
  const uid = await tx.wait();
  return { uid, payloadHash: "0x" + payloadHash };
}

export type VerificationStatus = {
  valid: boolean;
  reason: string;
  attestation?: any;
};

/**
 * Verify a passport or action attestation against EAS GraphQL — the public,
 * trustless proof anyone can run. This is the "show the receipt" primitive.
 */
export async function verifyAttestation(
  uid: string,
  network: NetworkKey
): Promise<VerificationStatus> {
  const endpoint = EAS_GRAPHQL[network];
  const query = `query($where: AttestationWhereUniqueInput!) {
    attestation(where: $where) {
      id schemaId attester recipient revoked revocable
      time expirationTime data
    }
  }`;
  const variables = { where: { id: uid } };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    const att = json?.data?.attestation;
    if (!att) {
      return { valid: false, reason: "No attestation found for this UID on " + network };
    }
    if (att.revoked) {
      return { valid: false, reason: "Attestation has been revoked.", attestation: att };
    }
    return { valid: true, reason: "Verified on-chain via EAS.", attestation: att };
  } catch (e: any) {
    return { valid: false, reason: "Verification request failed: " + (e?.message ?? e) };
  }
}
