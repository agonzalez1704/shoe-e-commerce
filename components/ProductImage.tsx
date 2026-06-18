import Image from "next/image";
import { ViewTransition } from "@/components/ViewTransition";

// Shared-element morph: the same `name` on PLP card and PDP hero makes the
// image fly between routes during the view transition.
export function ProductImage({
  src,
  alt,
  slug,
  width,
  height,
  priority,
  className,
}: {
  src: string;
  alt: string;
  slug: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <ViewTransition name={`product-${slug}`}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={className}
      />
    </ViewTransition>
  );
}
