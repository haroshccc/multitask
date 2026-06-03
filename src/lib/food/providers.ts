import type { StoreConnection } from "@/lib/types/domain";
import type { ShoppingListResult } from "./shopping-list";
import {
  shoppingListToWhatsAppText,
  whatsAppShareUrl,
} from "./shopping-list";

/**
 * Store-agnostic commerce layer. A shopping run is handed off to a store via
 * one of a few `kind`s; each maps to a provider that knows how to "export" the
 * list. `addToCart` is reserved for a future phase (real cart push) and is
 * gated behind VITE_FEATURE_SHOPPING_CART — in the MVP every store ships an
 * `exportList` only.
 */

export const SHOPPING_CART_ENABLED =
  import.meta.env.VITE_FEATURE_SHOPPING_CART === "true";

export type ExportAction =
  | { type: "open_url"; url: string; label: string }
  | { type: "copy"; text: string; label: string };

export interface ShoppingProvider {
  /** Always available — turns the list into a shareable/openable handoff. */
  exportList(
    result: ShoppingListResult,
    fromDate: string,
    toDate: string
  ): ExportAction;
  /** Phase 2 (behind SHOPPING_CART_ENABLED). Not implemented in the MVP —
   *  real cart push needs a per-store Edge Function. */
  addToCart?(
    result: ShoppingListResult,
    fromDate: string,
    toDate: string
  ): Promise<void>;
}

// --- WhatsApp / clipboard (kind: 'export') -----------------------------------

const whatsAppProvider: ShoppingProvider = {
  exportList(result, fromDate, toDate) {
    const text = shoppingListToWhatsAppText(result, fromDate, toDate);
    return { type: "open_url", url: whatsAppShareUrl(text), label: "פתח בוואטסאפ" };
  },
};

const clipboardProvider: ShoppingProvider = {
  exportList(result, fromDate, toDate) {
    const text = shoppingListToWhatsAppText(result, fromDate, toDate);
    return { type: "copy", text, label: "העתק טקסט" };
  },
};

// --- Generic deep-link (kind: 'deeplink') ------------------------------------

/** Substitutes {{list}} (URL-encoded WA text) and {{date}} placeholders in the
 *  store's base_url so a store can receive the list via its own URL scheme. If
 *  no placeholder is present we just append the list as a `?list=` query. */
function deepLinkProvider(conn: StoreConnection): ShoppingProvider {
  return {
    exportList(result, fromDate, toDate) {
      const text = shoppingListToWhatsAppText(result, fromDate, toDate);
      const base = conn.base_url ?? "";
      const encoded = encodeURIComponent(text);
      let url: string;
      if (base.includes("{{list}}") || base.includes("{{date}}")) {
        url = base
          .replace(/\{\{list\}\}/g, encoded)
          .replace(/\{\{date\}\}/g, encodeURIComponent(fromDate));
      } else if (base) {
        const sep = base.includes("?") ? "&" : "?";
        url = `${base}${sep}list=${encoded}`;
      } else {
        // No URL configured — fall back to WhatsApp so the action is never dead.
        url = whatsAppShareUrl(text);
      }
      return { type: "open_url", url, label: `פתח ב${conn.name}` };
    },
  };
}

/** Picks the right provider for a store connection. When `conn` is null we
 *  default to WhatsApp export (the historical behavior of the food module). */
export function providerForConnection(
  conn: StoreConnection | null
): ShoppingProvider {
  if (!conn) return whatsAppProvider;
  switch (conn.kind) {
    case "deeplink":
      return deepLinkProvider(conn);
    case "cart_api":
      // Cart push isn't built yet — exporting keeps the action useful.
      return deepLinkProvider(conn);
    case "export":
    default:
      // An 'export' store named like clipboard prefers copy; otherwise WA.
      return /clip|העתק|copy/i.test(conn.name)
        ? clipboardProvider
        : whatsAppProvider;
  }
}

export { whatsAppProvider, clipboardProvider };
