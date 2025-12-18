import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 py-20">
      <Loader2 className="text-primary h-10 w-10 animate-spin" />
      <p className="text-muted-foreground text-sm font-medium">
        Loading analysis results...
      </p>
    </div>
  );
}

