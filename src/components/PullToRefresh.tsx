"use client";

import { useRef, useCallback, type ReactNode } from "react";

const THRESHOLD = 64; // px to trigger refresh
const MAX_PULL = 100; // cap visual pull distance

interface Props {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
}

/**
 * Wrap scrollable content. On overscroll-pull-down past THRESHOLD, calls onRefresh.
 * ponytail: no spring physics or haptic — add when feel matters.
 */
export default function PullToRefresh({ onRefresh, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);

  const setSpinner = (translateY: number, opacity: number, transition = false) => {
    const el = spinnerRef.current;
    if (!el) return;
    el.style.transition = transition ? "transform .3s, opacity .3s" : "none";
    el.style.transform = `translateY(${translateY}px) rotate(${translateY * 3}deg)`;
    el.style.opacity = String(opacity);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing.current) return;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return; // only pull when at top
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || refreshing.current) return;
    const dy = Math.max(0, e.touches[0].clientY - startY.current);
    if (dy === 0) return;
    const distance = Math.min(dy * 0.5, MAX_PULL); // dampen
    setSpinner(distance - 40, Math.min(distance / THRESHOLD, 1));
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || refreshing.current) return;
    pulling.current = false;
    const el = spinnerRef.current;
    if (!el) return;

    const currentY = parseFloat(el.style.transform.match(/translateY\(([^)]+)px\)/)?.[1] ?? "0");
    if (currentY + 40 >= THRESHOLD) {
      // trigger refresh
      refreshing.current = true;
      setSpinner(24, 1, true);
      el.classList.add("ptr-spinning");
      try {
        await onRefresh();
      } finally {
        el.classList.remove("ptr-spinning");
        setSpinner(-40, 0, true);
        refreshing.current = false;
      }
    } else {
      setSpinner(-40, 0, true);
    }
  }, [onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ position: "relative" }}
    >
      <div ref={spinnerRef} className="ptr-spinner" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 3a9 9 0 1 1-6.36 2.64" />
          <path d="M12 3v4" />
          <path d="M12 3L8.5 5.5" />
        </svg>
      </div>
      {children}
    </div>
  );
}
