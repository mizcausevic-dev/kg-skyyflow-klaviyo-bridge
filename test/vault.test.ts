// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { MockSkyyflowVault } from "../src/vault/mock-vault.js";

describe("MockSkyyflowVault", () => {
  it("issues opaque deterministic tokens shaped skyy_<hex16>", async () => {
    const vault = new MockSkyyflowVault("kg-klaviyo-vault-2026-q2");
    const [r] = await vault.tokenize([{ field: "email", value: "ava.lin@example.test" }]);
    expect(r.token).toMatch(/^skyy_[0-9a-f]{16}$/);
    expect(r.token).not.toContain("ava.lin");
  });

  it("rejects detokenize when caller roles do not intersect reveal roles", async () => {
    const vault = new MockSkyyflowVault();
    const [t] = await vault.tokenize([{ field: "phone_number", value: "+1 415 555 0148" }]);
    const [d] = await vault.detokenize(
      [{ field: "phone_number", token: t.token }],
      { callerRoles: ["sales-rep"], revealRoles: ["growth-ops-lead"] }
    );
    expect(d.disposition).toBe("denied-not-authorized");
    expect(d.value).toBeNull();
  });

  it("reveals when caller has an authorized role", async () => {
    const vault = new MockSkyyflowVault();
    const [t] = await vault.tokenize([{ field: "phone_number", value: "+1 415 555 0148" }]);
    const [d] = await vault.detokenize(
      [{ field: "phone_number", token: t.token }],
      { callerRoles: ["growth-ops-lead"], revealRoles: ["growth-ops-lead"] }
    );
    expect(d.disposition).toBe("revealed");
    expect(d.value).toBe("+1 415 555 0148");
  });

  it("emits denied-no-such-token for unknown tokens", async () => {
    const vault = new MockSkyyflowVault();
    const [d] = await vault.detokenize(
      [{ field: "email", token: "skyy_aaaaaaaaaaaaaaaa" }],
      { callerRoles: ["growth-ops-lead"], revealRoles: ["growth-ops-lead"] }
    );
    expect(d.disposition).toBe("denied-no-such-token");
  });
});
