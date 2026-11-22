import { redirect } from "next/navigation";
import { Hourglass, LogOut } from "lucide-react";
import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";
import { platformAdmins } from "@/lib/auth/platform";
import { centerBlocked, getCurrentUser } from "@/lib/auth/session";
import { getT } from "@/lib/i18n/server";
import { logout } from "@/server/actions/auth";

export async function generateMetadata() {
  return { title: (await getT())("Account paused") };
}

/** Where requireUser() sends staff of a center whose trial ended or that was suspended. */
export default async function BlockedPage() {
  const [user, t] = await Promise.all([getCurrentUser(), getT()]);
  if (!user) redirect("/login");
  const blocked = centerBlocked(user.organization);
  if (!blocked) redirect("/");
  const contact = platformAdmins()[0];
  return (
    <StatusPage
      icon={Hourglass}
      title={t(blocked)}
      className="min-h-svh"
      actions={
        <form action={logout}>
          <Button type="submit" variant="outline">
            <LogOut /> {t("Log out")}
          </Button>
        </form>
      }
    >
      {t("Your data is safe. Contact TypeDesk to continue using {center}.", { center: user.organization.name })}
      {contact && (
        <>
          {" "}
          <a href={`mailto:${contact}`} className="text-foreground font-medium underline underline-offset-2" dir="ltr">
            {contact}
          </a>
        </>
      )}
    </StatusPage>
  );
}
