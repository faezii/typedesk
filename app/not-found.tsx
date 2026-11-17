import { getT } from "@/lib/i18n/server";
import AppNotFound from "./(app)/not-found";

export async function generateMetadata() {
  return { title: (await getT())("Not found") };
}

/** Unmatched URLs — rendered without the app shell. */
export default function NotFound() {
  return <AppNotFound className="min-h-svh" />;
}
