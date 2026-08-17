import { cn } from "@/lib/utils";

/**
 * BJJ-style belt visualization. Belt block with a black tip and stripes.
 */
export default function BeltDisplay({ color = "#FFFFFF", name, stripes = 0, size = "md" }) {
  const height = size === "lg" ? "h-14" : size === "sm" ? "h-8" : "h-11";

  return (
    <div className="w-full" data-testid="belt-display">
      <div className={cn("belt-bar", height)}>
        <div className="belt-body" style={{ background: color }} />
        <div className="belt-tip">
          {Array.from({ length: Math.min(stripes, 4) }).map((_, i) => (
            <div key={i} className="stripe stripe-red" />
          ))}
        </div>
      </div>
      {name && (
        <div className="mt-2 flex items-center justify-between">
          <span className="font-heading text-lg tracking-wide">{name}</span>
          {stripes > 0 && <span className="text-xs text-zinc-400 font-mono">{stripes}º grau</span>}
        </div>
      )}
    </div>
  );
}
