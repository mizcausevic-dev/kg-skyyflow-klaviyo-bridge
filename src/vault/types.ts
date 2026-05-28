// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Vendor-neutral Skyyflow vault contract — same shape used in rag-sentinel
// and deal-desk-workspace so one buyer Decision Card drives consistent
// behavior across server-side scanning, client-side reveal, and growth-ops
// pipelines.

export interface TokenizeRequest {
  /** Logical field name as it appears in the Decision Card fields_authorized list. */
  field: string;
  /** Raw PII value. After this call the caller should drop it from local memory. */
  value: string;
}

export interface TokenizeResponse {
  field: string;
  /** Opaque token. Treat as a string identifier — never as a fallback display value. */
  token: string;
}

export interface DetokenizeRequest {
  field: string;
  token: string;
}

export type Disposition = "revealed" | "denied-not-authorized" | "denied-no-such-token";

export interface DetokenizeResponse {
  field: string;
  token: string;
  /** Raw PII value, OR null if the caller's roles did not authorize reveal. */
  value: string | null;
  disposition: Disposition;
}

export interface SkyyflowVault {
  /** Provider tag — surfaces in audit-stream events; matches vendor enum from the Decision Card. */
  readonly vendor: string;
  /** Vault identifier — surfaces in audit-stream events; matches vault_id from the Decision Card. */
  readonly vaultId: string;
  tokenize(requests: TokenizeRequest[]): Promise<TokenizeResponse[]>;
  detokenize(
    requests: DetokenizeRequest[],
    options: { callerRoles: readonly string[]; revealRoles: readonly string[] }
  ): Promise<DetokenizeResponse[]>;
}
