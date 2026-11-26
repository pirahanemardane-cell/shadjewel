import type { Metadata } from "next";
import { getTextPageContentAction } from "@/app/admin/actions/content-pages";
import { LegalView } from "@/components/content/legal-view";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "ضمانت و اصالت | اکسسوری شاد",
  description: "ضمانت کیفیت، اصالت مشخصات و نشان ضد حساسیت",
};

export default async function WarrantyPage() {
  const content = await getTextPageContentAction("warranty");
  return (
    <main className="px-4 py-8 md:py-12">
      <LegalView content={content} />
    </main>
  );
}
