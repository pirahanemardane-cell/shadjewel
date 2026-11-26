import { createPublicClient } from "@/lib/supabase/public";
import type { Metadata } from "next";
import { applySeoTemplate } from "@/lib/seo/template";
import { isSiteIndexable } from "@/lib/seo/indexing";

export async function metadataFromSeoPage(
 page_key: "shop_plp" | "blog_plp",
 fallback: { title: string; description: string },
): Promise<Metadata> {
 try {
 const supabase = createPublicClient();
 const { data } = await supabase
 .from("seo_page_settings")
 .select("meta_title, meta_description, og_title, og_description, og_image_url, robots_index, robots_follow, canonical_url, title")
 .eq("page_key" as never, page_key)
 .maybeSingle();
 if (!data) {
 return { title: fallback.title, description: fallback.description };
 }
 const row = data as unknown as {
 title?: string | null;
 meta_title?: string | null;
 meta_description?: string | null;
 og_title?: string | null;
 og_description?: string | null;
 og_image_url?: string | null;
 robots_index?: boolean | null;
 robots_follow?: boolean | null;
 canonical_url?: string | null;
 };
 const ctx = { name: row.title || fallback.title, title: row.title || fallback.title };
 const title = applySeoTemplate(row.meta_title, ctx) || row.title || fallback.title;
 const description =
 applySeoTemplate(row.meta_description, ctx) || fallback.description;
 return {
 title,
 description,
 alternates: row.canonical_url ? { canonical: row.canonical_url } : undefined,
 robots: {
 index: isSiteIndexable() && row.robots_index !== false,
 follow: isSiteIndexable() && row.robots_follow !== false,
 },
 openGraph: {
 title: row.og_title || title,
 description: row.og_description || description,
 images: row.og_image_url ? [{ url: row.og_image_url }] : undefined,
 },
 };
 } catch {
 return { title: fallback.title, description: fallback.description };
 }
}
