export interface Metadata {
  repo?: string;
  team?: string;
  riskTolerance?: string;
  depth?: string;
}

export interface AnalyzeRequest {
  content: string;
  contentType: "markdown" | "openapi-yaml" | "openapi-json";
  metadata?: Metadata;
}

export enum JobStatus {
  QUEUED = "queued",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export interface JobResponse {
  job_id: string;
  status: JobStatus;
  progress_hints?: string;
}

export interface Finding {
  title: string;
  description: string;
  category: string;
  severity: string;
  rationale: string;
  remediation: string;
}

export interface AnalysisData {
  production_readiness_score: number;
  summary: string;
  findings: Finding[];
  suggested_next_steps: string[];
}

export interface AnalysisResult {
  job_id: string;
  status: JobStatus;
  result: AnalysisData;
  markdown: string;
}
