"use server";

import { api } from "@/lib/api";
import { ENDPOINTS } from "@/lib/endpoints";
import { AnalysisResult, AnalyzeRequest, JobResponse } from "@/lib/types";

export async function analyzeArtifact(data: AnalyzeRequest) {
  if (!data.content || !data.contentType) {
    return { error: "content and contentType are required", data: null };
  }

  return api<JobResponse>(ENDPOINTS.artifacts.analyze, {
    method: "POST",
    body: JSON.stringify({
      content: data.content,
      content_type: data.contentType,
      metadata: data.metadata || {},
    }),
  });
}

export async function getJobStatus(jobId: string) {
  return api<JobResponse>(ENDPOINTS.jobs.status(jobId));
}

export async function getJobResult(jobId: string) {
  return api<AnalysisResult>(ENDPOINTS.jobs.result(jobId));
}
