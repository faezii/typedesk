/**
 * UAE identifier normalisation. Accept what staff actually type ("0501234567",
 * "+971-50-123 4567", "784198012345671") and store one canonical form.
 */

/** → "+971 50 123 4567" (mobile) or "+971 4 123 4567" (landline); null if not a UAE number. */
export function normalizeUaePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "").replace(/^(00971|971|0)/, "");
  if (/^5\d{8}$/.test(digits)) return `+971 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  if (/^[2-9]\d{7}$/.test(digits)) return `+971 ${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4)}`;
  return null;
}

/** → "784-YYYY-NNNNNNN-C"; null unless it is 15 digits starting with 784. */
// shortcut: checks format only, not the Luhn check digit — add it if bad IDs slip through (seed IDs would need regenerating).
export function normalizeEmiratesId(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (!/^784\d{12}$/.test(digits)) return null;
  return `784-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
}

/** UAE TRN: 15 digits, conventionally starting with 100. */
export function normalizeTrn(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return /^\d{15}$/.test(digits) ? digits : null;
}
