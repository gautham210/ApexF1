import { cn } from "@/lib/utils";
import { forwardRef, type HTMLAttributes } from "react";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "subtle";
}

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "glass",
      strong: "glass-strong",
      subtle: "glass-subtle",
    };
    return <div ref={ref} className={cn(variants[variant], "rounded-2xl", className)} {...props} />;
  },
);
GlassPanel.displayName = "GlassPanel";
