"use client";
import React, { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // expanded by default on desktop, user can toggle
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-apex-bg">
      <Sidebar expanded={expanded} setExpanded={setExpanded} />
      <div 
        className="flex flex-col min-w-0 transition-all duration-300 flex-1"
        style={{
          marginLeft: expanded ? '260px' : '80px',
        }}
      >
        <TopBar />
        <main className="flex-1 overflow-y-auto ambient-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
