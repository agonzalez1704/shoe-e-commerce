"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X, CaretLeft, CaretRight } from "@phosphor-icons/react";

type Img = { url: string; alt?: string | null };

// Full-screen image viewer with prev/next + keyboard (Esc, ← →) navigation.
export function Lightbox({
  images,
  index,
  onClose,
  onIndex,
  name,
}: {
  images: Img[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  name: string;
}) {
  const many = images.length > 1;
  const go = (d: number) => onIndex((index + d + images.length) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) go(1);
      else if (e.key === "ArrowLeft" && many) go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length]);

  const img = images[index];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X size={20} weight="bold" />
      </button>

      {many && (
        <button
          onClick={(e) => { e.stopPropagation(); go(-1); }}
          aria-label="Anterior"
          className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-6"
        >
          <CaretLeft size={22} weight="bold" />
        </button>
      )}

      <div className="relative flex max-h-[88vh] max-w-[92vw] items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <Image
          src={img.url}
          alt={img.alt ?? name}
          width={1400}
          height={1400}
          priority
          className="max-h-[88vh] w-auto object-contain"
        />
      </div>

      {many && (
        <button
          onClick={(e) => { e.stopPropagation(); go(1); }}
          aria-label="Siguiente"
          className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-6"
        >
          <CaretRight size={22} weight="bold" />
        </button>
      )}

      {many && (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
          {index + 1} / {images.length}
        </span>
      )}
    </div>
  );
}
