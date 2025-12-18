"use client";

import { ArrowRight, Construction } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NextStepsProps {
  steps: string[];
}

function StepCard({ step, index }: { step: string; index: number }) {
  return (
    <Card className="group hover:border-primary/50 transition-all">
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
            {index + 1}
          </span>
          <p className="text-sm">{step}</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 text-yellow-500 hover:text-yellow-500"
            >
              <span className="hidden sm:inline">Create Ticket</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2">
            <Construction className="h-4 w-4" />
            Coming soon
          </TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  );
}

export function NextSteps({ steps }: NextStepsProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Suggested Next Steps</h2>
        <Badge variant="secondary" className="gap-1 text-yellow-500">
          <Construction className="h-3 w-3 text-yellow-500" />
          Jira Integration WIP
        </Badge>
      </div>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <StepCard key={index} step={step} index={index} />
        ))}
      </div>
    </div>
  );
}
