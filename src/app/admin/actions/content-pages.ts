"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from "@/types/database";
import {
 CONTENT_KEYS,
 DEFAULT_FAQ,
 DEFAULT_PAGES,
 type ContentPageSlug,
 type FaqItem,
 type TextPageContent,
} from "@/lib/content/static-pages";

/** value ممکن است object یا رشته JSON باشد */
function parseJsonValue(raw: unknown): unknown {
 if (raw == null) return null;
 if (typeof raw === "string") {
 const s = raw.trim();
 if (!s) return null;
 try {
 return JSON.parse(s);
 } catch {
 return null;
 }
 }
 if (typeof raw === "object") return raw;
 return null;
}

function asFaq(raw: unknown): FaqItem[] {
 const parsed = parseJsonValue(raw);
 if (!parsed || typeof parsed !== "object") return DEFAULT_FAQ;
 // شکل‌های ممکن: { items: [...] } یا خود آرایه
 const items = Array.isArray(parsed)
 ? parsed
 : (parsed as { items?: unknown }).items;
 if (!Array.isArray(items)) return DEFAULT_FAQ;
 const out: FaqItem[] = [];
 for (const it of items) {
 if (!it || typeof it !== "object") continue;
 const q = String((it as { q?: string }).q || "").trim();
 const a = String((it as { a?: string }).a || "").trim();
 if (q && a) out.push({ q, a });
 }
 return out.length ? out : DEFAULT_FAQ;
}

function asTextPage(slug: ContentPageSlug, raw: unknown): TextPageContent {
 const def = DEFAULT_PAGES[slug] || { title: slug, paragraphs: [] };
 const parsed = parseJsonValue(raw);
 if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
 return def;
 }
 const o = parsed as { title?: string; paragraphs?: unknown };
 const title = String(o.title || def.title).trim() || def.title;
 const paragraphs = Array.isArray(o.paragraphs)
 ? o.paragraphs.map((p) => String(p || "").trim()).filter(Boolean)
 : def.paragraphs;
 return { title, paragraphs: paragraphs.length ? paragraphs : def.paragraphs };
}

async function readSetting(key: string): Promise<unknown> {
 // Anon read first so public pages stay cacheable (no cookies()).
 try {
 const supabase = createPublicClient();
 const { data, error } = await supabase
 .from("site_settings")
 .select("value")
 .eq("key", key)
 .maybeSingle();
 if (!error) return data?.value ?? null;
 } catch (e) {
 console.error("[readSetting public]", key, e);
 }
 // service role fallback when RLS hides the row from anon. Cached GET so the page stays ISR.
 try {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
 const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
 if (!url || !serviceKey) return null;
 const supabase = createClient<Database>(url, serviceKey, {
 auth: { persistSession: false, autoRefreshToken: false },
 global: {
 fetch: (input, init) =>
 fetch(input, {
 ...init,
 cache: "force-cache",
 next: { revalidate: 60 },
 } as RequestInit),
 },
 });
 const { data, error } = await supabase
 .from("site_settings")
 .select("value")
 .eq("key", key)
 .maybeSingle();
 if (error) {
 console.error("[readSetting]", key, error);
 return null;
 }
 return data?.value ?? null;
 } catch (e) {
 console.error("[readSetting]", key, e);
 return null;
 }
}

export async function getFaqContentAction(): Promise<FaqItem[]> {
 try {
 const value = await readSetting(CONTENT_KEYS.faq);
 if (value == null) return DEFAULT_FAQ;
 return asFaq(value);
 } catch {
 return DEFAULT_FAQ;
 }
}

export async function getTextPageContentAction(
 slug: ContentPageSlug,
): Promise<TextPageContent> {
 const def = DEFAULT_PAGES[slug] || { title: slug, paragraphs: [] };
 if (slug === "faq") return def;
 try {
 const value = await readSetting(CONTENT_KEYS[slug]);
 if (value == null) return def;
 return asTextPage(slug, value);
 } catch {
 return def;
 }
}

