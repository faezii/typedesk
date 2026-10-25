"use client";

import ErrorPage from "./(app)/error";

/** Errors outside a page boundary, e.g. the app layout failing to reach the database. */
export default function RootError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPage {...props} className="min-h-svh" />;
}
