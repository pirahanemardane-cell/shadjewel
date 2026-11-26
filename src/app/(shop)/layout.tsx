import { Suspense } from "react";
import { BackToTop } from "@/components/layout/back-to-top";
import { NotificationsProvider } from "@/lib/notifications/notifications-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { FooterContact } from "@/components/layout/footer-contact";
import { SiteLoaderProvider } from "@/components/layout/site-loader";
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb";

export default function ShopLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 return (
 <SiteLoaderProvider>
 <NotificationsProvider>
 <div className="storefront-root flex min-h-dvh w-full min-w-0 max-w-full flex-col">
<SiteHeader />
 <div className="w-full min-w-0 max-w-full flex-1">
 <div className="w-full min-w-0 max-w-full">
 <AppBreadcrumb />
 <main id="main-content" tabIndex={-1} className="min-w-0 max-w-full outline-none">
 {children}
 </main>
 </div>
 </div>
 <div className="mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-4 px-4 py-4">
 {/* Defer contact fetch so it cannot block/stream ahead of page hero */}
 <Suspense fallback={null}>
 <FooterContact />
 </Suspense>
 </div>
 <SiteFooter />
 <BackToTop />
 </div>
 </NotificationsProvider>
 </SiteLoaderProvider>
 );
}
