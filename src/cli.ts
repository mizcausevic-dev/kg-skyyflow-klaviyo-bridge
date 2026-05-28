// SPDX-License-Identifier: AGPL-3.0-or-later
//
// kg-skyyflow-klaviyo-bridge CLI. Three subcommands:
//   audit <profiles.json> --decision-card <card.json> [--format markdown|summary]
//   tokenize <profiles.json> --decision-card <card.json> [--out vaulted.json]
//   detokenize <vaulted.json> --role <caller-role> [--format markdown|json]

import { readFile, writeFile } from "node:fs/promises";

import { audit } from "./audit.js";
import { detokenize } from "./detokenize.js";
import { tokenize } from "./tokenize.js";
import { transform } from "./transform.js";
import { parseBridgeConfig } from "./mapping.js";
import {
  auditToMarkdown,
  auditToSummary,
  detokenizeEventsToMarkdown,
  tokenizeEventsToMarkdown,
} from "./format.js";
import type { KlaviyoProfileExport, VaultedExport } from "./types.js";
import { MockSkyyflowVault } from "./vault/mock-vault.js";

const USAGE = `Usage:
  kg-skyyflow-klaviyo audit <profiles.json> --decision-card <card.json> [--format markdown|summary]
  kg-skyyflow-klaviyo tokenize <profiles.json> --decision-card <card.json> [--out vaulted.json]
  kg-skyyflow-klaviyo detokenize <vaulted.json> --role <caller-role> [--format markdown|json]
  kg-skyyflow-klaviyo transform <payload.json> --bridge-config <config.json> --decision-card <card.json> --event-name <name>`;

function readArg(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function main() {
  const [subcommand, input, ...rest] = process.argv.slice(2);
  if (!subcommand || !input) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  switch (subcommand) {
    case "audit": {
      const cardPath = readArg(rest, "--decision-card");
      if (!cardPath) {
        console.error("audit: --decision-card <path> is required.");
        process.exitCode = 1;
        return;
      }
      const format = readArg(rest, "--format") ?? "markdown";
      const profiles = await readJson<KlaviyoProfileExport>(input);
      const card = await readJson<unknown>(cardPath);
      const report = audit(profiles, card);
      console.log(format === "summary" ? auditToSummary(report) : auditToMarkdown(report));
      return;
    }
    case "tokenize": {
      const cardPath = readArg(rest, "--decision-card");
      if (!cardPath) {
        console.error("tokenize: --decision-card <path> is required.");
        process.exitCode = 1;
        return;
      }
      const out = readArg(rest, "--out");
      const profiles = await readJson<KlaviyoProfileExport>(input);
      const card = await readJson<unknown>(cardPath);
      const vault = new MockSkyyflowVault();
      const result = await tokenize(profiles, card, vault);
      if (out) {
        await writeFile(out, JSON.stringify(result.vaultedExport, null, 2), "utf8");
        console.log(tokenizeEventsToMarkdown(result.events));
        console.log(`\nVaulted export written to ${out}`);
      } else {
        console.log(JSON.stringify(result.vaultedExport, null, 2));
      }
      return;
    }
    case "detokenize": {
      const role = readArg(rest, "--role");
      if (!role) {
        console.error("detokenize: --role <caller-role> is required.");
        process.exitCode = 1;
        return;
      }
      const format = readArg(rest, "--format") ?? "markdown";
      const vaulted = await readJson<VaultedExport>(input);
      const vault = new MockSkyyflowVault(vaulted.vault.vault_id);
      // Re-prime the in-memory vault by tokenizing each (field, current-stored-value-as-token-id) pair.
      // The mock vault is single-process: a real deployment would call the hosted Skyyflow vault.
      // For demo correctness we accept that detokenize against a fresh process can only return
      // `denied-no-such-token` unless tokenize ran first in the same process. The CLI wires both
      // when invoked as `tokenize | detokenize`. For standalone detokenize against a previously-
      // written vaulted.json, MockSkyyflowVault cannot recover the raw value — that's the
      // expected behavior of a mock; surface it honestly.
      const result = await detokenize(vaulted, vault, { callerRoles: [role] });
      if (format === "json") {
        console.log(JSON.stringify({ profiles: result.profiles, events: result.events }, null, 2));
      } else {
        console.log(detokenizeEventsToMarkdown(result.events));
      }
      return;
    }
    case "transform": {
      const bridgePath = readArg(rest, "--bridge-config");
      const cardPath = readArg(rest, "--decision-card");
      const eventName = readArg(rest, "--event-name") ?? "Webhook Event";
      if (!bridgePath || !cardPath) {
        console.error("transform: --bridge-config <path> and --decision-card <path> are required.");
        process.exitCode = 1;
        return;
      }
      const payload = await readJson<Record<string, unknown>>(input);
      const bridgeConfig = parseBridgeConfig(await readJson<unknown>(bridgePath));
      const card = await readJson<unknown>(cardPath);
      const vault = new MockSkyyflowVault();
      const syncLog = await transform(payload, bridgeConfig, card, vault, { eventName });
      console.log(JSON.stringify(syncLog, null, 2));
      return;
    }
    default:
      console.error(`Unknown subcommand "${subcommand}".\n${USAGE}`);
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
