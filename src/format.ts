// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CoverageReport, DetokenizeEvent, TokenizeEvent } from "./types.js";

export function auditToMarkdown(report: CoverageReport): string {
  const lines: string[] = [];
  lines.push(`# Skyyflow → Klaviyo bridge coverage`);
  lines.push("");
  lines.push(`**Decision Card:** \`${report.decisionId}\``);
  lines.push(`**Vault target:** \`${report.vendor}\` (\`${report.vaultId ?? "no vault_id"}\`)`);
  lines.push(`**Profiles inspected:** ${report.profiles}`);
  lines.push(
    `**Fields authorized:** ${report.fieldsAuthorized.length > 0 ? report.fieldsAuthorized.map((f) => `\`${f}\``).join(", ") : "_none_"}`
  );
  lines.push(
    `**Reveal roles:** ${report.revealRoles.length > 0 ? report.revealRoles.map((r) => `\`${r}\``).join(", ") : "_none_"}`
  );
  lines.push(`**Authorized fields present across profiles:** ${report.authorizedFieldsPresent}`);
  lines.push(`**Unauthorized PII fields present across profiles:** ${report.unauthorizedFieldsPresent}`);
  lines.push("");
  lines.push(`**Overall posture:** ${report.ok ? "ok" : "needs review"}`);
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("_No findings._");
    return lines.join("\n");
  }
  lines.push(`## Findings (${report.findings.length})`);
  lines.push("");
  for (const f of report.findings) {
    lines.push(`- **[${f.severity}] ${f.code}** — ${f.subject} \`${f.subjectId}\`: ${f.message}`);
  }
  return lines.join("\n");
}

export function auditToSummary(report: CoverageReport): string {
  return [
    `decision=${report.decisionId}`,
    `vendor=${report.vendor}`,
    `profiles=${report.profiles}`,
    `authorized_fields_present=${report.authorizedFieldsPresent}`,
    `unauthorized_pii_present=${report.unauthorizedFieldsPresent}`,
    `findings=${report.findings.length}`,
    `ok=${report.ok}`,
  ].join(" ");
}

export function tokenizeEventsToMarkdown(events: TokenizeEvent[]): string {
  if (events.length === 0) return "_No tokenize events._";
  const lines = ["# Tokenize events", "", "| timestamp | profile | field | token |", "|---|---|---|---|"];
  for (const e of events) {
    lines.push(`| ${e.timestamp} | \`${e.profileId}\` | \`${e.field}\` | \`${e.token}\` |`);
  }
  return lines.join("\n");
}

export function detokenizeEventsToMarkdown(events: DetokenizeEvent[]): string {
  if (events.length === 0) return "_No detokenize events._";
  const lines = [
    "# Reveal audit",
    "",
    "| timestamp | caller_role | profile | field | disposition |",
    "|---|---|---|---|---|",
  ];
  for (const e of events) {
    lines.push(
      `| ${e.timestamp} | \`${e.callerRole}\` | \`${e.profileId}\` | \`${e.field}\` | ${e.disposition} |`
    );
  }
  return lines.join("\n");
}
