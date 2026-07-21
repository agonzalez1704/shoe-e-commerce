"use client";

import { useRouter } from "next/navigation";
import { Package } from "@phosphor-icons/react";
import { PackageTrackerCard } from "@/components/ui/tracker-card";

// Mexican flag (simplified tricolour — no coat of arms).
const MexicoFlag = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" className="h-4 w-6 rounded-sm ring-1 ring-inset ring-border">
    <rect width="3" height="2" fill="#fff" />
    <rect width="1" height="2" x="0" fill="#006847" />
    <rect width="1" height="2" x="2" fill="#ce1126" />
  </svg>
);

export function OrderConfirmation({
  orderNumber,
  trackUrl,
  status = "Pedido confirmado",
}: { orderNumber: string; trackUrl: string; status?: string }) {
  const router = useRouter();
  return (
    <PackageTrackerCard
      status={status}
      packageNumber={orderNumber}
      destination="Envío a México"
      destinationFlag={<MexicoFlag />}
      date="Entrega en 4–7 días hábiles"
      qrCodeValue={trackUrl}
      trackLabel="Rastrear pedido"
      onTrackClick={() => router.push("/rastrear")}
      packageImage={<Package size={104} weight="duotone" className="text-accent drop-shadow-lg" />}
    />
  );
}
