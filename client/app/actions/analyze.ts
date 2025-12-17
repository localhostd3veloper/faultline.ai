"use server";

import crypto from "crypto";

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

export async function analyzeArtifact(data: AnalyzeRequest) {
  try {
    if (!data.content || !data.contentType) {
      return {
        error: "content and contentType are required",
      };
    }

    if (
      data.contentType !== "markdown" &&
      data.contentType !== "openapi-yaml" &&
      data.contentType !== "openapi-json"
    ) {
      return {
        error: "Invalid contentType. Must be markdown, openapi-yaml, or openapi-json",
      };
    }

    const contentHash = crypto
      .createHash("sha256")
      .update(data.content)
      .digest("hex");

    const jobId = crypto.randomUUID();

    const analysisJob = {
      job_id: jobId,
      content_hash: contentHash,
      content_type: data.contentType,
      metadata: data.metadata || {},
      status: "pending",
      created_at: new Date().toISOString(),
    };

    return { data: analysisJob };
  } catch (error) {
    console.error("Analysis error:", error);
    return {
      error: "Internal server error",
    };
  }
}

