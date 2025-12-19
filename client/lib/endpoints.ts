export const ENDPOINTS = {
  artifacts: {
    analyze: "/artifacts/analyze",
  },
  jobs: {
    status: (jobId: string) => `/jobs/${jobId}`,
    result: (jobId: string) => `/jobs/${jobId}/result`,
    list: "/jobs",
  },
} as const;
