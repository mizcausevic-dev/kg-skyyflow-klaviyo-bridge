// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { maskEmail, maskField, maskGeneric, maskPhone } from "../src/mask.js";

describe("maskEmail", () => {
  it("masks the email local part except the first and last character", () => {
    expect(maskEmail("ava.lin@example.test")).toBe("a•••••n@example.test");
  });

  it("falls back to generic masking for non-email strings", () => {
    expect(maskEmail("not-an-email")).toBe("n••••••••••l");
  });

  it("handles short local parts gracefully", () => {
    expect(maskEmail("ab@x.test")).toBe("••@x.test");
  });
});

describe("maskPhone", () => {
  it("preserves the last four digits and formatting", () => {
    expect(maskPhone("+1 415 555 0148")).toBe("+• ••• ••• 0148");
  });

  it("masks fully when fewer than four digits are present", () => {
    expect(maskPhone("123")).toBe("•••");
  });
});

describe("maskGeneric", () => {
  it("preserves the first and last character", () => {
    expect(maskGeneric("Ava")).toBe("A•a");
  });

  it("masks fully for length <= 2", () => {
    expect(maskGeneric("ok")).toBe("••");
  });
});

describe("maskField", () => {
  it("routes by field name suffix", () => {
    expect(maskField("email", "ava@example.test")).toContain("@example.test");
    expect(maskField("phone_number", "+1 415 555 0148")).toContain("0148");
    expect(maskField("firstName", "Marcus")).toBe("M••••s");
  });
});
