import { Star } from "@phosphor-icons/react/dist/ssr";

// Static star rating display (rounds to nearest whole for fill).
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5 text-accent" aria-label={`${value.toFixed(1)} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} weight={n <= rounded ? "fill" : "regular"} />
      ))}
    </span>
  );
}
