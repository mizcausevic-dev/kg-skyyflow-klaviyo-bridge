// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { tokenize } from "../src/tokenize.js";
import { detokenize } from "../src/detokenize.js";
import { MockSkyyflowVault } from "../src/vault/mock-vault.js";
import type { KlaviyoProfileExport } from "../src/types.js";

async function loadProfiles(): Promise<KlaviyoProfileExport> {
  return JSON.parse(await readFile("fixtures/sample-klaviyo-profiles.json", "utf8"));
}

async function loadCard(): Promise<unknown> {
  return JSON.parse(await readFile("fixtures/sample-decision-card.json", "utf8"));
}

describe("tokenize", () => {
  it("replaces authorized PII with skyy_ tokens and leaves unauthorized properties raw", async () => {
    const profiles = await loadProfiles();
    const vault = new MockSkyyflowVault("test-vault-001");
    const { vaultedExport, events } = await tokenize(profiles, await loadCard(), vault);

    expect(vaultedExport.vault).toEqual({ vendor: "skyyflow", vault_id: "test-vault-001" });
    expect(vaultedExport.fields_authorized).toEqual([
      "email",
      "phone_number",
      "first_name",
      "last_name",
      "phone",
    ]);
    const ava = vaultedExport.data.find((p) => p.id === "01H7N0PROFILE1");
    expect(ava?.email).toMatch(/^skyy_/);
    expect(ava?.phone_number).toMatch(/^skyy_/);
    expect(ava?.first_name).toMatch(/^skyy_/);
    expect(ava?.last_name).toMatch(/^skyy_/);
    // Unauthorized props stay raw — the audit step is what surfaces them.
    expect(ava?.properties?.vip_segment).toBe("true");
    expect(ava?.properties?.ssn_last_four).toBe("8421");
    expect(events.length).toBeGreaterThanOrEqual(10);
  });

  it("tokenize → detokenize round-trips for an authorized caller and masks for an unauthorized one", async () => {
    const profiles = await loadProfiles();
    const vault = new MockSkyyflowVault("test-vault-002");
    const { vaultedExport } = await tokenize(profiles, await loadCard(), vault);

    const okRun = await detokenize(vaultedExport, vault, { callerRoles: ["growth-ops-lead"] });
    const ava = okRun.profiles.find((p) => p.id === "01H7N0PROFILE1");
    expect(ava?.email).toBe("ava.lin@example.test");
    expect(ava?.phone_number).toBe("+1 415 555 0148");
    expect(okRun.events.every((e) => e.disposition === "revealed")).toBe(true);

    const blockedRun = await detokenize(vaultedExport, vault, { callerRoles: ["sales-rep"] });
    const blockedAva = blockedRun.profiles.find((p) => p.id === "01H7N0PROFILE1");
    expect(blockedAva?.email).toMatch(/^skyy_/);
    expect(blockedRun.events.every((e) => e.disposition === "denied-not-authorized")).toBe(true);
  });

  it("throws if the Decision Card has no skyyflow target", async () => {
    const profiles = await loadProfiles();
    const vault = new MockSkyyflowVault();
    await expect(
      tokenize(
        profiles,
        {
          decision_card_version: "0.2",
          decision_id: "no-skyyflow",
          data_vault_targets: [
            { vendor: "piiano", fields_authorized: ["email"], reveal_roles: [] },
          ],
        },
        vault
      )
    ).rejects.toThrow(/no data_vault_targets entry/);
  });
});
