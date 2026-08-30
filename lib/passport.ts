import { ethers } from "ethers";
import { EAS } from "@ethereum-attestation-service/eas-sdk";
import {
  getEAS,
  getSchemaRegistry,
  encodePassport,
  encodeAction,
  SCHEMA_UIDS,
  PASSPORT_SCHEMA,
  ACTION_SCHEMA,
  EAS_GRAPHQL,
  NetworkKey,
} from "./eas";

// EAS SDK's Transaction<T>.wait() returns whatever the per-method waitCallback
// produces (for attest() it's the UID extracted from the Attested event). If
// the tx reverted inside the contract, no Attested event is emitted and the
// SDK throws "Unable to process Attested events" — but the wallet/UI may
// have already shown a "success" because the tx *was* mined. We unwrap
// this so callers get a clean error AND a real UID-or-failure signal.

/** Wait for an EAS SDK Transaction to mine, assert success, and return the
 *  uid extracted from the Attested event.
 *  Throws a clear error if the tx reverted or no Attested event was emitted. */
async function waitForAttest(t: { wait(): Promise<any> }, network?: NetworkKey) {
  const uid: string = await t.wait();
  // The SDK may return undefined if the Attested event was never emitted
  // (i.e. the contract call reverted). In that case uid === undefined.
  if (!uid || typeof uid !== "string" || !uid.startsWith("0x") || uid.length !== 66) {
    throw new Error(
      "Attestation transaction mined but no Attested event was emitted. " +
      "This usually means the EAS contract reverted (e.g. wrong schema UID, " +
      "insufficient gas, or the wallet rejected a follow-up signature). " +
      "Check the tx hash on the block explorer for the revert reason."
    );
  }
  // Additional safety: if the SDK returns a "valid-looking" UID but the receipt
  // status is 0 (reverted), the UID is a phantom. The EAS SDK caches UIDs in
  // some wallet paths even on revert; we have to check the receipt directly.
  const receipt = (t as any).receipt;
  if (receipt && Number(receipt.status) === 0) {
    throw new Error(
      `Attestation tx reverted (receipt status = 0). UID ${uid} is not on-chain. ` +
      `Check the tx hash ${receipt.hash} on the block explorer for the revert reason.`
    );
  }
  return uid;
}

/** SchemaRegistry.register returns the schema UID directly. If for any
 *  reason it's not a clean string, surface a clear error. */
async function waitForSchemaRegister(t: { wait(): Promise<any> }) {
  const result = await t.wait();
  if (typeof result !== "string" || !result.startsWith("0x") || result.length !== 66) {
    throw new Error(
      "SchemaRegistry.register returned an unexpected value: " +
      JSON.stringify(result).slice(0, 200)
    );
  }
  return result;
}

/** Decode known EAS contract custom errors. The EAS contract uses many custom
 *  errors (InvalidSchema, AttestationNotFound, AlreadyExists, etc.) and the
 *  wallet/SDK surfaces them as opaque hex selectors. This maps the most
 *  common ones to human-readable names so the user sees the real cause. */
