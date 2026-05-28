// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { activeFields, InvalidBridgeConfigError, parseBridgeConfig } from "../src/mapping.js";

describe("parseBridgeConfig", () => {
  it("accepts a well-formed config", () => {
    const cfg = parseBridgeConfig({
      fields: [
        { rawField: "email", klaviyoField: "$email", protection: "tokenized" },
        { rawField: "firstName", klaviyoField: "$first_name", protection: "masked", dataType: "string" },
      ],
    });
    expect(cfg.fields).toHaveLength(2);
    expect(cfg.fields[0].active).toBe(true);
  });

  it("respects explicit active: false", () => {
    const cfg = parseBridgeConfig({
      fields: [
        { rawField: "email", klaviyoField: "$email", protection: "tokenized" },
        { rawField: "drop", klaviyoField: "drop", protection: "none", active: false },
      ],
    });
    expect(activeFields(cfg)).toHaveLength(1);
  });

  it("rejects unknown protection levels", () => {
    expect(() =>
      parseBridgeConfig({
        fields: [{ rawField: "x", klaviyoField: "y", protection: "encrypted" }],
      })
    ).toThrow(InvalidBridgeConfigError);
  });

  it("rejects unknown data types", () => {
    expect(() =>
      parseBridgeConfig({
        fields: [{ rawField: "x", klaviyoField: "y", protection: "none", dataType: "datetime" }],
      })
    ).toThrow(InvalidBridgeConfigError);
  });

  it("rejects missing rawField", () => {
    expect(() => parseBridgeConfig({ fields: [{ klaviyoField: "y", protection: "none" }] })).toThrow(
      InvalidBridgeConfigError
    );
  });
});
