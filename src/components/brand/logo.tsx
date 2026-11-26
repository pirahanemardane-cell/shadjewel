import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  priority?: boolean;
  /** full = icon + wordmark; mark = flower icon only */
  variant?: "full" | "mark";
  size?: "sm" | "md" | "lg" | "footer";
};

const FULL_SRC_LIGHT = "/brand/logo-light-transparent.webp";
const FULL_SRC_DARK = "/brand/logo-dark-transparent.webp";
const MARK_SRC = "/brand/mark-flower-transparent.webp";

/**
 * Full mark is ~744×537. Use explicit width+height (not w-auto) so RTL
 * overflow-x:clip on the document cannot shave the trailing letter.
 */
const fullBox = {
  sm: { className: "h-7 w-[39px]", width: 39, height: 28 },
  md: { className: "h-8 w-[44px]", width: 44, height: 32 },
  lg: { className: "h-9 w-[50px]", width: 50, height: 36 },
  footer: { className: "h-10 w-[55px]", width: 55, height: 40 },
} as const;

const markBox = {
  sm: { className: "h-7 w-7", width: 28, height: 28 },
  md: { className: "h-8 w-8", width: 32, height: 32 },
  lg: { className: "h-9 w-9", width: 36, height: 36 },
  footer: { className: "h-16 w-16", width: 64, height: 64 },
} as const;

export function Logo({
  className,
  priority = false,
  variant = "full",
  size = "md",
}: Props) {
  const box = variant === "mark" ? markBox[size] : fullBox[size];

  return (
    <Link
      href="/"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-visible",
        box.className,
        className
      )}
      aria-label="اکسسوری شاد — Shad Jewel"
    >
      {variant === "mark" ? (
        <Image
          src={MARK_SRC}
          alt="Shad Jewel"
          width={box.width}
          height={box.height}
          priority={priority}
          loading={priority ? undefined : "eager"}
          sizes={`${box.width}px`}
          className="!h-full !w-full max-w-none object-contain"
        />
      ) : (
        <>
          <Image
            src={FULL_SRC_LIGHT}
            alt="Shad Jewel"
            width={box.width}
            height={box.height}
            priority={priority}
            loading={priority ? undefined : "eager"}
            sizes={`${box.width}px`}
            className="!h-full !w-full max-w-none object-contain dark:hidden"
          />
          <Image
            src={FULL_SRC_DARK}
            alt=""
            aria-hidden
            width={box.width}
            height={box.height}
            priority={priority}
            loading={priority ? undefined : "eager"}
            sizes={`${box.width}px`}
            className="hidden !h-full !w-full max-w-none object-contain dark:block"
          />
        </>
      )}
    </Link>
  );
}
