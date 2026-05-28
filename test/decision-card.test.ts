// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  InvalidDecisionCardError,
  parseDecisionCard,
  selectVaultTarget,
} from "../src/vault/decision-card.js";

async function loadSampleCard(): Promise<unknown> {
  return JSON.parse(await readFile("fixtures/sample-decision-card.json", "utf8"));
}

describe("parseDecisionCard", () => {
  it("accepts the sample v0.2 Klaviyo card", async () => {
    const parsed = parseDecisionCard(await loadSampleCard());
    expect(parsed.version).toBe("0.2");
    expect(parsed.decisionId).toBe("kg-klaviyo-2026-Q2-001");
    expect(parsed.vaultTargets[0].fieldsAuthorized).toContain("email");
    expect(parsed.vaultTargets[0].revealRoles).toEqual([
      "growth-ops-lead",
      "compliance-officer",
    ]);
  });

  it("rejects unsupported version", () => {
    expect(() =>
      parseDecisionCard({ decision_card_version: "0.9", decision_id: "future" })
    ).toThrow(InvalidDecisionCardError);
  });

  it("rejects vault target with missing fields_authorized", () => {
    expect(() =>
      parseDecisionCard({
        decision_card_version: "0.2",
        decision_id: "broken",
        data_vault_targets: [{ vendor: "skyyflow" }],
      })
    ).toThrow(InvalidDecisionCardError);
  });
});

describe("selectVaultTarget", () => {
  it("returns the target matching the requested vendor", async () => {
    const parsed = parseDecisionCard(await loadSampleCard());
    expect(selectVaultTarget(parsed, "skyyflow")?.vendor).toBe("skyyflow");
  });

  it("returns null when no target matches", async () => {
    const parsed = parseDecisionCard(await loadSampleCard());
    expect(selectVaultTarget(parsed, "piiano")).toBeNull();
  });
});
