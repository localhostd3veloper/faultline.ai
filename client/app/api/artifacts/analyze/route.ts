import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();

    if (!body.content || !body.contentType) {
      return NextResponse.json(
        { error: "content and contentType are required" },
        { status: 400 },
      );
    }

    if (
      body.contentType !== "markdown" &&
      body.contentType !== "openapi-yaml" &&
      body.contentType !== "openapi-json"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid contentType. Must be markdown, openapi-yaml, or openapi-json",
        },
        { status: 400 },
      );
    }

    const contentHash = crypto
      .createHash("sha256")
      .update(body.content)
      .digest("hex");

    const jobId = crypto.randomUUID();

    const analysisJob = {
      job_id: jobId,
      content_hash: contentHash,
      content_type: body.contentType,
      metadata: body.metadata || {},
      status: "pending",
      created_at: new Date().toISOString(),
    };

    return NextResponse.json(analysisJob, { status: 201 });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
