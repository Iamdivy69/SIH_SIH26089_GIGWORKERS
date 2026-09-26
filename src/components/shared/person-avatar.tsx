"use client";

import { cn } from "@/lib/utils";
import { avatarTone, initials } from "@/lib/format";

/**
 * `avatarTone()` (lib/format.ts) returns light-theme pastel pairs. Dark-mode
 * counterparts are mapped 1:1 here so avatars stay readable on dark surfaces
 * without touching lib/format.ts — hue identity is preserved per name.
 * (Consolidating these pairs into lib/format.ts is a suggested 6-d cleanup.)
 */
const DARK_TONES: Record<string, string> = {
  "bg-[oklch(0.90_0.03_155)] text-[oklch(0.35_0.06_158)]": "dark:bg-[oklch(0.30_0.035_155)] dark:text-[oklch(0.83_0.055_155)]",
  "bg-[oklch(0.92_0.025_75)] text-[oklch(0.42_0.09_70)]": "dark:bg-[oklch(0.31_0.03_75)] dark:text-[oklch(0.85_0.06_75)]",
  "bg-[oklch(0.91_0.03_240)] text-[oklch(0.38_0.05_240)]": "dark:bg-[oklch(0.30_0.03_240)] dark:text-[oklch(0.82_0.035_240)]",
  "bg-[oklch(0.92_0.03_25)] text-[oklch(0.42_0.11_28)]": "dark:bg-[oklch(0.31_0.035_25)] dark:text-[oklch(0.84_0.055_25)]",
  "bg-[oklch(0.91_0.035_190)] text-[oklch(0.36_0.05_195)]": "dark:bg-[oklch(0.30_0.035_190)] dark:text-[oklch(0.83_0.05_190)]",
  "bg-[oklch(0.92_0.028_330)] text-[oklch(0.42_0.09_330)]": "dark:bg-[oklch(0.31_0.03_330)] dark:text-[oklch(0.85_0.055_330)]",
};

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
  const tone = avatarTone(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold tracking-wide",
        sizes[size],
        tone,
        DARK_TONES[tone],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
