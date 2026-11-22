/**
 * First admin (and their center) for a fresh database:
 *   npm run create-admin -- owner@centre.qa "Full Name" ["Center name"]
 * Creates an active center (no trial) and prints a one-time password; TypeDesk asks for a new one at first sign-in.
 * Running it again for the same email resets that admin's password and reactivates them.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateTempPassword } from "../lib/passwords";

async function main() {
  const [rawEmail, name = "Administrator", center = "My center"] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Usage: npm run create-admin -- <email> "<full name>" ["<center name>"]');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const access = { role: "ADMIN" as const, isActive: true, passwordHash, mustChangePassword: true };
  if (await prisma.user.findUnique({ where: { email } })) await prisma.user.update({ where: { email }, data: access });
  else
    await prisma.organization.create({
      data: { name: center, status: "ACTIVE", users: { create: { email, name, department: "MANAGEMENT", emailVerifiedAt: new Date(), ...access } } },
    });
  await prisma.$disconnect();

  console.log(`Admin ready: ${email}\nOne-time password: ${password}\nSign in and choose a new password.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
