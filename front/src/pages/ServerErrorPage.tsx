import Link from "next/link";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function ServerErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="max-w-xl p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-destructive">500</p>
        <h1 className="mt-4 font-display text-4xl font-semibold">The secure channel had an internal failure.</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Use this route as the dedicated server-error state for support, monitoring, or fallback navigation.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/">Back home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/feed">Return to workspace</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
