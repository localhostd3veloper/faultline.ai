"use server";

import { fastApiFetch } from "@/lib/fastapi";

interface AnalyzeRequest {
  content: string;
  contentType: "markdown" | "openapi-yaml" | "openapi-json";
  metadata?: {
    repo?: string;
    team?: string;
    riskTolerance?: string;
    depth?: string;
  };
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  progress_hints?: string;
}

export async function analyzeArtifact(data: AnalyzeRequest) {
  try {
    if (!data.content || !data.contentType) {
      return { error: "content and contentType are required" };
    }

    const result = await fastApiFetch("/artifacts/analyze", {
      method: "POST",
      body: JSON.stringify({
        content: data.content,
        content_type: data.contentType,
        metadata: data.metadata || {},
      }),
    });

    return { data: result as JobResponse };
  } catch (error) {
    console.error("Analysis error:", error);
    return {
      error: error instanceof Error ? error.message : "Internal server error",
    };
  }
}

export async function getJobStatus(jobId: string) {
  try {
    const result = await fastApiFetch(`/jobs/${jobId}`);
    return { data: result as JobResponse };
  } catch (error) {
    console.error(`Status check error for ${jobId}:`, error);
    return {
      error: error instanceof Error ? error.message : "Failed to fetch status",
    };
  }
}

export async function getJobResult(jobId: string) {
  try {
    const result = await fastApiFetch(`/jobs/${jobId}/result`);
    return { data: result };
  } catch (error) {
    console.error(`Result fetch error for ${jobId}:`, error);
    return {
      error: error instanceof Error ? error.message : "Failed to fetch result",
    };
  }
}
