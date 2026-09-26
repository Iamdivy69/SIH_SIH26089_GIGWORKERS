import { cn } from "@/lib/utils";

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--primary)" />
      <path
        d="M20.5 10.8c-1.25-1.15-2.85-1.8-4.6-1.8-3.55 0-5.9 2.35-5.9 5s2.35 5 5.9 5c1.75 0 3.35-.65 4.6-1.8"
        stroke="white"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandWordmark({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark size={compact ? 26 : 30} />
      <span className="leading-none">
        <span className="block text-[15px] font-semibold tracking-tight">Sahyog</span>
        {!compact && <span className="mt-0.5 block text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Cooperative Services</span>}
      </span>
    </span>
  );
}
