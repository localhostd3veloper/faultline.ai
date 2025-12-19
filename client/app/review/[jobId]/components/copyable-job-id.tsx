"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CopyableJobIdProps {
  jobId: string;
}

export function CopyableJobId({ jobId }: CopyableJobIdProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jobId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={handleCopy}
        className="hover:cursor-pointer hover:underline"
      >
        <p className="text-muted-foreground mt-1 flex items-center gap-2 font-mono text-sm hover:cursor-pointer hover:underline">
          Job ID: {jobId}
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </p>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {copied ? "Copied!" : "Click to copy"}
      </TooltipContent>
    </Tooltip>
  );
}
