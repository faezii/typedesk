/**
 * First admin for a fresh (unseeded) database:
 *   npm run create-admin -- owner@centre.ae "Full Name"
 * Prints a one-time password; TypeDesk asks for a new one at first sign-in.
 * Running it again for the same email resets that admin's password and reactivates them.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateTempPassword } from "../lib/passwords";

async function main() {
  const [rawEmail, name = "Administrator"] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run create-admin -- <email> "<full name>"');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const access = { role: "ADMIN" as const, isActive: true, passwordHash, mustChangePassword: true };
  await prisma.user.upsert({ where: { email }, create: { email, name, department: "MANAGEMENT", ...access }, update: access });
  await prisma.$disconnect();

  console.log(`Admin ready: ${email}\nOne-time password: ${password}\nSign in and choose a new password.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
