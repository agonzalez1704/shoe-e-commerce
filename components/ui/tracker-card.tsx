"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, QrCode } from "@phosphor-icons/react";
import { QRCodeCanvas } from "qrcode.react";

import { cn } from "@/lib/utils";

// Props for the order/package tracker confirmation card.
export interface PackageTrackerCardProps {
  status: string;
  packageNumber: string;
  destination: string;
  destinationFlag: React.ReactNode;
  date: string;
  qrCodeValue: string;
  packageImage: React.ReactNode;
  trackLabel?: string;
  onTrackClick?: () => void;
  className?: string;
}

// Animated "conveyor belt" backdrop behind the package image. Uses the theme's
// border colour so it works in light + dark.
const PackageImageContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-elevated">
    <div
      className="animate-conveyor-belt absolute inset-0 z-0 h-full w-full opacity-70"
      style={{
        backgroundImage: `
          repeating-linear-gradient(45deg, transparent, transparent 25px, var(--border) 25px, var(--border) 27px),
          repeating-linear-gradient(-45deg, transparent, transparent 25px, var(--border) 25px, var(--border) 27px)
        `,
      }}
    />
    <div className="z-10">{children}</div>
  </div>
);

export const PackageTrackerCard = ({
  status,
  packageNumber,
  destination,
  destinationFlag,
  date,
  qrCodeValue,
  packageImage,
  trackLabel = "Ver seguimiento",
  onTrackClick,
  className,
}: PackageTrackerCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface text-text shadow-[var(--shadow-md)]",
        className,
      )}
    >
      {/* Top button */}
      <div className="p-4">
        <button
          onClick={onTrackClick}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-elevated px-4 py-2 text-sm text-muted transition-colors hover:bg-border"
        >
          <CheckCircle weight="fill" className="h-4 w-4 text-green-500" />
          {trackLabel}
        </button>
      </div>

      {/* Package image */}
      <PackageImageContainer>{packageImage}</PackageImageContainer>

      {/* Details */}
      <div className="p-6">
        <div className="flex items-center gap-2">
          {destinationFlag}
          <span className="text-sm font-medium text-muted">{destination}</span>
        </div>

        <h2 className="mt-2 text-3xl font-bold tracking-tight">{status}</h2>

        <div className="mt-6 flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted">Número de pedido:</p>
            <p className="nums font-mono text-sm">{packageNumber}</p>
            <p className="text-xs text-muted">{date}</p>
          </div>

          <div className="rounded-lg border border-border p-1">
            {qrCodeValue ? (
              <QRCodeCanvas value={qrCodeValue} size={64} bgColor="transparent" fgColor="var(--text)" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center bg-elevated">
                <QrCode className="h-8 w-8 text-muted" />
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
