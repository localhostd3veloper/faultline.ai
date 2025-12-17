"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Rocket, Upload, Link as LinkIcon, FileText } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor";
import { detectContentType, isValidUrl } from "@/lib/utils/openapi";
import { fetchOpenAPIFromUrl } from "@/app/actions/fetch-openapi";

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [url, setUrl] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { setContent } = useEditorStore();

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const contentType = detectContentType(file.name, content);
      setContent(content, contentType);
      router.push("/editor");
    };
    reader.readAsText(file);
  };

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

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <section className="flex h-full w-full grow flex-col items-center justify-center px-6 py-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="lg" className="animate-pulse text-lg">
            Start Review <Rocket className="text-green-400" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload or Create Content</DialogTitle>
            <DialogDescription>
              Upload files (Markdown, OpenAPI), fetch from URL, or paste content
              directly.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="upload">Upload</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
              <TabsTrigger value="paste">Paste</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4">
              <div className="flex flex-col gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.markdown,.mdx,.yaml,.yml,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={handleUploadClick}
                  className="card-button"
                  type="button"
                >
                  <Upload size={36} strokeWidth={1} />
                  Upload File
                </button>
                <p className="text-muted-foreground text-center text-sm">
                  Supports: .md, .yaml, .yml, .json (OpenAPI/Swagger)
                </p>
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
                    placeholder="https://api.example.com/openapi.json"
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
                <Button
                  onClick={handlePasteSubmit}
                  disabled={!pasteContent.trim()}
                >
                  <FileText className="h-4 w-4" />
                  Use Content
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </section>
  );
}
