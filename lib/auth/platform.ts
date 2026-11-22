import "server-only";

/** The TypeDesk owners (PLATFORM_ADMIN_EMAILS, comma-separated): they see /platform, the list of every center. */
export const platformAdmins = () =>
  (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export const isPlatformAdmin = (email: string) => platformAdmins().includes(email.toLowerCase());
