"use client";

import { useEffect, useState, use } from "react";
import { getJobStatus, getJobResult, type JobStatus } from "@/app/actions/analyze";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ReviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params);
  const [status, setStatus] = useState<JobStatus>("queued");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const pollStatus = async () => {
      const { data, error: statusError } = await getJobStatus(jobId);
      
      if (statusError) {
        setError(statusError);
        return;
      }

      if (data) {
        setStatus(data.status);
        if (data.status === "completed") {
          clearInterval(pollInterval);
          fetchResult();
        } else if (data.status === "failed") {
          clearInterval(pollInterval);
          setError("Analysis job failed");
        }
      }
    };

    const fetchResult = async () => {
      const { data, error: resultError } = await getJobResult(jobId);
      if (resultError) {
        setError(resultError);
      } else {
        setResult(data);
      }
    };

    pollStatus(); // Initial check
    pollInterval = setInterval(pollStatus, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId]);

  const renderStatus = () => {
    switch (status) {
      case "queued":
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-pulse" />
            <span>Job is in queue...</span>
          </div>
        );
      case "running":
        return (
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Analysis is running...</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            <span>Analysis failed</span>
          </div>
        );
      case "completed":
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
          <p className="text-muted-foreground text-sm font-mono mt-1">Job ID: {jobId}</p>
        </div>
        {renderStatus()}
      </div>

      {status !== "completed" ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Waiting for analysis results...</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

          {result?.structured && (
            <section className="bg-sidebar rounded-lg border p-6">
              <h2 className="mb-4 text-xl font-semibold">Structured Review</h2>
              <pre className="bg-background overflow-auto rounded-md p-4 text-sm font-mono border">
                {JSON.stringify(result.structured, null, 2)}
              </pre>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

