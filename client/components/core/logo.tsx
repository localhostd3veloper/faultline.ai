import { Layers } from "lucide-react";
import Link from "next/link";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function FaultLineLogo() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight select-none"
        >
          <div className="relative flex items-center justify-center">
            <Layers className="h-6 w-6" />
          </div>
          <div className="flex items-baseline text-lg">
            <span className=" ">FaultLine</span>
            <span className="text-destructive mx-0.5">.</span>
            <span className="font-bold tracking-wide text-indigo-500">AI</span>
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        AI Architecture Reviewer & Production Readiness Assistant
      </TooltipContent>
    </Tooltip>
  );
}
