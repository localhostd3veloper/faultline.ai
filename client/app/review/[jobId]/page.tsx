import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getJobResult } from "@/app/actions/analyze";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { FindingsList, NextSteps, ReviewCharts, ScoreRing } from "./components";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const { data, error } = await getJobResult(jobId);

  // If the backend says the job isn't done yet (400), redirect to polling page
  if (error?.includes("400")) {
    redirect(`/jobs/${jobId}`);
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <XCircle className="text-destructive h-12 w-12" />
        <h2 className="text-xl font-semibold">Error</h2>
        <p className="text-muted-foreground max-w-md">
          {error || "Failed to fetch analysis results"}
        </p>
        <Button asChild variant="outline">
          <Link href="/editor">Back to Editor</Link>
        </Button>
      </div>
    );
  }

  const { result } = data;
  const {
    production_readiness_score: score,
    summary,
    findings,
    charts,
    suggested_next_steps,
  } = result;

  return (
    <TooltipProvider>
      <div className="animate-in fade-in mx-auto w-full max-w-6xl px-6 py-10 duration-700">
        <div className="mb-4 flex items-start justify-between gap-6 border-b pb-4">
          <div className="flex items-start gap-4">
            {score !== undefined && <ScoreRing score={score} />}
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Analysis Review</h1>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-muted-foreground mt-1 font-mono text-sm hover:cursor-pointer hover:underline">
                    Job ID: {jobId}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom">Click to copy</TooltipContent>
              </Tooltip>
              {summary && (
                <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
                  {summary}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <Badge className="gap-2 border-green-500/20 bg-green-500/10 px-3 py-1 text-green-500 hover:bg-green-500/20">
              <CheckCircle2 className="h-4 w-4" />
              <span>Analysis Complete</span>
            </Badge>
          </div>
        </div>

        <div className="space-y-8">
          {charts && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">Metrics & Insights</h2>
              <ReviewCharts charts={charts} />
            </section>
          )}

          {findings && (
            <section>
              <h2 className="mb-3 text-xl font-semibold">
                Findings ({findings.length})
                <p className="text-muted-foreground mb-3 text-sm font-normal">
                  You can expand each finding to see more details.
                </p>
              </h2>
              <FindingsList findings={findings} />
            </section>
          )}

          {suggested_next_steps && (
            <section>
              <NextSteps steps={suggested_next_steps} />
            </section>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
