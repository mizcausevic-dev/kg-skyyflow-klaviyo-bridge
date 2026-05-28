// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Webhook → Klaviyo transform pipeline. Given a raw webhook payload, a bridge
// mapping config, a Decision Card v0.2, and a Skyyflow vault, this emits a
// Klaviyo-ready profile payload plus a sync log of every per-field decision.
//
// Authorization model:
//   - The Decision Card declares `fields_authorized` (which raw field names may
//     enter the vault).
//   - The bridge config declares per-field protection (none | masked | tokenized).
//   - A `tokenized` field that is NOT in the Decision Card's fields_authorized
//     is rejected as a violation — surfaces in the sync log as a per-field
//     `unauthorized-tokenization` outcome and the field is dropped from the
//     Klaviyo payload.
//   - `masked` and `none` need no Decision Card entry — masking does not
//     consult the vault and `none` is the operator explicitly choosing to pass
//     the raw value through.

import { activeFields, type BridgeConfig } from "./mapping.js";
import { maskField } from "./mask.js";
import { parseDecisionCard, selectVaultTarget } from "./vault/decision-card.js";
import type { SkyyflowVault } from "./vault/types.js";

export type TransformOutcome =
  | "passed-through"
  | "masked"
  | "tokenized"
  | "unauthorized-tokenization"
  | "field-missing-on-payload"
  | "field-inactive";

export interface FieldTransform {
  rawField: string;
  klaviyoField: string;
  protection: "none" | "masked" | "tokenized";
  outcome: TransformOutcome;
  /** Whatever ends up in the Klaviyo payload — token, masked value, raw value, or null when dropped. */
  finalValue: string | number | boolean | null;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  eventName: string;
  durationMs: number;
  status: "success" | "partial" | "rejected";
  totalFields: number;
  protectedFields: number;
  protectedPercent: number;
  rawPayload: Record<string, unknown>;
  klaviyoPayload: Record<string, unknown>;
  fieldTransforms: FieldTransform[];
}

export interface TransformOptions {
  eventName: string;
  vendor?: string;
  now?: () => string;
  /** If true, raw fields not in the bridge config are dropped silently. Default true. */
  dropUnknownFields?: boolean;
}

function coerceForDataType(value: unknown, dataType?: "string" | "number" | "boolean"): string | number | boolean {
  if (dataType === "number") {
    if (typeof value === "number") return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (dataType === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return Boolean(value);
  }
  return String(value);
}

/**
 * Transform one inbound webhook payload through the mapping + decision card +
 * vault. Returns a Klaviyo-ready profile body and a complete sync log.
 */
export async function transform(
  rawPayload: Record<string, unknown>,
  bridgeConfig: BridgeConfig,
  decisionCardDoc: unknown,
  vault: SkyyflowVault,
  options: TransformOptions
): Promise<SyncLog> {
  const startedAt = Date.now();
  const now = options.now ?? (() => new Date().toISOString());
  const vendor = options.vendor ?? "skyyflow";
  const parsed = parseDecisionCard(decisionCardDoc);
  const vaultTarget = selectVaultTarget(parsed, vendor);
  const authorizedSet = new Set(vaultTarget?.fieldsAuthorized ?? []);

  const klaviyoPayload: Record<string, unknown> = {};
  const transforms: FieldTransform[] = [];

  // Batch tokenize requests for efficiency.
  const toTokenize: Array<{ rawField: string; klaviyoField: string; value: string }> = [];
  for (const field of activeFields(bridgeConfig)) {
    const rawValue = rawPayload[field.rawField];
    if (rawValue === undefined || rawValue === null || rawValue === "") {
      transforms.push({
        rawField: field.rawField,
        klaviyoField: field.klaviyoField,
        protection: field.protection,
        outcome: "field-missing-on-payload",
        finalValue: null,
      });
      continue;
    }

    if (field.protection === "tokenized") {
      if (!authorizedSet.has(field.rawField)) {
        transforms.push({
          rawField: field.rawField,
          klaviyoField: field.klaviyoField,
          protection: "tokenized",
          outcome: "unauthorized-tokenization",
          finalValue: null,
        });
        continue;
      }
      toTokenize.push({
        rawField: field.rawField,
        klaviyoField: field.klaviyoField,
        value: String(rawValue),
      });
      continue;
    }

    if (field.protection === "masked") {
      const masked = maskField(field.rawField, String(rawValue));
      klaviyoPayload[field.klaviyoField] = masked;
      transforms.push({
        rawField: field.rawField,
        klaviyoField: field.klaviyoField,
        protection: "masked",
        outcome: "masked",
        finalValue: masked,
      });
      continue;
    }

    // protection === 'none' — pass through with type coercion.
    const coerced = coerceForDataType(rawValue, field.dataType);
    klaviyoPayload[field.klaviyoField] = coerced;
    transforms.push({
      rawField: field.rawField,
      klaviyoField: field.klaviyoField,
      protection: "none",
      outcome: "passed-through",
      finalValue: coerced,
    });
  }

  if (toTokenize.length > 0) {
    const responses = await vault.tokenize(
      toTokenize.map((t) => ({ field: t.rawField, value: t.value }))
    );
    for (let i = 0; i < toTokenize.length; i += 1) {
      const t = toTokenize[i];
      const response = responses[i];
      klaviyoPayload[t.klaviyoField] = response.token;
      transforms.push({
        rawField: t.rawField,
        klaviyoField: t.klaviyoField,
        protection: "tokenized",
        outcome: "tokenized",
        finalValue: response.token,
      });
    }
  }

  const protectedFields = transforms.filter(
    (t) => t.outcome === "tokenized" || t.outcome === "masked"
  ).length;
  const totalDelivered = transforms.filter(
    (t) => t.outcome === "tokenized" || t.outcome === "masked" || t.outcome === "passed-through"
  ).length;
  const protectedPercent = totalDelivered === 0 ? 0 : Math.round((protectedFields / totalDelivered) * 100);

  const status: SyncLog["status"] = transforms.some((t) => t.outcome === "unauthorized-tokenization")
    ? "partial"
    : totalDelivered === 0
      ? "rejected"
      : "success";

  return {
    id: `sync-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now(),
    eventName: options.eventName,
    durationMs: Date.now() - startedAt,
    status,
    totalFields: transforms.length,
    protectedFields,
    protectedPercent,
    rawPayload,
    klaviyoPayload,
    fieldTransforms: transforms,
  };
}