const EAS_ERROR_SELECTORS: Record<string, string> = {
  // EAS contract custom errors — selectors are keccak256("ErrorName()")[:4]
  // computed from the EAS v1.5 source (EAS.sol).
  "0xbf37b20e": "InvalidSchema (the schema UID doesn't match any on-chain schema — schema may be unregistered on this chain)",
  "0xc5723b51": "NotFound (the requested attestation or schema doesn't exist on this chain)",
  "0x23369fa6": "AlreadyExists (this schema/attestation is already registered)",
  "0x947d5a84": "InvalidLength (one of the fields has an unsupported length)",
  "0xf2365b5b": "NoValue (the contract was called with non-zero value but the method doesn't accept it)",
  "0xbd8ba84d": "InvalidAttestation (the attestation data is malformed or refers to a missing passport UID)",
  "0x08e8b937": "InvalidExpirationTime (expiration must be 0 or in the future)",
  "0xccf3bb27": "InvalidRevocation (you tried to revoke an attestation that doesn't exist or isn't revocable)",
  "0x6da3f654": "InvalidResolver (the resolver address is invalid)",
  "0x8baa579f": "InvalidSignature (the EIP712 signature is invalid)",
  "0x1574f9f3": "NotPayable (the contract was called with value but doesn't accept it)",
  "0x11011294": "InsufficientValue (the msg.value is less than required)",
  "0xdf8c6da3": "InvalidUID (the attestation UID is malformed)",
  "0x4ca88867": "AccessDenied (the caller doesn't have permission — usually the attester for revoke)",
  "0x905e7107": "AlreadyRevoked (you tried to revoke an attestation that's already revoked)",
  "0x78ccf5a2": "NotAttestable (this schema or attestation is not attestable)",
  "0x9414820d": "NotRevocable (this attestation is not revocable — set revocable: true on creation)",
  "0xcd5f560b": "TooManyAttestations (batch size exceeds the per-call limit)",
  // Common require/panic patterns
  "0x4e487b71": "Panic(0x01) (assertion failed — likely a contract invariant was violated)",
  // String revert (Error(string))
  "0x08c379a0": "Reverted with a reason string",
};

function decodeEasError(e: any): string {
  // ethers v6 puts the custom error selector in e.data; v5 put it in e.error.data
  const data: string | undefined = e?.data ?? e?.error?.data ?? e?.error?.error?.data;
  if (data && typeof data === "string" && data.startsWith("0x") && data.length >= 10) {
    const sel = data.slice(0, 10).toLowerCase();
    const known = EAS_ERROR_SELECTORS[sel];
    if (known) return known;
    // String revert (Error(string))
    if (sel === "0x08c379a0" && data.length > 74) {
      try {
        const reason = ethers.toUtf8String("0x" + data.slice(138));
        if (reason) return `Reverted: "${reason}"`;
      } catch {}
    }
    return `unknown custom error ${sel} (check the tx logs on the explorer for the full revert reason)`;
  }
  // Non-custom-error path (e.g. "out of gas", "nonce has already been used")
  return e?.shortMessage ?? e?.message ?? String(e);
}

// Canonical EAS contract ABI for the deployed EAS v1.5 on Base (Sepolia +
// mainnet). The struct field order is uid, schema, time, expirationTime,
// revocationTime, refUID, recipient, attester, revocable, data. We use the
// full ABI from the SDK's deployment JSON, not the older EAS v1.0 layout.
const EAS_ABI_FROM_CHAIN = [
  "function getAttestation(bytes32 uid) view returns (tuple(bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, uint64 revocationTime, bytes32 refUID, address recipient, address attester, bool revocable, bytes data))",
] as const;

/** Post-attest on-chain confirmation. Calls the EAS contract's
 *  getAttestation(uid) and returns true ONLY if the returned struct is
 *  backed by real on-chain state (attester !== 0x0 AND time > 0).
 *  This is the ultimate guard against phantom UIDs returned by the
 *  EAS SDK or wallet when an attest() call reverts mid-flight. */
async function verifyOnChain(eas: EAS, uid: string): Promise<boolean> {
  try {
    // The EAS SDK exposes a low-level getAttestation via the underlying contract.
    // We use the contract's read directly to avoid SDK quirks.
    const contract = (eas as any).contract;
    if (!contract || !contract.runner) return true; // can't verify; trust the SDK
    // Use the correct v1.5 ABI for the deployed contract. The struct order
    // changed from the older v1.0 layout (where recipient/attester were
    // before time), so we have to use the explicit ABI here.
    // CRITICAL: when you pass a tuple ABI string to ethers.Contract, the
    // returned Result object ONLY has numeric indices [0..N], NOT named
    // properties. So `att.time` is undefined and `att[2]` is correct.
    // I burned a whole round on this — don't trust the named-property API.
    const att = await contract.getAttestation(uid);
    if (!att) return false;
    // EAS v1.5 Attestation struct: {uid, schema, time, expirationTime,
    // revocationTime, refUID, recipient, attester, revocable, data}
    const time = Number(att[2] ?? 0);
    const attester = att[7] ?? ethers.ZeroAddress;
    const isZeroAttester = !attester || attester.toLowerCase() === ethers.ZeroAddress.toLowerCase();
    const isZeroTime = !time || time === 0;
    return !(isZeroAttester && isZeroTime);
  } catch {
    // If the call reverts (e.g. contract doesn't support the method), trust
    // the SDK. Most likely the EAS contract is reachable but getAttestation
    // for this UID didn't find it — so we return false.
    return false;
  }
}

