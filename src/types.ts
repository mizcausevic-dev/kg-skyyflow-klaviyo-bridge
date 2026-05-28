// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Klaviyo profile shape used by the bridge. Modeled after the public Klaviyo
// Profiles API response: an `email`, `phone_number`, and a free-form
// `properties` map. We intentionally keep the surface minimal — only the
// fields the bridge inspects, tokenizes, or surfaces in reports.

export type Disposition = "revealed" | "denied-not-authorized" | "denied-no-such-token";

export interface KlaviyoProfile {
  id: string;
  email?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  properties?: Record<string, string>;
}

export interface KlaviyoProfileExport {
  data: KlaviyoProfile[];
}

/** A single PII field discovered on a profile. */
export interface ProfileFieldRef {
  profileId: string;
  field: string;
  /** Where the value lives on the profile object — needed to round-trip vault tokens back into the export. */
  path: ["email"] | ["phone_number"] | ["first_name"] | ["last_name"] | ["properties", string];
  value: string;
}

/** A vaulted profile — same shape as KlaviyoProfile, with vaulted fields replaced by skyy_<hex> tokens. */
export interface VaultedProfile extends KlaviyoProfile {
  /** Tokens substituted into top-level or properties fields, keyed by the logical field name. */
  vaulted_fields: Record<string, string>;
}

export interface VaultedExport {
  data: VaultedProfile[];
  /** Skyyflow vault metadata captured at tokenize time. */
  vault: { vendor: string; vault_id: string };
  /** Logical fields the vault target authorized for tokenization. */
  fields_authorized: string[];
  /** Roles the Decision Card grants reveal authority to. */
  reveal_roles: string[];
}

export interface TokenizeEvent {
  profileId: string;
  field: string;
  token: string;
  timestamp: string;
}

export interface DetokenizeEvent {
  profileId: string;
  field: string;
  token: string;
  callerRole: string;
  disposition: Disposition;
  timestamp: string;
}

/** Coverage finding emitted by `audit()`. */
export type FindingCode =
  | "no-decision-card-vault-target"
  | "field-not-authorized"
  | "no-reveal-roles-declared"
  | "profile-missing-authorized-field"
  | "extra-pii-on-profile"
  | "audit-uri-missing";

export type Severity = "high" | "medium" | "low" | "info";

export interface Finding {
  code: FindingCode;
  severity: Severity;
  subject: "decision-card" | "profile" | "field";
  subjectId: string;
  message: string;
}

export interface CoverageReport {
  ok: boolean;
  vendor: string;
  vaultId: string | null;
  decisionId: string;
  profiles: number;
  fieldsAuthorized: string[];
  revealRoles: string[];
  authorizedFieldsPresent: number;
  unauthorizedFieldsPresent: number;
  findings: Finding[];
}
