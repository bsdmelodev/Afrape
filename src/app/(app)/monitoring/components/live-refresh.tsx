"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

function isUserInteractingWithForm() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active.isContentEditable) return true;
  const tag = active.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function LiveRefresh({
  intervalMs = 2000,
  pauseWhenInteracting = false,
}: {
  intervalMs?: number;
  pauseWhenInteracting?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    if (!isPending) {
      isRefreshingRef.current = false;
    }
  }, [isPending]);

  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      if (pauseWhenInteracting && isUserInteractingWithForm()) return;
      if (isPending || isRefreshingRef.current) return;

      isRefreshingRef.current = true;
      startTransition(() => {
        router.refresh();
      });
    };

    const intervalId = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [intervalMs, isPending, pauseWhenInteracting, router, startTransition]);

  return null;
}
