import { activeBrand } from "@/lib/brand";

// Site constants. Brand identity comes from the active brand config; only the
// deployment URL is env-driven.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = activeBrand.name;
export const SITE_DESCRIPTION = activeBrand.description;
