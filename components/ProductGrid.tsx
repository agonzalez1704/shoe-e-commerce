import { ProductCardItem } from "@/components/ProductCardItem";
import type { ProductCard } from "@/lib/catalog";

export function ProductGrid({ products }: { products: ProductCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3.5 gap-y-8 sm:gap-x-5 sm:gap-y-10 md:grid-cols-3">
      {products.map((p, i) => (
        <ProductCardItem key={p.id} p={p} priority={i < 4} />
      ))}
    </ul>
  );
}
