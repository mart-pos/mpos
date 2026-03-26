"use client";

import * as React from "react";

import { SidebarProvider } from "@/components/ui/sidebar";

function SidebarProviderApp({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "300px",
        } as React.CSSProperties
      }
      defaultOpen
      open
    >
      {children}
    </SidebarProvider>
  );
}

export { SidebarProviderApp };
