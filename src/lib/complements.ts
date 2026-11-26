import { createPublicClient } from "@/lib/supabase/public";

export type ComplementCard = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  price: number | null;
  kind: "buy_with" | "set";
};

/** Canonical Persian category slug → complementary category slugs (post-067). */
const BUY_WITH_TARGETS: Record<string, string[]> = {
  گردنبند: ["گوشواره", "دستبند", "انگشتر"],
  گوشواره: ["گردنبند", "دستبند"],
  انگشتر: ["دستبند", "گردنبند", "گوشواره"],
  دستبند: ["انگشتر", "گردنبند", "گوشواره"],
  ست: ["گردنبند", "گوشواره", "دستبند", "انگشتر"],
  اکسسوری: ["گردنبند", "گوشواره", "دستبند", "انگشتر"],
};

/** Map legacy English (and FA) category slugs to canonical FA keys. */
const CATEGORY_CANONICAL: Record<string, string> = {
  گردنبند: "گردنبند",
  گوشواره: "گوشواره",
  انگشتر: "انگشتر",
  دستبند: "دستبند",
  ست: "ست",
  اکسسوری: "اکسسوری",
  necklace: "گردنبند",
  earring: "گوشواره",
  ring: "انگشتر",
  bracelet: "دستبند",
  set: "ست",
  accessory: "اکسسوری",
};

const SET_CATEGORY_SLUGS = ["ست", "set"] as const;

function buyWithTargetsFor(categorySlug: string): string[] {
  const canonical = CATEGORY_CANONICAL[categorySlug] ?? categorySlug;
  return BUY_WITH_TARGETS[canonical] ?? [];
}

async function hydrateCards(
  products: { id: string; name: string; slug: string }[],
  kind: "buy_with" | "set",
): Promise<ComplementCard[]> {
  if (!products.length) return [];
  const supabase = createPublicClient();
  const ids = products.map((p) => p.id);
  const [{ data: images }, { data: variants }] = await Promise.all([
    supabase
      .from("product_images")
      .select("product_id, url, is_primary")
      .in("product_id", ids),
    supabase
      .from("product_variants")
      .select("product_id, price")
      .in("product_id", ids)
      .eq("is_active", true),
  ]);

  const imgMap = new Map<string, string>();
  for (const img of images ?? []) {
    if (img.is_primary && !imgMap.has(img.product_id)) {
      imgMap.set(img.product_id, img.url);
    }
  }
  for (const img of images ?? []) {
    if (!imgMap.has(img.product_id)) imgMap.set(img.product_id, img.url);
  }
  const priceMap = new Map<string, number>();
  for (const v of variants ?? []) {
    if (!priceMap.has(v.product_id) && v.price != null) {
      priceMap.set(v.product_id, Number(v.price));
    }
  }

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    image_url: imgMap.get(p.id) ?? null,
    price: priceMap.get(p.id) ?? null,
    kind,
  }));
}

/** Manual complements from product_complements, then category fallbacks (no invented SKUs). */
export async function getProductComplements(
  productId: string,
  categorySlug: string | null | undefined,
  opts?: { buyWithLimit?: number; setLimit?: number },
): Promise<{ buyWith: ComplementCard[]; sets: ComplementCard[] }> {
  const buyWithLimit = opts?.buyWithLimit ?? 4;
  const setLimit = opts?.setLimit ?? 4;
  const empty = { buyWith: [] as ComplementCard[], sets: [] as ComplementCard[] };

  try {
    const supabase = createPublicClient();

    const { data: linksRaw } = await supabase
      .from("product_complements" as never)
      .select("complement_product_id, kind, sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: true });
    const links = (linksRaw ?? []) as Array<{
      complement_product_id: string;
      kind: string;
      sort_order: number;
    }>;

    const buyIds = links
      .filter((l) => l.kind === "buy_with")
      .map((l) => l.complement_product_id);
    const setIds = links
      .filter((l) => l.kind === "set")
      .map((l) => l.complement_product_id);

    async function loadByIds(ids: string[], kind: "buy_with" | "set") {
      if (!ids.length) return [] as ComplementCard[];
      const { data } = await supabase
        .from("products")
        .select("id, name, slug")
        .in("id", ids)
        .eq("status", "published")
        .is("deleted_at", null);
      const order = new Map(ids.map((id, i) => [id, i]));
      const sorted = (data ?? []).sort(
        (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
      );
      return hydrateCards(sorted, kind);
    }

    let buyWith = await loadByIds(buyIds.slice(0, buyWithLimit), "buy_with");
    let sets = await loadByIds(setIds.slice(0, setLimit), "set");

    // Fallback: complementary categories for با این بخر
    if (buyWith.length < buyWithLimit && categorySlug) {
      const targets = buyWithTargetsFor(categorySlug);
      if (targets.length) {
        const { data: cats } = await supabase
          .from("categories")
          .select("id, slug")
          .in("slug", targets)
          .eq("is_active", true);
        const catIds = (cats ?? []).map((c) => c.id);
        if (catIds.length) {
          const exclude = new Set([productId, ...buyWith.map((b) => b.id)]);
          const { data: more } = await supabase
            .from("products")
            .select("id, name, slug")
            .in("category_id", catIds)
            .eq("status", "published")
            .is("deleted_at", null)
            .neq("id", productId)
            .limit(buyWithLimit + 4);
          const filtered = (more ?? []).filter((p) => !exclude.has(p.id));
          const extra = await hydrateCards(
            filtered.slice(0, buyWithLimit - buyWith.length),
            "buy_with",
          );
          buyWith = [...buyWith, ...extra];
        }
      }
    }

    // Fallback: products in «ست» category (FA slug after 067; EN kept for legacy DBs)
    if (sets.length < setLimit) {
      const { data: setCats } = await supabase
        .from("categories")
        .select("id")
        .in("slug", [...SET_CATEGORY_SLUGS])
        .eq("is_active", true);
      const setCatIds = (setCats ?? []).map((c) => c.id);
      if (setCatIds.length) {
        const exclude = new Set([productId, ...sets.map((s) => s.id)]);
        const { data: more } = await supabase
          .from("products")
          .select("id, name, slug")
          .in("category_id", setCatIds)
          .eq("status", "published")
          .is("deleted_at", null)
          .neq("id", productId)
          .limit(setLimit + 4);
        const filtered = (more ?? []).filter((p) => !exclude.has(p.id));
        const extra = await hydrateCards(
          filtered.slice(0, setLimit - sets.length),
          "set",
        );
        sets = [...sets, ...extra];
      }
    }

    return { buyWith, sets };
  } catch (e) {
    console.error("[getProductComplements]", e);
    return empty;
  }
}
