// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { parseBridgeConfig } from "../src/mapping.js";
import { transform } from "../src/transform.js";
import { MockSkyyflowVault } from "../src/vault/mock-vault.js";

async function loadJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

const ORDER_PLACED = {
  email: "ava.lin@example.test",
  firstName: "Ava",
  lastName: "Lin",
  phone: "+1 415 555 0148",
  totalSpent: "1250.00",
  orderCount: 4,
  vipStatus: true,
};

describe("transform", () => {
  it("tokenizes authorized fields, masks marked fields, and passes through metrics", async () => {
    const bridge = parseBridgeConfig(await loadJson("fixtures/sample-bridge-config.json"));
    const card = await loadJson<unknown>("fixtures/sample-decision-card.json");
    const vault = new MockSkyyflowVault();
    const log = await transform(ORDER_PLACED, bridge, card, vault, { eventName: "Order Placed" });

    expect(log.status).toBe("success");
    expect(log.eventName).toBe("Order Placed");
    expect(log.klaviyoPayload["$email"]).toMatch(/^skyy_/);
    expect(log.klaviyoPayload["$phone_number"]).toMatch(/^skyy_/);
    expect(log.klaviyoPayload["$first_name"]).toBe("A•a");
    expect(log.klaviyoPayload["$last_name"]).toBe("L•n");
    expect(log.klaviyoPayload["TotalSpent"]).toBe(1250);
    expect(log.klaviyoPayload["OrderCount"]).toBe(4);
    expect(log.klaviyoPayload["VIP_Member"]).toBe(true);
    expect(log.protectedFields).toBe(4);
    expect(log.protectedPercent).toBeGreaterThan(50);
  });

  it("drops a tokenized field with a partial status when the Decision Card does not authorize it", async () => {
    const bridge = parseBridgeConfig({
      fields: [
        { rawField: "ssn", klaviyoField: "$ssn", protection: "tokenized" },
        { rawField: "email", klaviyoField: "$email", protection: "tokenized" },
      ],
    });
    const card = await loadJson<unknown>("fixtures/sample-decision-card.json");
    const vault = new MockSkyyflowVault();
    const log = await transform(
      { ssn: "123-45-6789", email: "ava.lin@example.test" },
      bridge,
      card,
      vault,
      { eventName: "Sensitive Webhook" }
    );
    expect(log.status).toBe("partial");
    const ssnTransform = log.fieldTransforms.find((t) => t.rawField === "ssn");
    expect(ssnTransform?.outcome).toBe("unauthorized-tokenization");
    expect(log.klaviyoPayload["$ssn"]).toBeUndefined();
    expect(log.klaviyoPayload["$email"]).toMatch(/^skyy_/);
  });

  it("emits field-missing-on-payload for active fields absent from the inbound webhook", async () => {
    const bridge = parseBridgeConfig(await loadJson("fixtures/sample-bridge-config.json"));
    const card = await loadJson<unknown>("fixtures/sample-decision-card.json");
    const vault = new MockSkyyflowVault();
    const log = await transform(
      { email: "rosa.okonkwo@example.test", firstName: "Rosa" },
      bridge,
      card,
      vault,
      { eventName: "Newsletter Subscribed" }
    );
    const missingPhone = log.fieldTransforms.find((t) => t.rawField === "phone");
    expect(missingPhone?.outcome).toBe("field-missing-on-payload");
    expect(log.klaviyoPayload["$phone_number"]).toBeUndefined();
  });

  it("skips inactive fields", async () => {
    const bridge = parseBridgeConfig({
      fields: [
        { rawField: "email", klaviyoField: "$email", protection: "tokenized" },
        { rawField: "firstName", klaviyoField: "$first_name", protection: "masked", active: false },
      ],
    });
    const card = await loadJson<unknown>("fixtures/sample-decision-card.json");
    const vault = new MockSkyyflowVault();
    const log = await transform(
      { email: "ava.lin@example.test", firstName: "Ava" },
      bridge,
      card,
      vault,
      { eventName: "Order Placed" }
    );
    expect(log.fieldTransforms.find((t) => t.rawField === "firstName")).toBeUndefined();
  });
});
