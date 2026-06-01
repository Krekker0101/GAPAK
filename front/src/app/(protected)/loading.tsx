import { Skeleton } from "@/shared/ui/skeleton";

export default function ProtectedLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 rounded-[2rem]" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
