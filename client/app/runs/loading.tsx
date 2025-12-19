import { Card, CardContent, CardHeader } from "@/components/ui/card";

function SkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="bg-muted h-5 w-64 animate-pulse rounded-md" />
            <div className="bg-muted h-4 w-32 animate-pulse rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-muted h-6 w-20 animate-pulse rounded-md" />
            <div className="bg-muted h-8 w-24 animate-pulse rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-muted h-4 w-full animate-pulse rounded-md" />
      </CardContent>
    </Card>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-6">
        <div className="bg-muted h-9 w-32 animate-pulse rounded-md" />
        <div className="bg-muted mt-2 h-4 w-96 animate-pulse rounded-md" />
      </div>

      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

