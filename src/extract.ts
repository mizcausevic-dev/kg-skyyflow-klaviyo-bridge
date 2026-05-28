// SPDX-License-Identifier: AGPL-3.0-or-later

import type { KlaviyoProfile, ProfileFieldRef } from "./types.js";

const TOP_LEVEL_FIELDS: Array<["email" | "phone_number" | "first_name" | "last_name"]> = [
  ["email"],
  ["phone_number"],
  ["first_name"],
  ["last_name"],
];

/** Discover every PII-bearing field on a profile. Field names match Decision Card `fields_authorized` entries. */
export function extractFields(profile: KlaviyoProfile): ProfileFieldRef[] {
  const refs: ProfileFieldRef[] = [];
  for (const path of TOP_LEVEL_FIELDS) {
    const value = profile[path[0]];
    if (typeof value === "string" && value.length > 0) {
      refs.push({ profileId: profile.id, field: path[0], path, value });
    }
  }
  const props = profile.properties ?? {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string" && value.length > 0) {
      refs.push({
        profileId: profile.id,
        field: `properties.${key}`,
        path: ["properties", key],
        value,
      });
    }
  }
  return refs;
}

/** Apply a (field → token) substitution onto a profile, returning a new profile object. */
export function substituteFields(
  profile: KlaviyoProfile,
  substitutions: Map<string, string>
): KlaviyoProfile {
  const next: KlaviyoProfile = { ...profile, properties: { ...(profile.properties ?? {}) } };
  for (const [field, token] of substitutions) {
    if (field.startsWith("properties.")) {
      const key = field.slice("properties.".length);
      (next.properties as Record<string, string>)[key] = token;
    } else {
      (next as unknown as Record<string, string>)[field] = token;
    }
  }
  return next;
}
