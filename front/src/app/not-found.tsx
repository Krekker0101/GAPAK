import Link from "next/link";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="max-w-xl p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-primary">404</p>
        <h1 className="mt-4 font-display text-4xl font-semibold">This trust corridor does not exist.</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          The page you requested was not found. It may have expired, been moved, or requires a different access path.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/feed">Open workspace</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
