"use client";

import { cn } from "@/lib/utils";
import { avatarTone, initials } from "@/lib/format";

export function PersonAvatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold tracking-wide",
        sizes[size],
        avatarTone(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
