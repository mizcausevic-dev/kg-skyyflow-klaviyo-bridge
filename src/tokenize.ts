// SPDX-License-Identifier: AGPL-3.0-or-later

import { extractFields, substituteFields } from "./extract.js";
import { parseDecisionCard, selectVaultTarget } from "./vault/decision-card.js";
import type { SkyyflowVault } from "./vault/types.js";
import type {
  KlaviyoProfileExport,
  TokenizeEvent,
  VaultedExport,
  VaultedProfile,
} from "./types.js";

export interface TokenizeOptions {
  vendor?: string;
  now?: () => string;
}

export interface TokenizeResult {
  vaultedExport: VaultedExport;
  events: TokenizeEvent[];
}

/**
 * Tokenize the PII fields authorized by the Decision Card and emit a
 * VaultedExport whose profile records carry only Skyyflow tokens. The
 * downstream consumer (a Klaviyo import pipeline, a vector store, a
 * lifecycle-flow analyzer) sees tokens, never raw PII.
 */
export async function tokenize(
  profilesExport: KlaviyoProfileExport,
  decisionCardDoc: unknown,
  vault: SkyyflowVault,
  options: TokenizeOptions = {}
): Promise<TokenizeResult> {
  const vendor = options.vendor ?? "skyyflow";
  const parsed = parseDecisionCard(decisionCardDoc);
  const target = selectVaultTarget(parsed, vendor);
  if (!target) {
    throw new Error(
      `tokenize: Decision Card ${parsed.decisionId} has no data_vault_targets entry for vendor "${vendor}".`
    );
  }
  const now = options.now ?? (() => new Date().toISOString());
  const authorizedSet = new Set(target.fieldsAuthorized);
  const events: TokenizeEvent[] = [];
  const vaultedProfiles: VaultedProfile[] = [];

  for (const profile of profilesExport.data) {
    const refs = extractFields(profile).filter((r) => authorizedSet.has(r.field));
    const responses = refs.length
      ? await vault.tokenize(refs.map((r) => ({ field: r.field, value: r.value })))
      : [];
    const substitutions = new Map<string, string>();
    const vaulted_fields: Record<string, string> = {};
    for (let i = 0; i < refs.length; i += 1) {
      const ref = refs[i];
      const res = responses[i];
      substitutions.set(ref.field, res.token);
      vaulted_fields[ref.field] = res.token;
      events.push({
        profileId: profile.id,
        field: ref.field,
        token: res.token,
        timestamp: now(),
      });
    }
    const substituted = substituteFields(profile, substitutions);
    vaultedProfiles.push({ ...substituted, vaulted_fields });
  }

  return {
    vaultedExport: {
      data: vaultedProfiles,
      vault: { vendor: vault.vendor, vault_id: vault.vaultId },
      fields_authorized: target.fieldsAuthorized,
      reveal_roles: target.revealRoles,
    },
    events,
  };
}
