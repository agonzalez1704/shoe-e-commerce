export default function Loading() {
  return (
    <div className="space-y-4 py-8">
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-elevated" />
      <div className="h-72 animate-pulse rounded-2xl bg-elevated" />
      <div className="h-4 w-full animate-pulse rounded-md bg-elevated" />
      <div className="h-4 w-5/6 animate-pulse rounded-md bg-elevated" />
    </div>
  );
}
