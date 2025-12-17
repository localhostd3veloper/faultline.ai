import { ToggleTheme } from "./theme-switch";
import FaultLineLogo from "./logo";

export default function Header() {
  return (
    <header className="flex w-full items-center justify-between px-6 pt-6">
      <FaultLineLogo />
      <ToggleTheme />
    </header>
  );
}
