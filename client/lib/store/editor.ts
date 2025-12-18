import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ContentType = "markdown" | "openapi-yaml" | "openapi-json";

interface EditorStore {
  content: string;
  contentType: ContentType;
  metadata?: {
    repo?: string;
    team?: string;
    riskTolerance?: string;
    depth?: string;
    sourceUrl?: string;
  };
  setContent: (content: string, type?: ContentType) => void;
  setMetadata: (metadata: EditorStore["metadata"]) => void;
  clearContent: () => void;
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set) => ({
      content: "",
      contentType: "markdown",
      metadata: undefined,
      setContent: (content: string, type: ContentType = "markdown") =>
        set({ content, contentType: type }),
      setMetadata: (metadata) => set({ metadata }),
      clearContent: () =>
        set({ content: "", contentType: "markdown", metadata: undefined }),
    }),
    {
      name: "ms",
    },
  ),
);
