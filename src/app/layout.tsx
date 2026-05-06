import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QADesk - Test Intelligence Console",
  description: "Quality assurance dashboard for testcase management, bug fix tracking, automation logs, and AI summaries.",
  keywords: ["QA", "testcase", "bug fix", "automation", "test management"],
  authors: [{ name: "QADesk" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "QADesk",
    description: "Test intelligence console for QA operations",
    siteName: "QADesk",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "QADesk",
    description: "Test intelligence console for QA operations",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