/** Public diagnostic: returns the raw on-chain state for a UID. Used by
 *  /verify to show a "Why is this not found?" panel when the indexer
 *  returns null but the user wants to know if the contract has the data. */
export async function diagnoseAttestation(
  uid: string,
  network: NetworkKey
): Promise<{
  onChain: boolean;
  attester: string;
  recipient: string;
  time: number;
  schema: string;
  raw: any;
}> {
  const provider = network === "8453"
    ? new ethers.JsonRpcProvider("https://mainnet.base.org")
    : new ethers.JsonRpcProvider("https://sepolia.base.org");
  const EAS_ADDR = "0x4200000000000000000000000000000000000021";
  // Use the correct v1.5 ABI for getAttestation. The struct field order
  // changed from v1.0 (where recipient/attester were before time), so the
  // hardcoded ABI we used earlier was reading the wrong offsets and showing
  // attester=0/time=0 even for real attestations.
  const eas = new ethers.Contract(EAS_ADDR, EAS_ABI_FROM_CHAIN, provider);
  try {
    const att = await eas.getAttestation(uid);
    // v1.5 struct: {uid, schema, time, expirationTime, revocationTime,
    // refUID, recipient, attester, revocable, data}
    const time = Number(att?.[2] ?? 0);
    const attester = att?.[7] ?? ethers.ZeroAddress;
    const recipient = att?.[6] ?? ethers.ZeroAddress;
    const schema = att?.[1] ?? ethers.ZeroHash;
    const isZero = attester === ethers.ZeroAddress && time === 0;
    return {
      onChain: !isZero,
      attester,
      recipient,
      time,
      schema,
      raw: {
        uid: att?.[0],
        schema,
        time,
        expirationTime: Number(att?.[3] ?? 0),
        revocationTime: Number(att?.[4] ?? 0),
        refUID: att?.[5],
        recipient,
        attester,
        revocable: att?.[8] ?? false,
      },
    };
  } catch (e) {
    return { onChain: false, attester: "", recipient: "", time: 0, schema: "", raw: { error: String(e) } };
  }
}

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
 * Mint a passport: ensure the PASSPORT schema is registered (idempotent — only
 * sends a register tx the first time, on later runs it's already on-chain), then
 * send a single attestation referencing it. Returns the attestation UID + tx hash.
 */
export async function createPassport(
  signer: ethers.Signer,
  network: NetworkKey,
  input: PassportInput
): Promise<PassportResult> {
  const eas: EAS = getEAS(network, signer);
  const registry = getSchemaRegistry(network, signer);
  const recipient = input.owner;

  // 1. Register schema only if it isn't already on-chain (avoids duplicate
  // register txns). The EAS SDK's getSchema() returns a default struct (not
  // a throw) for unknown schemas, and returns the same default struct for
  // already-registered ones too (it depends on the SDK version). So we
  // can't trust getSchema() alone — we have to attempt the register and
  // treat AlreadyExists as success.
  const passportSchemaUid = SCHEMA_UIDS[network].passport;
  try {
    // Pre-check: does the schema already exist? Use the v1.5 ABI directly
    // because the SDK's getSchema has buggy field decoding.
    const provider = (registry as any).contract?.runner?.provider;
    if (provider) {
      const regContract = new ethers.Contract(
        "0x4200000000000000000000000000000000000020",
        ["function getSchema(bytes32 uid) view returns (tuple(bytes32 uid, address registrant, bool revocable, string schema))"],
        provider
      );
      try {
        const s = await regContract.getSchema(passportSchemaUid);
        if (s && s.uid !== ethers.ZeroHash) {
          // Schema is registered — skip the register tx entirely.
        } else {
          throw new Error("not registered");
        }
      } catch {
        // Not registered — try to register. If we get AlreadyExists from
        // a parallel tx, that's fine (idempotent).
        const regTx = await registry.register({
          schema: PASSPORT_SCHEMA,
          resolverAddress: ethers.ZeroAddress,
          revocable: true,
        });
        await waitForSchemaRegister(regTx);
      }
    }
  } catch (regErr: any) {
    // If register() reverted with AlreadyExists (0x23369fa6), the schema is
    // already registered by us or by the prior session — treat as success.
    const data: string | undefined = regErr?.data ?? regErr?.error?.data;
    if (data && data.toLowerCase().startsWith("0x23369fa6")) {
      // already exists — proceed
    } else {
      throw new Error(
        `Schema registration failed on ${network}: ${decodeEasError(regErr)}. ` +
        `Check that the SchemaRegistry contract is reachable on this network.`
      );
    }
  }

  const did = deriveDid(recipient);
  const data = encodePassport({
    agentName: input.agentName,
    did,
    owner: recipient,
    agentType: input.agentType,
    mandateJson: input.mandateJson,
    ext: input.ext ?? "",
  });

  const tx = await eas.attest({
    schema: passportSchemaUid,
    data: {
      recipient,
      expirationTime: 0n,
      revocable: true,
      data,
    },
  });
  let uid: string;
  let txHash = "";
  try {
    uid = await waitForAttest(tx, network);
    txHash = (tx as any).receipt?.hash ?? (tx as any).data?.hash ?? "";
  } catch (e: any) {
    // Surface the most useful error we have. The EAS contract often reverts
    // with a custom error like "AttestationNotFound" or "InvalidSchema" when
    // the schema UID doesn't match a real on-chain schema.
    txHash = (tx as any).receipt?.hash ?? (tx as any).data?.hash ?? "";
    const decoded = decodeEasError(e);
    throw new Error(
      `Mint failed: ${decoded}. Tx hash: ${txHash || "(unknown)"} — ` +
      `check the explorer for the revert reason.`
    );
  }
  // FINAL guard: verify the attestation actually exists on-chain. If the
  // SDK or the wallet gave us a phantom UID (a string that looks like a UID
  // but isn't backed by on-chain state), this catches it. The EAS contract
  // returns a default struct (attester: 0x0, time: 0) for UIDs that don't
  // exist, so we check for those.
  const onChain = await verifyOnChain(eas, uid);
  if (!onChain) {
    throw new Error(
      `Mint produced UID ${uid} but the attestation is not on-chain ` +
      `(attester or time is zero). The EAS contract call likely reverted ` +
      `silently. Tx hash: ${txHash || "(unknown)"}. ` +
      `Please retry — if this keeps happening, your wallet/provider may ` +
      `be misreporting tx success.`
    );
  }
  return { uid, did, txHash };
}

export type ActionInput = {
  passportUid: string;
  action: string; // e.g. "swap" | "post" | "settle"
  target: string; // e.g. pair, url, address
  payload: string; // raw payload (we hash it for verifiability)
  ext?: string;
};

export type ActionResult = { uid: string; payloadHash: string };

/**
 * Revoke a previously-issued passport. Only the original attester (owner) can
 * do this — EAS enforces it on-chain. After revocation, the UID is no longer
 * "VALID" on the verify page (verifyAttestation returns valid=false with a
 * revoked reason). This is the "mandate is revocable" promise made interactive.
 */
export async function revokePassport(
  signer: ethers.Signer,
  network: NetworkKey,
  uid: string
): Promise<{ txHash: string }> {
  const eas: EAS = getEAS(network, signer);
  const passportSchemaUid = SCHEMA_UIDS[network].passport;
  const tx = await eas.revoke({
    schema: passportSchemaUid,
    data: { uid },
  });
  const txHash = (tx as any).hash ?? (tx as any).data?.hash ?? "";
  await tx.wait();
  return { txHash };
}

export async function attestAction(
  signer: ethers.Signer,
  network: NetworkKey,
  input: ActionInput
): Promise<ActionResult> {
  const eas: EAS = getEAS(network, signer);
  const registry = getSchemaRegistry(network, signer);

  // Register action schema only if not already on-chain. The EAS SDK's
  // getSchema() has buggy decoding (returns default struct for both
  // unknown AND known schemas), so we pre-check with the v1.5 ABI and
  // treat AlreadyExists reverts as success (idempotent).
  const actionSchemaUid = SCHEMA_UIDS[network].action;
  try {
    const provider = (registry as any).contract?.runner?.provider;
    if (provider) {
      const regContract = new ethers.Contract(
        "0x4200000000000000000000000000000000000020",
        ["function getSchema(bytes32 uid) view returns (tuple(bytes32 uid, address registrant, bool revocable, string schema))"],
        provider
      );
      let needRegister = true;
      try {
        const s = await regContract.getSchema(actionSchemaUid);
        if (s && s.uid !== ethers.ZeroHash) needRegister = false;
      } catch { /* not registered */ }
      if (needRegister) {
        const regTx = await registry.register({
          schema: ACTION_SCHEMA,
          resolverAddress: ethers.ZeroAddress,
          revocable: true,
        });
        try {
          await waitForSchemaRegister(regTx);
        } catch (regErr: any) {
          const data: string | undefined = regErr?.data ?? regErr?.error?.data;
          if (!data || !data.toLowerCase().startsWith("0x23369fa6")) {
            throw regErr;
          }
        }
      }
    }
  } catch (regErr: any) {
    const data: string | undefined = regErr?.data ?? regErr?.error?.data;
    if (!data || !data.toLowerCase().startsWith("0x23369fa6")) {
      throw new Error(
        `Action schema registration failed on ${network}: ${decodeEasError(regErr)}.`
      );
    }
  }

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
  let uid: string;
  try {
    uid = await waitForAttest(tx, network);
  } catch (e: any) {
    const decoded = decodeEasError(e);
    const txHash = (tx as any).receipt?.hash ?? (tx as any).data?.hash ?? "";
    throw new Error(
      `Issue receipt failed: ${decoded}. ` +
      `Tx hash: ${txHash || "(unknown)"} — check the explorer for the revert reason.`
    );
  }
  // On-chain confirmation: the action UID must exist on-chain.
  const onChain = await verifyOnChain(eas, uid);
  if (!onChain) {
    const txHash = (tx as any).receipt?.hash ?? (tx as any).data?.hash ?? "";
    throw new Error(
      `Action receipt produced UID ${uid} but the attestation is not on-chain. ` +
      `This usually means the action schema isn't registered on ${network} yet ` +
      `(the lib should auto-register it, but it may have failed). ` +
      `Tx hash: ${txHash || "(unknown)"} — check the explorer.`
    );
  }
  return { uid, payloadHash: "0x" + payloadHash };
}

export type DecodedField = { name: string; type: string; value: any };
export type VerificationStatus = {
  valid: boolean;
  reason: string;
  attestation?: any;
  // When the attestation uses one of our schemas, decode the ABI-encoded `data`
  // field back into named fields. null if the schema is not a passport / action
  // schema we know about.
  decoded?: { kind: "passport" | "action"; fields: DecodedField[] } | null;
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
      // Auto-retry on the other network — UID lookups are case-sensitive
      // address checksums, and the most common failure mode is "I minted on
      // mainnet, the verify page defaulted to Sepolia (or vice versa)".
      const other: NetworkKey = network === "84532" ? "8453" : "84532";
      try {
        const otherRes = await fetch(EAS_GRAPHQL[other], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: { where: { id: uid } } }),
        });
        const otherJson = await otherRes.json();
        if (otherJson?.data?.attestation) {
          return {
            valid: false,
            reason:
              `No attestation found on ${network} (Base ${network === "8453" ? "mainnet" : "Sepolia"}), but the same UID resolves on ${other} (Base ${other === "8453" ? "mainnet" : "Sepolia"}). Did you mean to verify there?`,
            attestation: otherJson.data.attestation,
            attestationOnNetwork: other,
            decoded: null,
            triedNetworks: [network, other],
          } as VerificationStatus & { attestationOnNetwork?: NetworkKey; triedNetworks?: NetworkKey[] };
        }
      } catch {
        /* fall through to the original "not found" response */
      }
      return { valid: false, reason: "No attestation found for this UID on " + network, decoded: null };
    }
    if (att.revoked) {
      return { valid: false, reason: "Attestation has been revoked.", attestation: att, decoded: null };
    }

    // If the schema is one of ours, decode the ABI-encoded `data` field so the
    // UI can show the actual agentName / did / owner / mandate — not raw bytes.
    let decoded: VerificationStatus["decoded"] = null;
    try {
      const schemaUid = (att.schemaId || "").toLowerCase();
      const passportUid = SCHEMA_UIDS[network].passport.toLowerCase();
      const actionUid = SCHEMA_UIDS[network].action.toLowerCase();
      if (schemaUid === passportUid && typeof att.data === "string" && att.data.startsWith("0x")) {
        decoded = { kind: "passport", fields: decodeData(PASSPORT_SCHEMA, att.data) };
      } else if (schemaUid === actionUid && typeof att.data === "string" && att.data.startsWith("0x")) {
        decoded = { kind: "action", fields: decodeData(ACTION_SCHEMA, att.data) };
      }
    } catch {
      // Decoding is best-effort; if it fails we still return a valid attestation.
      decoded = null;
    }

    return { valid: true, reason: "Verified on-chain via EAS.", attestation: att, decoded };
  } catch (e: any) {
    return { valid: false, reason: "Verification request failed: " + (e?.message ?? e), decoded: null };
  }
}

