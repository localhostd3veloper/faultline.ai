"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import CodeEditor from "react-simple-code-editor";
import { highlight, languages } from "prismjs";
import { useEditorStore } from "@/lib/store/editor";

import "highlight.js/styles/github.css";
import "highlight.js/styles/github-dark.css";
import "prismjs/themes/prism.css";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-json";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, WandSparkles, FileJson, FileCode } from "lucide-react";
import AnalyzeDialog from "./components/analyze-dialog";

export default function Editor() {
  const {
    content: markdown,
    contentType,
    metadata,
    setContent: setMarkdown,
    clearContent: clearMarkdown,
  } = useEditorStore();

  const { resolvedTheme } = useTheme();
  const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);

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

  const isMarkdown = contentType === "markdown";
  const isFetched = !!metadata?.sourceUrl;

  return (
    <section className="flex h-full flex-col gap-4 px-6 py-4">
      <AnalyzeDialog
        open={isAnalyzeDialogOpen}
        onOpenChange={setIsAnalyzeDialogOpen}
        onAnalysisStarted={setAnalysisJobId}
      />

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
                  variant="ghost"
                  size="sm"
                  onClick={clearMarkdown}
                  disabled={!markdown}
                  className="text-destructive cursor-pointer disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsAnalyzeDialogOpen(true)}
                  disabled={!markdown}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  <WandSparkles className="h-4 w-4" />
                  Start Analysis
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
              <h3 className="text-xl font-semibold">
                {isFetched ? "Remote Content" : "Editor"}
              </h3>
              <div className="flex items-center gap-2">
                {isFetched && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSource(!showSource)}
                  >
                    {showSource ? "Hide Source" : "View Source"}
                  </Button>
                )}
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
                  size="sm"
                  onClick={() => setIsAnalyzeDialogOpen(true)}
                  disabled={!markdown}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  <WandSparkles className="h-4 w-4" />
                  Start Analysis
                </Button>
              </div>
            </div>

            {isFetched && !showSource ? (
              <div className="bg-background flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="bg-primary/10 rounded-full p-4">
                    {contentType === "openapi-json" ? (
                      <FileJson className="text-primary h-8 w-8" />
                    ) : (
                      <FileCode className="text-primary h-8 w-8" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-medium">
                      OpenAPI Schema Loaded
                    </h4>
                    <p className="text-muted-foreground mt-1 max-w-md text-sm">
                      Remote content from{" "}
                      <code className="bg-muted rounded px-1 break-all">
                        {metadata.sourceUrl}
                      </code>{" "}
                      has been loaded. You can now start the analysis.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSource(true)}
                    >
                      View Raw Content
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsAnalyzeDialogOpen(true)}
                    >
                      <WandSparkles className="mr-2 h-4 w-4" />
                      Configure Analysis
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
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
