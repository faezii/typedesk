import { randomInt } from "node:crypto";

// No 0/O, 1/l/I — temporary passwords are read aloud or copied by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** 12 characters from a CSPRNG (~70 bits), always with a letter and a digit. */
export function generateTempPassword(length = 12): string {
  for (;;) {
    const pw = Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    if (/\d/.test(pw) && /[A-Za-z]/.test(pw)) return pw;
  }
}
