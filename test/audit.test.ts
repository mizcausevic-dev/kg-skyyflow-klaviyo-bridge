// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { audit } from "../src/audit.js";
import type { KlaviyoProfileExport } from "../src/types.js";

async function loadProfiles(): Promise<KlaviyoProfileExport> {
  return JSON.parse(await readFile("fixtures/sample-klaviyo-profiles.json", "utf8"));
}

async function loadCard(): Promise<unknown> {
  return JSON.parse(await readFile("fixtures/sample-decision-card.json", "utf8"));
}

describe("audit", () => {
  it("reports authorized + unauthorized PII across the fixture export", async () => {
    const report = audit(await loadProfiles(), await loadCard());
    expect(report.vendor).toBe("skyyflow");
    expect(report.decisionId).toBe("kg-klaviyo-2026-Q2-001");
    expect(report.profiles).toBe(3);
    expect(report.fieldsAuthorized).toEqual(["email", "phone_number", "first_name", "last_name", "phone"]);
    expect(report.revealRoles).toEqual(["growth-ops-lead", "compliance-officer"]);
    // The fixture has profile properties (vip_segment, internal_account_id, ssn_last_four)
    // which the Decision Card does NOT authorize. Each should be flagged.
    const extras = report.findings.filter((f) => f.code === "extra-pii-on-profile");
    expect(extras.length).toBeGreaterThanOrEqual(3);
    expect(report.unauthorizedFieldsPresent).toBeGreaterThan(0);
    // profile-3 has no phone_number — should produce a missing-authorized-field finding for that.
    const missingPhone = report.findings.find(
      (f) => f.code === "profile-missing-authorized-field" && f.message.includes("phone_number")
    );
    expect(missingPhone?.subjectId).toBe("01H7N0PROFILE3");
  });

  it("flags decision cards that lack a skyyflow target", async () => {
    const profiles = await loadProfiles();
    const card = {
      decision_card_version: "0.2",
      decision_id: "no-skyyflow",
      data_vault_targets: [
        {
          vendor: "piiano",
          fields_authorized: ["email"],
          reveal_roles: ["compliance-officer"],
        },
      ],
    };
    const report = audit(profiles, card);
    expect(report.ok).toBe(false);
    expect(report.findings[0].code).toBe("no-decision-card-vault-target");
  });

  it("flags decision cards with no reveal_roles declared", async () => {
    const profiles = await loadProfiles();
    const card = {
      decision_card_version: "0.2",
      decision_id: "no-reveal",
      data_vault_targets: [
        {
          vendor: "skyyflow",
          fields_authorized: ["email"],
          reveal_roles: [],
        },
      ],
    };
    const report = audit(profiles, card);
    expect(report.findings.some((f) => f.code === "no-reveal-roles-declared")).toBe(true);
  });

  it("flags decision cards with no reveal_audit_uri", async () => {
    const profiles = await loadProfiles();
    const card = {
      decision_card_version: "0.2",
      decision_id: "no-audit-uri",
      data_vault_targets: [
        {
          vendor: "skyyflow",
          fields_authorized: ["email"],
          reveal_roles: ["compliance-officer"],
        },
      ],
    };
    const report = audit(profiles, card);
    expect(report.findings.some((f) => f.code === "audit-uri-missing")).toBe(true);
  });
});
