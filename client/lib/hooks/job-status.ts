import { useEffect, useState } from "react";

import { getJobResult, getJobStatus } from "@/app/actions/analyze";
import { AnalysisResult, JobStatus } from "@/lib/types";

const POLL_INTERVAL = 5000;

export function useJobStatus(jobId: string) {
  const [status, setStatus] = useState<JobStatus>(JobStatus.QUEUED);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressHint, setProgressHint] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const pollStatus = async () => {
      const { data, error: statusError } = await getJobStatus(jobId);

      if (statusError || !data) {
        setError(statusError || "Failed to fetch job status");
        if (pollInterval) clearInterval(pollInterval);
        return false;
      }

      const { status: currentStatus, progress_hint: progressHint } = data;
      setStatus(currentStatus);

      if (progressHint) {
        setProgressHint(progressHint);
      }

      switch (currentStatus) {
        case JobStatus.COMPLETED:
          if (pollInterval) clearInterval(pollInterval);
          await fetchResult();
          return false;
        case JobStatus.FAILED:
          if (pollInterval) clearInterval(pollInterval);
          setError(statusError || "Job failed");
          return false;
      }

      return true;
    };

    const fetchResult = async () => {
      const { data, error: resultError } = await getJobResult(jobId);
      if (resultError || !data) {
        setError(resultError || "Failed to fetch job result");
        return;
      }
      setResult(data);
    };

    const initPolling = async () => {
      const shouldContinue = await pollStatus();
      if (shouldContinue) {
        pollInterval = setInterval(pollStatus, POLL_INTERVAL);
      }
    };

    initPolling();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId]);

  return { status, result, error, progressHint };
}
