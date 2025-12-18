import "./globals.css";

import type { Metadata } from "next";
import { Geist_Mono, Manrope } from "next/font/google";
import { ThemeProvider } from "next-themes";

import Footer from "@/components/core/footer";
import Header from "@/components/core/header";
import { Toaster } from "@/components/ui/sonner";

const manropeSans = Manrope({
  variable: "--font-manrope-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FaultLine.ai",
  description: "AI Architecture Reviewer & Production Readiness Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${manropeSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main className="mx-auto flex h-screen max-w-480 flex-col">
            <Header />
            <div className="flex-1 overflow-auto">{children}</div>
            <Footer />
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