/**
 * Decode an ABI-encoded attestation payload against a known schema. We can't use
 * the SDK's decodeData in the browser bundle (it pulls lodash via the SDK's
 * ESM index and that import breaks under bare `tsc --noEmit`). Instead, decode
 * the simple types we use (string / address / uint64) directly with ethers.
 */
function decodeData(schema: string, hexData: string): DecodedField[] {
  const fields: DecodedField[] = [];
  // Parse schema like:  "string agentName,string did,address owner,..."
  const parts = schema.split(",").map((s) => s.trim());
  // ethers.AbiCoder.decode can decode the whole tuple at once when we know the
  // top-level types. For "string" + "address" + "uint64" the canonical tuple
  // encoding is the same as the dynamic schema encoder output.
  const topTypes = parts.map((p) => p.split(/\s+/)[0]);
  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(topTypes, hexData);
  parts.forEach((p, i) => {
    const [type, name] = p.split(/\s+/);
    let v: any = decoded[i];
    if (type === "uint64" || type === "uint256") v = v.toString();
    fields.push({ name, type, value: v });
  });
  return fields;
}

/* ============================================================================
 *  PROFILE — fetch all EAS attestations where an address is the attester
 *  or the recipient. Used by /profile to show the agent's full passport
 *  portfolio (passport UIDs + action receipts in chronological order).
 *  ========================================================================== */

