// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SkyyflowVault } from "./vault/types.js";
import type { DetokenizeEvent, KlaviyoProfile, VaultedExport } from "./types.js";

export interface DetokenizeOptions {
  callerRoles: readonly string[];
  now?: () => string;
}

export interface DetokenizeResult {
  /** Profiles with authorized fields revealed; fields the caller is not authorized for stay as tokens. */
  profiles: KlaviyoProfile[];
  events: DetokenizeEvent[];
}

/**
 * Walk a VaultedExport and, for each vaulted field, ask the vault to detokenize
 * under the caller's roles. The vault enforces the (callerRoles ∩ revealRoles)
 * contract — denied requests come back as `disposition: "denied-not-authorized"`
 * and the field stays masked.
 */
export async function detokenize(
  vaultedExport: VaultedExport,
  vault: SkyyflowVault,
  options: DetokenizeOptions
): Promise<DetokenizeResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const callerRole = options.callerRoles[0] ?? "unknown";
  const events: DetokenizeEvent[] = [];
  const out: KlaviyoProfile[] = [];

  for (const profile of vaultedExport.data) {
    const { vaulted_fields, ...rest } = profile;
    const tokenEntries = Object.entries(vaulted_fields);
    if (tokenEntries.length === 0) {
      out.push({ ...rest });
      continue;
    }
    const responses = await vault.detokenize(
      tokenEntries.map(([field, token]) => ({ field, token })),
      { callerRoles: options.callerRoles, revealRoles: vaultedExport.reveal_roles }
    );
    const revealed: KlaviyoProfile = { ...rest, properties: { ...(rest.properties ?? {}) } };
    for (const res of responses) {
      events.push({
        profileId: profile.id,
        field: res.field,
        token: res.token,
        callerRole,
        disposition: res.disposition,
        timestamp: now(),
      });
      if (res.disposition !== "revealed" || res.value === null) {
        // Leave the field as the token — caller's role does not authorize reveal.
        continue;
      }
      if (res.field.startsWith("properties.")) {
        const key = res.field.slice("properties.".length);
        (revealed.properties as Record<string, string>)[key] = res.value;
      } else {
        (revealed as unknown as Record<string, string>)[res.field] = res.value;
      }
    }
    out.push(revealed);
  }

  return { profiles: out, events };
}
