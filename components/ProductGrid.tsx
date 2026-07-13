import { ProductCardItem } from "@/components/ProductCardItem";
import type { ProductCard } from "@/lib/catalog";

export function ProductGrid({ products }: { products: ProductCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCardItem key={p.id} p={p} priority={i < 4} />
      ))}
    </ul>
  );
}
