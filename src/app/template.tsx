import { ScrollToTop } from "@/components/scroll-to-top";

/**
 * Root template remounts on every navigation (unlike layout).
 * That guarantees ScrollToTop mounts fresh and resets scroll to the header.
 */
export default function RootTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ScrollToTop />
      {children}
    </>
  );
}
