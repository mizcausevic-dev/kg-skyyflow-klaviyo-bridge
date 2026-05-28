// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import {
  auditToMarkdown,
  auditToSummary,
  detokenizeEventsToMarkdown,
  tokenizeEventsToMarkdown,
} from "../src/format.js";
import type { CoverageReport, DetokenizeEvent, TokenizeEvent } from "../src/types.js";

const baseReport: CoverageReport = {
  ok: true,
  vendor: "skyyflow",
  vaultId: "kg-klaviyo-vault-2026-q2",
  decisionId: "kg-klaviyo-2026-Q2-001",
  profiles: 3,
  fieldsAuthorized: ["email", "phone_number"],
  revealRoles: ["growth-ops-lead", "compliance-officer"],
  authorizedFieldsPresent: 5,
  unauthorizedFieldsPresent: 0,
  findings: [],
};

describe("format", () => {
  it("auditToMarkdown surfaces decision id, fields authorized, and a no-findings note when clean", () => {
    const md = auditToMarkdown(baseReport);
    expect(md).toContain("kg-klaviyo-2026-Q2-001");
    expect(md).toContain("`email`");
    expect(md).toContain("ok");
    expect(md).toContain("_No findings._");
  });

  it("auditToMarkdown renders a findings list when present", () => {
    const md = auditToMarkdown({
      ...baseReport,
      ok: false,
      findings: [
        {
          code: "extra-pii-on-profile",
          severity: "medium",
          subject: "profile",
          subjectId: "p1",
          message: "An unauthorized SSN field was found.",
        },
      ],
    });
    expect(md).toContain("Findings (1)");
    expect(md).toContain("extra-pii-on-profile");
    expect(md).toContain("p1");
  });

  it("auditToSummary returns a single-line key=value summary", () => {
    expect(auditToSummary(baseReport)).toContain("decision=kg-klaviyo-2026-Q2-001");
    expect(auditToSummary(baseReport)).toContain("findings=0");
    expect(auditToSummary(baseReport)).toContain("ok=true");
  });

  it("tokenizeEventsToMarkdown emits a table when events exist", () => {
    const events: TokenizeEvent[] = [
      { profileId: "p1", field: "email", token: "skyy_aaaa", timestamp: "2026-05-28T10:00:00Z" },
    ];
    const md = tokenizeEventsToMarkdown(events);
    expect(md).toContain("Tokenize events");
    expect(md).toContain("`skyy_aaaa`");
  });

  it("tokenizeEventsToMarkdown notes when empty", () => {
    expect(tokenizeEventsToMarkdown([])).toContain("No tokenize events");
  });

  it("detokenizeEventsToMarkdown emits a reveal audit table", () => {
    const events: DetokenizeEvent[] = [
      {
        profileId: "p1",
        field: "email",
        token: "skyy_aaaa",
        callerRole: "growth-ops-lead",
        disposition: "revealed",
        timestamp: "2026-05-28T10:00:00Z",
      },
    ];
    expect(detokenizeEventsToMarkdown(events)).toContain("Reveal audit");
    expect(detokenizeEventsToMarkdown(events)).toContain("revealed");
  });

  it("detokenizeEventsToMarkdown notes when empty", () => {
    expect(detokenizeEventsToMarkdown([])).toContain("No detokenize events");
  });
});
