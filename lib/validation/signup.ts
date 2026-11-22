import { z } from "zod";
import { normalizePhone } from "./country";
import { newPassword } from "./team";

export const TRIAL_DAYS = 30;

/** A new center and its first admin. `website` is a honeypot: people never see it, bots fill it in. */
export const signUpSchema = z
  .object({
    center: z.string().trim().min(2, "Enter your center's name").max(120),
    name: z.string().trim().min(2, "Enter your name").max(120),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address")),
    phone: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = normalizePhone(v);
        if (!n) ctx.addIssue({ code: "custom", message: "Use a Qatar number, e.g. +974 5512 3456" });
        return n;
      }),
    password: newPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
