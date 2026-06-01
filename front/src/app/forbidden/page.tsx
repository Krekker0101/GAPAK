import Link from "next/link";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="max-w-xl p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-amber-200">403</p>
        <h1 className="mt-4 font-display text-4xl font-semibold">Access denied for this layer.</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Your current identity layer or permissions are not allowed to open this screen.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild>
            <Link href="/feed">Back to feed</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/settings/privacy">Review privacy rules</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
