"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Link as LinkIcon, FileText } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { detectContentType, isValidUrl } from "@/lib/openapi";
import { fetchOpenAPIFromUrl } from "@/app/actions/fetch-openapi";

export default function Home() {
  const router = useRouter();
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [url, setUrl] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setContent, setMetadata, metadata } = useEditorStore();

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const contentType = detectContentType(file.name, content);
        setContent(content, contentType);
        router.push("/editor");
      };
      reader.readAsText(file);
    },
    [router, setContent],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        processFile(acceptedFiles[0]);
      }
    },
    [processFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/markdown": [".md", ".markdown", ".mdx"],
      "text/yaml": [".yaml", ".yml"],
      "application/json": [".json"],
    },
    multiple: false,
  });

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;

    if (!isValidUrl(url.trim())) {
      toast.error("Invalid URL", {
        description: "Please enter a valid HTTP or HTTPS URL",
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetchOpenAPIFromUrl(url.trim());
      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        const contentType = detectContentType(url, result.data);
        setContent(result.data, contentType);
        setMetadata({
          ...metadata,
          sourceUrl: url.trim(),
        });
        toast.success("Content loaded successfully");
        router.push("/editor");
      }
    } catch (error) {
      toast.error(
        `Failed to fetch: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteContent.trim()) return;
    const contentType = detectContentType("", pasteContent);
    setContent(pasteContent, contentType);
    router.push("/editor");
  };

  return (
    <section className="mt-[10%] flex h-full w-full grow flex-col items-center px-6 py-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">
          Upload or Create Content
        </h1>
        <p className="text-muted-foreground mt-2">
          Upload files (Markdown, OpenAPI), fetch from URL, or paste content
          directly.
        </p>
      </div>
      <Tabs defaultValue="upload" className="w-full max-w-2xl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="url">URL</TabsTrigger>
          <TabsTrigger value="paste">Paste</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="mt-4">
          <div className="flex flex-col gap-4">
            <div
              {...getRootProps()}
              className={`border-muted-foreground/25 hover:border-muted-foreground/50 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-colors ${
                isDragActive ? "bg-accent border-primary/50" : ""
              }`}
            >
              <input {...getInputProps()} />
              <Upload
                size={36}
                strokeWidth={1}
                className={
                  isDragActive ? "text-primary" : "text-muted-foreground"
                }
              />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDragActive
                    ? "Drop the file here"
                    : "Drag & drop or click to upload"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Supports: .md, .yaml, .yml, .json
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="url" className="mt-4">
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">
              Enter a URL to fetch OpenAPI/Swagger schema
            </p>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://api.faultline.ai/openapi.json"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
              />
              <Button
                onClick={handleUrlSubmit}
                disabled={isLoading || !url.trim()}
              >
                <LinkIcon className="h-4 w-4" />
                Fetch
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="paste" className="mt-4">
          <div className="flex flex-col gap-4">
            <textarea
              ref={pasteTextareaRef}
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste your Markdown or OpenAPI content here..."
              className="border-input bg-background min-h-50 w-full rounded-md border px-3 py-2 font-mono text-sm"
            />
            <Button onClick={handlePasteSubmit} disabled={!pasteContent.trim()}>
              <FileText className="h-4 w-4" />
              Use Content
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