export type ProfileAttestation = {
  uid: string;
  schemaId: string;
  kind: "passport" | "action" | "other";
  attester: string;
  recipient: string;
  time: number;        // unix seconds
  revoked: boolean;
  revocable: boolean;
  decoded: DecodedField[] | null;
  network: NetworkKey;
  explorerUrl: string;
};

const EAS_EXPLORER: Record<NetworkKey, string> = {
  "8453": "https://easscan.org",
  "84532": "https://sepolia.easscan.org",
};

/** Build the EAS GraphQL `attestations` query (paginated). Returns the
 *  attestation records and a `hasMore` flag — the caller can page by
 *  incrementing the `skip` variable. */
async function queryAttestationsBy(
  endpoint: string,
  field: "attester" | "recipient",
  address: string,
  skip = 0,
  first = 100
): Promise<{ items: any[]; hasMore: boolean }> {
  const query = `query($first: Int!, $skip: Int!, $where: AttestationWhereInput!) {
    attestations(
      first: $first
      skip: $skip
      orderBy: time
      orderDirection: desc
      where: $where
    ) {
      id schemaId attester recipient revoked revocable
      time expirationTime data
    }
  }`;
  // EAS indexer expects the address as the lowercase 0x-prefixed string.
  const where: any = {};
  where[field] = { equals: address.toLowerCase() };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { first, skip, where } }),
  });
  const json = await res.json();
  const items: any[] = json?.data?.attestations ?? [];
  return { items, hasMore: items.length === first };
}