export async function adminGetAllContentPagesAction() {
 const gate = await requireAdmin();
 if (!gate.ok) return { ok: false as const, error: gate.error };

 try {
 const keys = Object.values(CONTENT_KEYS);
 const { data, error } = await gate.supabase
 .from("site_settings")
 .select("key, value")
 .in("key", keys);

 if (error) {
 console.error("[adminGetAllContentPages]", error);
 return {
 ok: true as const,
 faq: DEFAULT_FAQ,
 pages: DEFAULT_PAGES,
 tableMissing: true as const,
 };
 }

 const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));

 return {
 ok: true as const,
 faq: asFaq(map.get(CONTENT_KEYS.faq)),
 pages: {
 terms: asTextPage("terms", map.get(CONTENT_KEYS.terms)),
 privacy: asTextPage("privacy", map.get(CONTENT_KEYS.privacy)),
 shipping: asTextPage("shipping", map.get(CONTENT_KEYS.shipping)),
 returns: asTextPage("returns", map.get(CONTENT_KEYS.returns)),
 warranty: asTextPage("warranty", map.get(CONTENT_KEYS.warranty)),
 } as Record<string, TextPageContent>,
 tableMissing: false as const,
 };
 } catch (e) {
 console.error("[adminGetAllContentPages]", e);
 return { ok: false as const, error: "server" as const };
 }
}

export async function adminSaveFaqAction(items: FaqItem[]) {
 const gate = await requireAdmin();
 if (!gate.ok) return { ok: false as const, error: gate.error };

 const cleaned = (items || [])
 .map((it) => ({
 q: String(it.q || "").trim(),
 a: String(it.a || "").trim(),
 }))
 .filter((it) => it.q && it.a);

 if (!cleaned.length) return { ok: false as const, error: "empty" as const };

 const payload = { items: cleaned };

 const { error } = await gate.supabase.from("site_settings").upsert(
 {
 key: CONTENT_KEYS.faq,
 value: payload,
 updated_at: new Date().toISOString(),
 },
 { onConflict: "key" },
 );
 if (error) {
 console.error("[adminSaveFaq]", error);
 // fallback: بعضی schemaها value را text می‌خواهند
 const { error: err2 } = await gate.supabase.from("site_settings").upsert(
 {
 key: CONTENT_KEYS.faq,
 value: JSON.stringify(payload) as unknown as import("@/types/database").Json,
 updated_at: new Date().toISOString(),
 },
 { onConflict: "key" },
 );
 if (err2) {
 console.error("[adminSaveFaq string]", err2);
 return { ok: false as const, error: "db" as const };
 }
 }

 revalidatePath("/faq");
 revalidatePath("/admin/pages");
 return { ok: true as const };
}

export async function adminSaveTextPageAction(
 slug: Exclude<ContentPageSlug, "faq">,
 content: TextPageContent,
) {
 const gate = await requireAdmin();
 if (!gate.ok) return { ok: false as const, error: gate.error };

 const key = CONTENT_KEYS[slug];
 if (!key) return { ok: false as const, error: "validation" as const };

 const title = String(content.title || "").trim();
 const paragraphs = (content.paragraphs || [])
 .map((p) => String(p || "").trim())
 .filter(Boolean);

 if (!title || !paragraphs.length) {
 return { ok: false as const, error: "empty" as const };
 }

 const payload = { title, paragraphs };

 const { error } = await gate.supabase.from("site_settings").upsert(
 {
 key,
 value: payload,
 updated_at: new Date().toISOString(),
 },
 { onConflict: "key" },
 );
 if (error) {
 console.error("[adminSaveTextPage]", error);
 const { error: err2 } = await gate.supabase.from("site_settings").upsert(
 {
 key,
 value: JSON.stringify(payload) as unknown as import("@/types/database").Json,
 updated_at: new Date().toISOString(),
 },
 { onConflict: "key" },
 );
 if (err2) {
 console.error("[adminSaveTextPage string]", err2);
 return { ok: false as const, error: "db" as const };
 }
 }

 revalidatePath(`/${slug}`);
 revalidatePath("/admin/pages");
 return { ok: true as const };
}
