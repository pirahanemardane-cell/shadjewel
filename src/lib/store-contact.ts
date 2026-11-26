import { createPublicClient } from "@/lib/supabase/public";

export type StoreContact = {
 phone: string;
 email: string;
};

export async function getStoreContact(): Promise<StoreContact> {
 const fallback: StoreContact = { phone: "", email: "" };
 try {
 const supabase = createPublicClient();
 const { data } = await supabase
 .from("site_settings")
 .select("key, value")
 .in("key", ["store_support_phone", "store_support_email"]);
 const out = { ...fallback };
 for (const row of data ?? []) {
 const k = String((row as { key?: string }).key || "");
 const v = String((row as { value?: string }).value || "").trim();
 if (k === "store_support_phone") out.phone = v;
 if (k === "store_support_email") out.email = v;
 }
 return out;
 } catch {
 return fallback;
 }
}
