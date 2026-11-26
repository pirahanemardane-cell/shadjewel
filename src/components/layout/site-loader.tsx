/**
 * First-load overlay used to cover the hero for ~280ms (backdrop blur), which
 * delayed LCP without hiding a real navigation. The shell renders immediately.
 */
export function SiteLoaderProvider({ children }: { children: React.ReactNode }) {
  return children;
}
