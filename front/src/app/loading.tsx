import { Skeleton } from "@/shared/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 md:px-6">
      <Skeleton className="h-20" />
      <Skeleton className="h-[420px]" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
