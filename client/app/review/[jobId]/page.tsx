"use client";

import { useEffect, useState, use } from "react";
import { getJobStatus, getJobResult } from "@/app/actions/analyze";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { JobStatus, AnalysisResult } from "@/lib/types";

const POLL_INTERVAL = 5000;

export default function ReviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const [status, setStatus] = useState<JobStatus>(JobStatus.QUEUED);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const pollStatus = async () => {
      const { data, error } = await getJobStatus(jobId);

      if (error || !data) {
        setError(error);
        if (pollInterval) clearInterval(pollInterval);
        return false;
      }

      const { status, progress_hints: progressHints } = data;
      setStatus(status);
      if (progressHints) {
        toast.info(progressHints);
      }

      switch (status) {
        case JobStatus.COMPLETED:
          if (pollInterval) clearInterval(pollInterval);
          await fetchResult();
          return false;
        case JobStatus.FAILED:
          if (pollInterval) clearInterval(pollInterval);
          setError(error);
          return false;
      }

      return true;
    };

    const fetchResult = async () => {
      const { data, error } = await getJobResult(jobId);
      if (error || !data) {
        setError(error);
        return;
      }
      setResult(data);
    };

    const initPolling = async () => {
      const shouldContinue = await pollStatus();
      if (shouldContinue) pollInterval = setInterval(pollStatus, POLL_INTERVAL);
    };

    initPolling();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId]);

  const renderStatus = () => {
    switch (status) {
      case JobStatus.QUEUED:
        return (
          <div className="text-muted-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 animate-pulse" />
            <span>Job is in queue...</span>
          </div>
        );
      case JobStatus.RUNNING:
        return (
          <div className="text-primary flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Analysis is running...</span>
          </div>
        );
      case JobStatus.FAILED:
        return (
          <div className="text-destructive flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            <span>Analysis failed</span>
          </div>
        );
      case JobStatus.COMPLETED:
        return (
          <div className="flex items-center gap-2 text-green-500">
            <CheckCircle2 className="h-5 w-5" />
            <span>Analysis complete</span>
          </div>
        );
    }
  };

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <XCircle className="text-destructive h-12 w-12" />
        <h2 className="text-xl font-bold">Error</h2>
        <p className="text-muted-foreground">{error}</p>
        <Button asChild variant="outline">
          <Link href="/editor">Back to Editor</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">Analysis Review</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            Job ID: {jobId}
          </p>
        </div>
        {renderStatus()}
      </div>

      {status !== JobStatus.COMPLETED ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <Loader2 className="text-primary h-10 w-10 animate-spin" />
          <p className="text-muted-foreground">
            Waiting for analysis results...
          </p>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-500">
          {result?.markdown && (
            <section className="bg-sidebar rounded-lg border p-6">
              <h2 className="mb-4 text-xl font-semibold">Summary</h2>
              <article className="prose dark:prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize, rehypeHighlight]}
                >
                  {result.markdown}
                </ReactMarkdown>
              </article>
            </section>
          )}

          {result?.result && (
            <section className="bg-sidebar rounded-lg border p-6">
              <h2 className="mb-4 text-xl font-semibold">Structured Review</h2>
              <pre className="bg-background overflow-auto rounded-md border p-4 font-mono text-sm">
                {JSON.stringify(result.result, null, 2)}
              </pre>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
