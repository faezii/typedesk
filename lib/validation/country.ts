/**
 * Country formats: Qatar. Accept what staff actually type ("55123456", "+974-5512 3456",
 * "00974 4412 3456") and store one canonical form.
 * shortcut: Qatar only; turn these into a per-country table when other GCC countries are added.
 */

/** → "+974 5512 3456"; null unless it is an 8-digit Qatar number (mobiles start 3/5/6/7, landlines 4). */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "").replace(/^(00974|974)(?=\d{8}$)/, "");
  return /^[3-7]\d{7}$/.test(digits) ? `+974 ${digits.slice(0, 4)} ${digits.slice(4)}` : null;
}

/** Qatar ID (QID): 11 digits, stored without spaces or dashes. */
export function normalizeNationalId(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{11}$/.test(digits) ? digits : null;
}

/** CR / tax number as printed on invoices: 3–20 letters, digits, spaces, "/" or "-"; upper-cased. */
export function normalizeTaxNo(input: string): string | null {
  const v = input.trim().toUpperCase().replace(/\s+/g, " ");
  return /^[A-Z0-9][A-Z0-9 /-]{2,19}$/.test(v) ? v : null;
}
