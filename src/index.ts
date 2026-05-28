// SPDX-License-Identifier: AGPL-3.0-or-later

export { audit, type AuditOptions } from "./audit.js";
export { tokenize, type TokenizeOptions, type TokenizeResult } from "./tokenize.js";
export { detokenize, type DetokenizeOptions, type DetokenizeResult } from "./detokenize.js";
export {
  transform,
  type FieldTransform,
  type SyncLog,
  type TransformOptions,
  type TransformOutcome,
} from "./transform.js";
export {
  parseBridgeConfig,
  activeFields,
  InvalidBridgeConfigError,
  type BridgeConfig,
  type FieldDataType,
  type MappingField,
  type ProtectionLevel,
} from "./mapping.js";
export { maskEmail, maskField, maskGeneric, maskPhone } from "./mask.js";
export {
  auditToMarkdown,
  auditToSummary,
  tokenizeEventsToMarkdown,
  detokenizeEventsToMarkdown,
} from "./format.js";
export { MockSkyyflowVault } from "./vault/mock-vault.js";
export {
  parseDecisionCard,
  selectVaultTarget,
  InvalidDecisionCardError,
  type ParsedDecisionCard,
  type ParsedVaultTarget,
} from "./vault/decision-card.js";
export type {
  SkyyflowVault,
  TokenizeRequest,
  TokenizeResponse,
  DetokenizeRequest,
  DetokenizeResponse,
  Disposition,
} from "./vault/types.js";
export type {
  KlaviyoProfile,
  KlaviyoProfileExport,
  VaultedProfile,
  VaultedExport,
  TokenizeEvent,
  DetokenizeEvent,
  Finding,
  FindingCode,
  Severity,
  CoverageReport,
} from "./types.js";
