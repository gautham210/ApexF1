import type { Metadata } from "next";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";
import CommandPalette from "@/components/ui/CommandPalette";

export const metadata: Metadata = {
  title: "ApexF1 | Premium Motorsport Analytics",
  description: "Real-time F1 telemetry, live timing, race analytics and AI-powered insights for Formula 1.",
  keywords: ["Formula 1", "F1 telemetry", "F1 live timing", "motorsport analytics"],
  openGraph: {
    title: "ApexF1",
    description: "The ultimate Formula 1 data platform",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-apex-bg text-apex-text antialiased">
        <AppLayout>
          {children}
        </AppLayout>
        <CommandPalette />
      </body>
    </html>
  );
}
