"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { analyzeArtifact } from "@/app/actions/analyze";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "@/lib/store/editor";

interface AnalyzeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AnalyzeDialog({
  open,
  onOpenChange,
}: AnalyzeDialogProps) {
  const router = useRouter();
  const {
    content: markdown,
    contentType,
    metadata,
    setMetadata,
  } = useEditorStore();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [riskTolerance, setRiskTolerance] = useState(
    metadata?.riskTolerance || "",
  );
  const [depth, setDepth] = useState(metadata?.depth || "");

  const handleAnalyze = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!markdown.trim()) return;

    const formDataObj = new FormData(e.currentTarget);
    const data = {
      team: formDataObj.get("team") as string,
      riskTolerance,
      depth,
    };

    setIsAnalyzing(true);
    try {
      setMetadata(data);
      const result = await analyzeArtifact({
        content: markdown,
        contentType,
        metadata: data,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data) {
        onOpenChange(false);
        toast.success("Analysis job started", {
          description: `Job ID: ${result.data.job_id}`,
        });
        router.push(`/jobs/${result.data.job_id}`);
      }
    } catch (error) {
      toast.error(
        `Failed to analyze: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Analysis Configuration</DialogTitle>
          <DialogDescription>
            Configure metadata for the analysis job.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAnalyze} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Team</label>
            <Input
              name="team"
              defaultValue={metadata?.team}
              placeholder="Engineering"
              required
              disabled={isAnalyzing}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Risk Tolerance
            </label>
            <Select value={riskTolerance} onValueChange={setRiskTolerance}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select risk tolerance" />
              </SelectTrigger>
              <SelectContent>
                {["low", "medium", "high"].map((level) => (
                  <SelectItem key={level} value={level} className="capitalize">
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Depth</label>
            <Select value={depth} onValueChange={setDepth}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select depth" />
              </SelectTrigger>
              <SelectContent>
                {["shallow", "medium", "deep"].map((level) => (
                  <SelectItem key={level} value={level} className="capitalize">
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={isAnalyzing || !markdown.trim()}
            className="mt-2"
          >
            {isAnalyzing ? "Analyzing..." : "Start Analysis"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
