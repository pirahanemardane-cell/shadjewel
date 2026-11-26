"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { getMyProfileAction, mergeGuestCartAction } from "@/app/(shop)/actions/shop";
import { useServerCartStore } from "@/lib/server-cart-store";

type Props = {
  className?: string;
  onNavigate?: () => void;
  fullWidth?: boolean;
};

/** Supabase session cookies only. Guests have none, so the header must not wait on them. */
function hasAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((part) => {
    const name = (part.split("=")[0] ?? "").trim();
    return name.includes("auth-token");
  });
}

export function HeaderAuthButton({ className, onNavigate, fullWidth }: Props) {
  /**
   * "" = guest login link (also the first paint, including SSR).
   * A non-empty string is the signed-in account label.
   * There is no loading placeholder: guests must be clickable immediately.
   */
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!hasAuthCookie()) return;
    let cancelled = false;
    // Provisional account control before the profile round-trip. Not a "…" placeholder.
    setLabel((current) => current || "حساب من");
    (async () => {
      try {
        const res = await getMyProfileAction();
        if (cancelled) return;
        if (res.ok) {
          const phone = (res.profile?.phone || "").trim();
          setLabel(phone || "حساب من");
          try {
            await mergeGuestCartAction();
            await useServerCartStore.getState().refresh();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("pm:cart-changed"));
            }
          } catch {
            /* ignore */
          }
        } else {
          setLabel("");
        }
      } catch {
        if (!cancelled) setLabel("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const guestClass =
    className ||
    (fullWidth
      ? "bg-primary text-primary-foreground flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium"
      : "border-border hover:bg-primary hover:text-primary-foreground inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm");

  const userClass =
    className ||
    (fullWidth
      ? "border-border hover:bg-muted flex h-10 w-full items-center justify-center truncate rounded-xl border px-3 text-sm font-medium"
      : "border-border hover:bg-muted inline-flex h-10 max-w-[11rem] shrink-0 items-center truncate rounded-xl border px-2.5 text-sm tabular-nums");

  if (label) {
    return (
      <Link
        href="/داشبورد?tab=profile"
        onClick={onNavigate}
        title={label}
        className={userClass}
        dir="ltr"
      >
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <Link href="/ورود" onClick={onNavigate} className={guestClass}>
      <UserRound className="h-4 w-4" />
      ورود
    </Link>
  );
}
