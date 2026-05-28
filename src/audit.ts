// SPDX-License-Identifier: AGPL-3.0-or-later

import { extractFields } from "./extract.js";
import { parseDecisionCard, selectVaultTarget } from "./vault/decision-card.js";
import type { CoverageReport, Finding, KlaviyoProfileExport } from "./types.js";

export interface AuditOptions {
  /** Decision Card vendor key to inspect. Default: "skyyflow". */
  vendor?: string;
}

/**
 * Cross-reference a Klaviyo profile export with an AI Procurement Decision
 * Card v0.2. Produces a coverage report listing which authorized fields are
 * actually present on profiles, which PII fields are present but unauthorized,
 * and structural gaps in the Decision Card itself (missing reveal roles, no
 * audit URI, etc.).
 */
export function audit(
  profilesExport: KlaviyoProfileExport,
  decisionCardDoc: unknown,
  options: AuditOptions = {}
): CoverageReport {
  const vendor = options.vendor ?? "skyyflow";
  const parsed = parseDecisionCard(decisionCardDoc);
  const target = selectVaultTarget(parsed, vendor);
  const findings: Finding[] = [];

  if (!target) {
    findings.push({
      code: "no-decision-card-vault-target",
      severity: "high",
      subject: "decision-card",
      subjectId: parsed.decisionId,
      message: `No data_vault_targets entry for vendor "${vendor}" in Decision Card ${parsed.decisionId}.`,
    });
    return {
      ok: false,
      vendor,
      vaultId: null,
      decisionId: parsed.decisionId,
      profiles: profilesExport.data.length,
      fieldsAuthorized: [],
      revealRoles: [],
      authorizedFieldsPresent: 0,
      unauthorizedFieldsPresent: 0,
      findings,
    };
  }

  if (target.revealRoles.length === 0) {
    findings.push({
      code: "no-reveal-roles-declared",
      severity: "high",
      subject: "decision-card",
      subjectId: parsed.decisionId,
      message: `Vault target for "${vendor}" declares zero reveal_roles. Tokenize will succeed but no caller can ever detokenize.`,
    });
  }

  if (!target.revealAuditUri) {
    findings.push({
      code: "audit-uri-missing",
      severity: "medium",
      subject: "decision-card",
      subjectId: parsed.decisionId,
      message: `Vault target for "${vendor}" has no reveal_audit_uri. Reveal events have nowhere to be published for buyer-side review.`,
    });
  }

  const authorizedSet = new Set(target.fieldsAuthorized);
  let authorizedFieldsPresent = 0;
  let unauthorizedFieldsPresent = 0;
  const fieldsPresentPerProfile = new Map<string, Set<string>>();

  for (const profile of profilesExport.data) {
    const fields = extractFields(profile);
    const present = new Set<string>();
    fieldsPresentPerProfile.set(profile.id, present);
    for (const ref of fields) {
      present.add(ref.field);
      if (authorizedSet.has(ref.field)) {
        authorizedFieldsPresent += 1;
      } else {
        unauthorizedFieldsPresent += 1;
        findings.push({
          code: "extra-pii-on-profile",
          severity: "medium",
          subject: "profile",
          subjectId: profile.id,
          message: `Profile carries "${ref.field}" which is NOT authorized by the Decision Card vault target. Tokenize will skip it; growth-ops surfaces will receive it raw.`,
        });
      }
    }
  }

  for (const [profileId, present] of fieldsPresentPerProfile) {
    for (const field of authorizedSet) {
      if (!present.has(field)) {
        findings.push({
          code: "profile-missing-authorized-field",
          severity: "low",
          subject: "profile",
          subjectId: profileId,
          message: `Profile is missing authorized field "${field}". Not necessarily a problem; surfacing for completeness.`,
        });
      }
    }
  }

  const ok = findings.every((f) => f.severity === "info" || f.severity === "low");

  return {
    ok,
    vendor,
    vaultId: target.vaultId,
    decisionId: parsed.decisionId,
    profiles: profilesExport.data.length,
    fieldsAuthorized: target.fieldsAuthorized,
    revealRoles: target.revealRoles,
    authorizedFieldsPresent,
    unauthorizedFieldsPresent,
    findings,
  };
}
