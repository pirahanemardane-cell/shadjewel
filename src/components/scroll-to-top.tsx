"use client";

import { Suspense, useEffect, useLayoutEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const RETRY_MS = [0, 16, 50, 100, 200, 400] as const;

function disableBrowserScrollRestoration() {
  if (typeof window === "undefined") return;
  try {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  } catch {
    /* ignore */
  }
}

/** Force window + common nested scroll roots to the top (header). */
export function forceScrollTop() {
  if (typeof window === "undefined") return;
  disableBrowserScrollRestoration();

  // Hash targets: allow in-page anchors after clamping the document.
  const hash = window.location.hash?.slice(1);
  if (hash) {
    const target = document.getElementById(decodeURIComponent(hash));
    if (target) {
      target.scrollIntoView({ block: "start" });
      return;
    }
  }

  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  if (document.scrollingElement) {
    document.scrollingElement.scrollTop = 0;
  }

  document
    .querySelectorAll<HTMLElement>(
      "[data-scroll-root], [data-panel-scroll], main, .overflow-y-auto, .overflow-auto",
    )
    .forEach((el) => {
      try {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      } catch {
        /* ignore */
      }
    });
}

function scheduleScrollTopRetries() {
  forceScrollTop();
  const raf = requestAnimationFrame(() => forceScrollTop());
  const timers = RETRY_MS.map((ms) => window.setTimeout(forceScrollTop, ms));
  return () => {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
  };
}

/**
 * Pathname-only (no Suspense) so route changes scroll immediately.
 * Search-params watcher is layered under Suspense for query-only navigations.
 */
function PathnameScrollRestoration() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    disableBrowserScrollRestoration();
  }, []);

  useLayoutEffect(() => {
    return scheduleScrollTopRetries();
  }, [pathname]);

  useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) forceScrollTop();
    }
    function onPopState() {
      scheduleScrollTopRetries();
    }
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  return null;
}

function SearchParamsScrollRestoration() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams?.toString() ?? ""}`;

  useLayoutEffect(() => {
    return scheduleScrollTopRetries();
  }, [key]);

  return null;
}

/** App Router scroll restoration: always land at the header on navigation. */
export function ScrollToTop() {
  return (
    <>
      <PathnameScrollRestoration />
      <Suspense fallback={null}>
        <SearchParamsScrollRestoration />
      </Suspense>
    </>
  );
}
