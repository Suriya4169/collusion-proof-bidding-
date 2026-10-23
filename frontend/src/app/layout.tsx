import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ProcureGuard-AI | Public Procurement Integrity Suite",
  description: "MSME bid compliance, statutory payment recovery and government procurement-integrity analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable} h-full antialiased bg-slate-950 text-slate-200`}>
      <body className="flex min-h-full flex-col bg-slate-950">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