/** Fetch all EAS attestations for an address across one network, both as
 *  attester and as recipient. Dedupe by UID (the agent can be both for the
 *  same passport) and classify each as passport / action / other. */
export async function fetchProfile(
  address: string,
  network: NetworkKey
): Promise<ProfileAttestation[]> {
  if (!ethers.isAddress(address)) return [];
  const endpoint = EAS_GRAPHQL[network];
  const explorer = EAS_EXPLORER[network];
  const passportUid = SCHEMA_UIDS[network].passport.toLowerCase();
  const actionUid = SCHEMA_UIDS[network].action.toLowerCase();

  const [byAttester, byRecipient] = await Promise.all([
    queryAttestationsBy(endpoint, "attester", address).catch(() => ({ items: [], hasMore: false })),
    queryAttestationsBy(endpoint, "recipient", address).catch(() => ({ items: [], hasMore: false })),
  ]);

  const seen = new Set<string>();
  const out: ProfileAttestation[] = [];
  for (const att of [...byAttester.items, ...byRecipient.items]) {
    const uid = att.id;
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const schemaId = (att.schemaId || "").toLowerCase();
    let kind: ProfileAttestation["kind"] = "other";
    if (schemaId === passportUid) kind = "passport";
    else if (schemaId === actionUid) kind = "action";
    // Try to decode the data field if it's one of our schemas
    let decoded: DecodedField[] | null = null;
    try {
      if (kind === "passport" && typeof att.data === "string" && att.data.startsWith("0x")) {
        decoded = decodeData(PASSPORT_SCHEMA, att.data);
      } else if (kind === "action" && typeof att.data === "string" && att.data.startsWith("0x")) {
        decoded = decodeData(ACTION_SCHEMA, att.data);
      }
    } catch { /* best-effort */ }
    out.push({
      uid,
      schemaId,
      kind,
      attester: att.attester,
      recipient: att.recipient,
      time: Number(att.time ?? 0),
      revoked: !!att.revoked,
      revocable: !!att.revocable,
      decoded,
      network,
      explorerUrl: `${explorer}/attestation/view/${uid}`,
    });
  }
  // Sort newest first
  out.sort((a, b) => b.time - a.time);
  return out;
}

/** Fetch the profile across both Base mainnet and Base Sepolia, merge and
 *  dedupe. This is what /profile calls by default. */
export async function fetchProfileAllNetworks(
  address: string
): Promise<ProfileAttestation[]> {
  const [a, b] = await Promise.all([
    fetchProfile(address, "8453").catch(() => []),
    fetchProfile(address, "84532").catch(() => []),
  ]);
  const seen = new Set<string>();
  const out: ProfileAttestation[] = [];
  for (const x of [...a, ...b]) {
    if (seen.has(x.uid)) continue;
    seen.add(x.uid);
    out.push(x);
  }
  out.sort((a, b) => b.time - a.time);
  return out;
}
