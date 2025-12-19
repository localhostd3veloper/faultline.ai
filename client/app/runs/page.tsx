import { Clock, ExternalLink } from "lucide-react";
import Link from "next/link";

import { getJobList } from "@/app/actions/analyze";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JobStatus } from "@/lib/types";

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "Unknown";

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getStatusBadgeVariant(
  status: JobStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case JobStatus.COMPLETED:
      return "default";
    case JobStatus.RUNNING:
      return "secondary";
    case JobStatus.FAILED:
      return "destructive";
    default:
      return "outline";
  }
}

function getStatusLabel(status: JobStatus): string {
  switch (status) {
    case JobStatus.COMPLETED:
      return "Completed";
    case JobStatus.RUNNING:
      return "Running";
    case JobStatus.FAILED:
      return "Failed";
    case JobStatus.QUEUED:
      return "Queued";
    default:
      return status;
  }
}

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const { data, error } = await getJobList();

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-muted-foreground max-w-md">
          {error || "Failed to fetch runs"}
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  const { jobs, total, note } = data;

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Past Runs</h1>
        <p className="text-muted-foreground mt-2 text-sm">{note}</p>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              No runs found. All runs older than 60 minutes are automatically
              cleared.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/">Start New Analysis</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="animate-in fade-in space-y-4 duration-700">
          {jobs.map((job) => (
            <Card key={job.job_id} className="gap-0">
              <CardHeader className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="font-mono text-base">
                    {job.job_id}
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeAgo(job.created_at)}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={getStatusBadgeVariant(job.status)}>
                    {getStatusLabel(job.status)}
                  </Badge>
                  {job.status === JobStatus.COMPLETED && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/review/${job.job_id}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    </Button>
                  )}
                  {job.status === JobStatus.RUNNING && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/jobs/${job.job_id}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Check Status
                      </Link>
                    </Button>
                  )}
                </div>
              </CardHeader>
              {job.progress_hint && (
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    {job.progress_hint}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
