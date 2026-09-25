import { notFound } from "next/navigation";
import { listProducts } from "@/lib/catalog";
import { comboOf } from "@/lib/pricing";
import { ComboWizard } from "@/components/combo/ComboWizard";

export const metadata = { title: "Arma tu combo" };

// El wizard: dos pasos para elegir los dos pares. `par1` viene de la ficha de
// un producto ("Armar combo con este par") y abre ese color en la hoja de talla.
export default async function ArmarCombo({
  searchParams,
}: {
  searchParams: Promise<{ par1?: string; color?: string }>;
}) {
  const sp = await searchParams;
  const cards = (await listProducts()).filter((c) => c.comboMinQty != null && c.comboPriceCents != null);
  const primera = cards[0];
  const combo = primera ? comboOf(primera.comboMinQty, primera.comboPriceCents, primera.comboMixtoCents, primera.comboExoticoCents) : null;
  if (!combo) notFound();

  return (
    <ComboWizard
      cards={cards}
      combo={combo}
      par1Inicial={sp.par1 ? { slug: sp.par1, color: sp.color ?? null } : null}
    />
  );
}
