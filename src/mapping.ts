// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Bridge mapping config — declares how raw webhook fields translate to Klaviyo
// profile keys and which protection strategy to apply at the seam. This is
// IMPLEMENTATION DETAIL, not a buyer-published contract: the Decision Card
// v0.2 still gates which fields may be vaulted at all. The bridge config
// chooses HOW each authorized field gets transformed.

export type ProtectionLevel = "none" | "masked" | "tokenized";

export type FieldDataType = "string" | "number" | "boolean";

export interface MappingField {
  /** Field name on the inbound webhook payload (e.g., "firstName"). */
  rawField: string;
  /** Klaviyo profile field name (e.g., "$first_name", "TotalSpent"). */
  klaviyoField: string;
  /** Protection strategy applied at the seam. */
  protection: ProtectionLevel;
  /** Optional dataType hint — surfaces in audit + helps the simulator type-coerce. */
  dataType?: FieldDataType;
  /** Disabled rows are skipped during transform. Defaults to true. */
  active?: boolean;
}

export interface BridgeConfig {
  fields: MappingField[];
}

export class InvalidBridgeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBridgeConfigError";
  }
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidBridgeConfigError(`${field} must be a non-empty string.`);
  }
  return value;
}

const VALID_PROTECTION = new Set<ProtectionLevel>(["none", "masked", "tokenized"]);
const VALID_DATA_TYPE = new Set<FieldDataType>(["string", "number", "boolean"]);

export function parseBridgeConfig(raw: unknown): BridgeConfig {
  if (!raw || typeof raw !== "object") {
    throw new InvalidBridgeConfigError("Bridge config must be a JSON object.");
  }
  const doc = raw as Record<string, unknown>;
  const fields = doc.fields;
  if (!Array.isArray(fields)) {
    throw new InvalidBridgeConfigError("fields must be an array.");
  }
  const parsed: MappingField[] = fields.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new InvalidBridgeConfigError(`fields[${index}] must be an object.`);
    }
    const e = entry as Record<string, unknown>;
    const protection = asString(e.protection, `fields[${index}].protection`);
    if (!VALID_PROTECTION.has(protection as ProtectionLevel)) {
      throw new InvalidBridgeConfigError(
        `fields[${index}].protection "${protection}" is not one of "none" | "masked" | "tokenized".`
      );
    }
    const out: MappingField = {
      rawField: asString(e.rawField, `fields[${index}].rawField`),
      klaviyoField: asString(e.klaviyoField, `fields[${index}].klaviyoField`),
      protection: protection as ProtectionLevel,
      active: typeof e.active === "boolean" ? e.active : true,
    };
    if (typeof e.dataType === "string") {
      if (!VALID_DATA_TYPE.has(e.dataType as FieldDataType)) {
        throw new InvalidBridgeConfigError(
          `fields[${index}].dataType "${e.dataType}" is not one of "string" | "number" | "boolean".`
        );
      }
      out.dataType = e.dataType as FieldDataType;
    }
    return out;
  });
  return { fields: parsed };
}

export function activeFields(config: BridgeConfig): MappingField[] {
  return config.fields.filter((f) => f.active !== false);
}
