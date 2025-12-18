"use client";

import { Brain, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useJobStatus } from "@/lib/hooks/job-status";
import { JobStatus } from "@/lib/types";

export default function JobPollingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const router = useRouter();
  const { jobId } = use(params);
  const { status, error, progressHint } = useJobStatus(jobId);

  useEffect(() => {
    if (status === JobStatus.COMPLETED) {
      router.push(`/review/${jobId}`);
    }
  }, [status, jobId, router]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <XCircle className="text-destructive h-12 w-12" />
        <h2 className="text-foreground text-xl font-bold">Analysis Failed</h2>
        <p className="text-muted-foreground max-w-md">{error}</p>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/editor">Back to Editor</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background relative flex h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* Background Glow */}
      <div className="bg-primary/5 absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[128px]" />

      <div className="z-10 flex flex-col items-center gap-12">
        {/* Simple AI Visual */}
        <div className="relative">
          <div className="bg-primary/20 absolute inset-0 animate-ping rounded-full blur-xl" />
          <div className="bg-primary/10 border-primary/20 relative flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_0_40px_-10px_rgba(var(--primary-rgb),0.3)]">
            <Brain className="text-primary h-10 w-10 animate-pulse" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4">
            <p className="text-primary text-sm font-medium transition-all duration-500">
              {progressHint || "Initializing..."}
            </p>

            <div className="bg-border h-1 w-48 overflow-hidden rounded-full">
              <div className="bg-primary h-full w-1/3 animate-[loading-simple_2s_infinite_ease-in-out]" />
            </div>
          </div>
        </div>

        <p className="text-muted-foreground font-mono text-[10px] tracking-widest uppercase opacity-50">
          Job: {jobId}
        </p>
      </div>

      <style jsx global>{`
        @keyframes loading-simple {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(200%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
      `}</style>
    </div>
  );
}
