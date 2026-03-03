import { LoaderIcon } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<SpinnerSize, string> = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
};

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string | undefined;
  style?: React.CSSProperties | undefined;
}

export function Spinner({ size = "sm", className, style }: SpinnerProps) {
  return (
    <LoaderIcon
      className={cn("animate-spin", sizeClasses[size], className)}
      style={style}
    />
  );
}
