import { Heart } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="text-secondary-foreground flex justify-center gap-2 p-3 text-sm">
      Made with <Heart className="text-destructive" /> by{" "}
      <Link
        href="https://github.com/localhostd3veloper"
        target="_blank"
        className="hover:text-blue-400"
      >
        @localhostd3veloper
      </Link>
    </footer>
  );
}
