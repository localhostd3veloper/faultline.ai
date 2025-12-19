import { FileText, History } from "lucide-react";
import Link from "next/link";

import { Button } from "../ui/button";
import FaultLineLogo from "./logo";
import { ToggleTheme } from "./theme-switch";

export default function Header() {
  return (
    <header className="flex w-full items-center justify-between px-3 pt-3">
      <FaultLineLogo />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/">
            <FileText className="h-4 w-4" />
            <span>Create Analysis</span>
          </Link>
        </Button>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <Link href="/runs">
            <History className="h-4 w-4" />
            <span>Past Runs</span>
          </Link>
        </Button>
        <ToggleTheme />
      </div>
    </header>
  );
}
