"use client";

import { AlertTriangle, Shield, Zap } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Finding } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FindingsListProps {
  findings: Finding[];
}

const SEVERITY_CONFIG: Record<
  string,
  { color: string; bg: string; icon: typeof AlertTriangle }
> = {
  High: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    icon: AlertTriangle,
  },
  Medium: {
    color: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    icon: Zap,
  },
  Low: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    icon: Shield,
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  Security: "bg-red-500/80",
  Scalability: "bg-purple-500/80",
  Reliability: "bg-blue-500/80",
  Performance: "bg-orange-500/80",
  "AI Risk": "bg-pink-500/80",
  Cloud: "bg-cyan-500/80",
};

export function FindingsList({ findings }: FindingsListProps) {
  if (!findings || findings.length === 0) return null;

  return (
    <Accordion type="single" collapsible className="space-y-3">
      {findings.map((finding, index) => {
        const severityConfig =
          SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.Low;
        const SeverityIcon = severityConfig.icon;
        const categoryColor =
          CATEGORY_COLORS[finding.category] || "bg-gray-500/80";

        return (
          <AccordionItem
            key={index}
            value={`finding-${index}`}
            className={cn("rounded-lg border px-4", severityConfig.bg)}
          >
            <AccordionTrigger className="py-4 hover:no-underline">
              <div className="flex flex-1 items-center gap-4 text-left">
                <div className="flex shrink-0 items-center gap-2">
                  <span className="min-w-[180px] font-semibold">
                    {finding.title}
                  </span>
                  <Badge className={categoryColor}>{finding.category}</Badge>
                  <Badge
                    variant="outline"
                    className={cn("gap-1", severityConfig.color)}
                  >
                    <SeverityIcon className="h-3 w-3" />
                    {finding.severity}
                  </Badge>
                </div>
                <span className="text-muted-foreground line-clamp-1 flex-1 text-sm">
                  {finding.description}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="flex items-start gap-2">
                <Badge variant="destructive">Rationale</Badge>
                <p className="text-sm">{finding.rationale}</p>
              </div>
              <div className="flex items-start gap-2">
                <Badge className="bg-green-500/80">Remediation</Badge>
                <p className="text-sm">{finding.remediation}</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
