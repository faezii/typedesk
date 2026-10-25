import AppNotFound from "./(app)/not-found";

export const metadata = { title: "Not found" };

/** Unmatched URLs — rendered without the app shell. */
export default function NotFound() {
  return <AppNotFound className="min-h-svh" />;
}
