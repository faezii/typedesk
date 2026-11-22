import { describe, expect, it } from "vitest";
import { passwordResetSchema } from "./team";

const token = "x".repeat(43);

describe("passwordResetSchema", () => {
  it("accepts a token with a strong, confirmed password", () =>
    expect(passwordResetSchema.safeParse({ token, next: "Secret123", confirm: "Secret123" }).success).toBe(true));

  it("rejects weak, unconfirmed or token-less submissions", () => {
    expect(passwordResetSchema.safeParse({ token, next: "short1", confirm: "short1" }).success).toBe(false);
    expect(passwordResetSchema.safeParse({ token, next: "lettersonly", confirm: "lettersonly" }).success).toBe(false);
    expect(passwordResetSchema.safeParse({ token, next: "Secret123", confirm: "Secret124" }).success).toBe(false);
    expect(passwordResetSchema.safeParse({ token: "", next: "Secret123", confirm: "Secret123" }).success).toBe(false);
  });
});
