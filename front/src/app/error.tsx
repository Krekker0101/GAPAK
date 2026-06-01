"use client";

import Link from "next/link";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="max-w-xl p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-destructive">Server error</p>
          <h1 className="mt-4 font-display text-4xl font-semibold">Something broke inside the private shell.</h1>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            {error.message || "An unexpected rendering error happened while building the current view."}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/server-error">Open error page</Link>
            </Button>
          </div>
        </Card>
      </body>
    </html>
  );
}
