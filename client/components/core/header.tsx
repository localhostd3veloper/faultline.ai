import { ToggleTheme } from "./theme-switch";
import FaultLineLogo from "./logo";

export default function Header() {
  return (
    <header className="flex w-full items-center justify-between px-3 pt-3">
      <FaultLineLogo />
      <ToggleTheme />
    </header>
  );
}
