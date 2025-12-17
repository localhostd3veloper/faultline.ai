"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import CodeEditor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import { useEditorStore } from "@/lib/store/editor";
import { analyzeArtifact } from "@/app/actions/analyze";

import "highlight.js/styles/github.css";
import "highlight.js/styles/github-dark.css";
import "prismjs/themes/prism.css";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Sparkles } from "lucide-react";

export default function Editor() {
  const {
    content: markdown,
    contentType,
    metadata,
    setContent: setMarkdown,
    setMetadata,
    clearContent: clearMarkdown,
  } = useEditorStore();

  const { resolvedTheme } = useTheme();
  const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    repo: metadata?.repo || "",
    team: metadata?.team || "",
    riskTolerance: metadata?.riskTolerance || "",
    depth: metadata?.depth || "",
  });

  const stylesheetsRef = useRef<{
    githubDark?: CSSStyleSheet;
    githubLight?: CSSStyleSheet;
    prismDark?: CSSStyleSheet;
    prismLight?: CSSStyleSheet;
  }>({});

  useEffect(() => {
    if (Object.keys(stylesheetsRef.current).length === 0) {
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        if (!sheet.href) continue;
        const href = sheet.href;
        if (href.includes("github-dark.css")) {
          stylesheetsRef.current.githubDark = sheet;
        } else if (
          href.includes("github.css") &&
          !href.includes("github-dark")
        ) {
          stylesheetsRef.current.githubLight = sheet;
        } else if (href.includes("prism-tomorrow.css")) {
          stylesheetsRef.current.prismDark = sheet;
        } else if (
          href.includes("prism.css") &&
          !href.includes("prism-tomorrow")
        ) {
          stylesheetsRef.current.prismLight = sheet;
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!resolvedTheme) return;

    const isDark = resolvedTheme === "dark";
    const { githubDark, githubLight, prismDark, prismLight } =
      stylesheetsRef.current;

    if (githubDark) githubDark.disabled = !isDark;
    if (githubLight) githubLight.disabled = isDark;
    if (prismDark) prismDark.disabled = !isDark;
    if (prismLight) prismLight.disabled = isDark;
  }, [resolvedTheme]);

  const handleAnalyze = async () => {
    if (!markdown.trim()) return;

    setIsAnalyzing(true);
    try {
      setMetadata(formData);
      const result = await analyzeArtifact({
        content: markdown,
        contentType,
        metadata: formData,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.data) {
        setAnalysisJobId(result.data.job_id);
        setIsAnalyzeDialogOpen(false);
        toast.success("Analysis job started", {
          description: `Job ID: ${result.data.job_id}`,
        });
      }
    } catch (error) {
      toast.error(
        `Failed to analyze: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const isMarkdown = contentType === "markdown";

  return (
    <section className="flex h-full flex-col gap-4 px-6 py-4">
      <Dialog open={isAnalyzeDialogOpen} onOpenChange={setIsAnalyzeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Analysis Configuration</DialogTitle>
            <DialogDescription>
              Configure metadata for the analysis job.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Repository
              </label>
              <Input
                value={formData.repo}
                onChange={(e) =>
                  setFormData({ ...formData, repo: e.target.value })
                }
                placeholder="github.com/org/repo"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Team</label>
              <Input
                value={formData.team}
                onChange={(e) =>
                  setFormData({ ...formData, team: e.target.value })
                }
                placeholder="Engineering"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Risk Tolerance
              </label>
              <Input
                value={formData.riskTolerance}
                onChange={(e) =>
                  setFormData({ ...formData, riskTolerance: e.target.value })
                }
                placeholder="low, medium, high"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Depth</label>
              <Input
                value={formData.depth}
                onChange={(e) =>
                  setFormData({ ...formData, depth: e.target.value })
                }
                placeholder="shallow, medium, deep"
              />
            </div>
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !markdown.trim()}
              className="mt-2"
            >
              {isAnalyzing ? "Analyzing..." : "Start Analysis"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mx-auto h-full w-full max-w-6xl">
        {isMarkdown ? (
          <Tabs defaultValue="editor" className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={clearMarkdown}
                  disabled={!markdown}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAnalyzeDialogOpen(true)}
                  disabled={!markdown}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </Button>
              </div>
            </div>
            <TabsContent value="editor" className="flex-1 overflow-hidden">
              <div className="bg-sidebar border-muted flex h-full flex-col rounded-lg border p-3">
                <div className="bg-background flex-1 overflow-hidden rounded">
                  <div className="h-full overflow-auto rounded-lg [&_textarea]:h-full [&_textarea]:resize-none [&_textarea]:outline-none [&_textarea]:focus:outline-none [&_textarea]:focus-visible:outline-none">
                    <CodeEditor
                      autoFocus
                      value={markdown}
                      onValueChange={setMarkdown}
                      highlight={(code: string) =>
                        highlight(code, languages.markdown, "markdown")
                      }
                      padding={12}
                      style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: 14,
                        outline: "none",
                        backgroundColor: "transparent",
                        border: "none",
                        width: "100%",
                        minHeight: "100%",
                      }}
                      className="w-full rounded-lg focus:outline-none focus-visible:outline-none"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="preview" className="flex-1 overflow-hidden">
              <div className="bg-sidebar border-muted flex h-full flex-col rounded-lg border p-3">
                <div className="flex-1 overflow-auto">
                  <article className="prose dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeSanitize, rehypeHighlight]}
                    >
                      {markdown || "Nothing to preview"}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="bg-sidebar border-muted flex h-full flex-col rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Editor</h3>
              <Button
                variant="destructive"
                size="sm"
                onClick={clearMarkdown}
                disabled={!markdown}
                className="cursor-pointer disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </Button>
            </div>
            <div className="bg-background flex-1 overflow-hidden rounded">
              <div className="h-full overflow-auto rounded-lg [&_textarea]:h-full [&_textarea]:resize-none [&_textarea]:outline-none [&_textarea]:focus:outline-none [&_textarea]:focus-visible:outline-none">
                <CodeEditor
                  autoFocus
                  value={markdown}
                  onValueChange={setMarkdown}
                  highlight={(code: string) => {
                    if (contentType === "openapi-json") {
                      return highlight(code, languages.json, "json");
                    } else if (contentType === "openapi-yaml") {
                      return highlight(code, languages.yaml, "yaml");
                    }
                    return highlight(code, languages.markdown, "markdown");
                  }}
                  padding={12}
                  style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    fontSize: 14,
                    outline: "none",
                    backgroundColor: "transparent",
                    border: "none",
                    width: "100%",
                    minHeight: "100%",
                  }}
                  className="w-full rounded-lg focus:outline-none focus-visible:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>
      {analysisJobId && (
        <div className="border-primary bg-primary/10 mx-auto w-full max-w-6xl rounded-lg border p-4">
          <p className="text-sm">
            Analysis job started:{" "}
            <code className="font-mono">{analysisJobId}</code>
          </p>
        </div>
      )}
    </section>
  );
}
