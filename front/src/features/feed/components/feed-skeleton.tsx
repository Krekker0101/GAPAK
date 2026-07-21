export function FeedSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,680px)_360px] xl:justify-center 2xl:grid-cols-[minmax(0,720px)_380px]">
      <div className="space-y-5">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />)}
      </div>
      <div className="hidden space-y-5 xl:block">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />)}
      </div>
    </div>
  );
}
