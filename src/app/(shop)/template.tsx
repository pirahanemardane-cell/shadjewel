/**
 * Shop segment template: remounts on sibling route changes so the page
 * tree is fresh. Root template already mounts ScrollToTop; this keeps
 * shop navigations remounting content as an extra guarantee for tall
 * pages (home hero scrub) that previously left the viewport mid-scroll.
 */
export default function ShopTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
