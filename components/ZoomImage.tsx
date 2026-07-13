"use client";

import Image from "next/image";

// Product image that magnifies on hover (zoom origin follows the cursor) and
// opens the lightbox on click.
export function ZoomImage({
  src,
  alt,
  priority,
  onClick,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  onClick?: () => void;
}) {
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const img = e.currentTarget.querySelector("img");
    if (img) img.style.transformOrigin = `${x}% ${y}%`;
  };

  return (
    <div
      onMouseMove={onMove}
      onClick={onClick}
      className="group h-full w-full cursor-zoom-in overflow-hidden"
    >
      <Image
        src={src}
        alt={alt}
        width={800}
        height={800}
        priority={priority}
        sizes="(max-width: 768px) 100vw, 50vw"
        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.9]"
      />
    </div>
  );
}
