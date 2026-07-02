export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="shimmer h-5 w-2/3 rounded-md" />
      <div className="shimmer mt-3 h-4 w-1/2 rounded-md" />
      <div className="shimmer mt-4 h-3 w-1/3 rounded-md" />
    </div>
  );
}