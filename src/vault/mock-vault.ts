// SPDX-License-Identifier: AGPL-3.0-or-later
//
// In-memory deterministic Skyyflow vault for CLI demos, integration tests, and
// dry-runs. Tokens are sha256(vaultId|field|value) and stored in a Map; reverse
// direction reads the Map. Round-trips cleanly within a single process. Not
// persisted, not network-visible. A production deployment would replace this
// with an HTTP adapter targeting a hosted Skyyflow vault under the same
// SkyyflowVault interface.

import { createHash } from "node:crypto";

import type {
  DetokenizeRequest,
  DetokenizeResponse,
  SkyyflowVault,
  TokenizeRequest,
  TokenizeResponse,
} from "./types.js";

export class MockSkyyflowVault implements SkyyflowVault {
  readonly vendor = "skyyflow" as const;
  readonly vaultId: string;
  private readonly store = new Map<string, { field: string; value: string }>();

  constructor(vaultId = "mock-vault-klaviyo-bridge") {
    this.vaultId = vaultId;
  }

  async tokenize(requests: TokenizeRequest[]): Promise<TokenizeResponse[]> {
    return requests.map(({ field, value }) => {
      const hash = createHash("sha256").update(`${this.vaultId}|${field}|${value}`).digest("hex");
      const token = `skyy_${hash.slice(0, 16)}`;
      this.store.set(token, { field, value });
      return { field, token };
    });
  }

  async detokenize(
    requests: DetokenizeRequest[],
    options: { callerRoles: readonly string[]; revealRoles: readonly string[] }
  ): Promise<DetokenizeResponse[]> {
    const authorized = options.revealRoles.some((r) => options.callerRoles.includes(r));
    return requests.map(({ field, token }) => {
      const entry = this.store.get(token);
      if (!entry) {
        return { field, token, value: null, disposition: "denied-no-such-token" as const };
      }
      if (!authorized) {
        return { field, token, value: null, disposition: "denied-not-authorized" as const };
      }
      return { field, token, value: entry.value, disposition: "revealed" as const };
    });
  }

  /** Test-only — number of tokens stored. */
  size(): number {
    return this.store.size;
  }
}
