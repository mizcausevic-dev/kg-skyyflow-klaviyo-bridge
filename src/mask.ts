// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Field-shape-aware masking strategies. Masking is reversible only with side
// channels (humans, hosted vault, etc.) — these functions just produce a
// display-safe form. Use `tokenize` if you need real vault-backed indirection.

const EMAIL_RE = /^([^@]+)@(.+)$/;
const PHONE_LIKE_RE = /[0-9]/;

/** Mask the local part of an email except the first and last character. */
export function maskEmail(value: string): string {
  const match = EMAIL_RE.exec(value);
  if (!match) return maskGeneric(value);
  const [, local, domain] = match;
  if (local.length <= 2) return `${"•".repeat(local.length)}@${domain}`;
  return `${local[0]}${"•".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

/** Mask the middle digits of a phone-like string, preserving the last four. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) return "•".repeat(value.length);
  const lastFour = digits.slice(-4);
  // Reconstruct a masked form with the structure of the original.
  let out = "";
  let digitsSeen = 0;
  const replaceUntilLast = digits.length - 4;
  for (const ch of value) {
    if (PHONE_LIKE_RE.test(ch)) {
      digitsSeen += 1;
      out += digitsSeen <= replaceUntilLast ? "•" : ch;
    } else {
      out += ch;
    }
  }
  // Defensive: if reconstruction failed to leave last-4 readable, fall back.
  if (!out.endsWith(lastFour)) return `•••${lastFour}`;
  return out;
}

/** Mask all but the first and last character of a generic string. */
export function maskGeneric(value: string): string {
  if (value.length <= 2) return "•".repeat(value.length);
  return `${value[0]}${"•".repeat(value.length - 2)}${value[value.length - 1]}`;
}

/** Pick the right masking strategy for a field name. */
export function maskField(field: string, value: string): string {
  if (field === "email" || field.endsWith(".email") || field.endsWith("Email")) {
    return maskEmail(value);
  }
  if (field === "phone_number" || field.endsWith("Phone") || field.endsWith(".phone")) {
    return maskPhone(value);
  }
  return maskGeneric(value);
}
