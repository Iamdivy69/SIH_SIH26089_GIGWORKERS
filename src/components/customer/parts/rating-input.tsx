"use client";

import { Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { RATING_TAGS } from "../constants";
import { cn } from "@/lib/utils";

/**
 * Reusable rating input — interactive stars, quick tag chips, comment.
 * Used when confirming completion (optionally) and rating afterwards.
 */
export function RatingInput({
  value,
  onChange,
  tags,
  onTagsChange,
  comment,
  onCommentChange,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  comment: string;
  onCommentChange: (c: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${i} star${i > 1 ? "s" : ""}`}
            onClick={() => onChange(i)}
            className="rounded-md p-1 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                i <= value
                  ? "fill-chart-4 text-chart-4"
                  : "fill-transparent text-muted-foreground/40 hover:text-muted-foreground",
              )}
              strokeWidth={1.9}
            />
          </button>
        ))}
        <span className="tnum ml-1.5 text-sm font-medium">{value > 0 ? `${value}.0 / 5` : "Not rated"}</span>
      </div>

      <div>
        <p className="micro-label mb-2">What stood out? (optional)</p>
        <div className="flex flex-wrap gap-1.5">
          {RATING_TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={active}
                onClick={() => onTagsChange(active ? tags.filter((t) => t !== tag) : [...tags, tag])}
                className={cn(
                  "rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-success-muted text-success-deep"
                    : "text-muted-foreground hover:border-primary/30 hover:text-foreground",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Share details that help other households — and the member — know what went well."
          rows={3}
          aria-label="Review comment"
        />
      </div>
    </div>
  );
}
