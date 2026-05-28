// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Demo: runs every webhook payload template through the bridge transform
// pipeline and prints the resulting sync logs. Wired to `npm run demo:transform`.

import { readFile } from "node:fs/promises";

import { parseBridgeConfig } from "../src/mapping.js";
import { transform } from "../src/transform.js";
import { MockSkyyflowVault } from "../src/vault/mock-vault.js";

interface Template {
  eventName: string;
  payload: Record<string, unknown>;
}

async function main() {
  const templates = JSON.parse(
    await readFile("fixtures/webhook-payload-templates.json", "utf8")
  ) as Record<string, Template>;
  const bridgeConfig = parseBridgeConfig(
    JSON.parse(await readFile("fixtures/sample-bridge-config.json", "utf8"))
  );
  const decisionCard = JSON.parse(
    await readFile("fixtures/sample-decision-card.json", "utf8")
  );
  const vault = new MockSkyyflowVault("kg-klaviyo-vault-2026-q2");

  for (const [key, template] of Object.entries(templates)) {
    const log = await transform(template.payload, bridgeConfig, decisionCard, vault, {
      eventName: template.eventName,
    });
    console.log(`\n===== ${key} (${log.eventName}) =====`);
    console.log(`status=${log.status} protected=${log.protectedFields}/${log.totalFields} (${log.protectedPercent}%) duration=${log.durationMs}ms`);
    console.log("klaviyoPayload:", JSON.stringify(log.klaviyoPayload, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
