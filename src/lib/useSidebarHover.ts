"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared hover-driven expand/collapse behavior for a fixed-overlay sidebar (used by both the
 * admin `Sidebar.tsx` and the client portal sidebar) — mouseenter expands, mouseleave collapses
 * after a short delay (avoids flicker when crossing internal gaps), and falls back to click-to-
 * toggle on touch/coarse-pointer devices that never fire hover events.
 */
export function useSidebarHover() {
  const [expanded, setExpanded] = useState(false);
  const [supportsHover, setSupportsHover] = useState(true);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupportsHover(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!supportsHover) return;
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setExpanded(true);
  }, [supportsHover]);

  const handleMouseLeave = useCallback(() => {
    if (!supportsHover) return;
    closeTimeoutRef.current = setTimeout(() => setExpanded(false), 150);
  }, [supportsHover]);

  const handleClick = useCallback(() => {
    if (supportsHover) return;
    setExpanded((prev) => !prev);
  }, [supportsHover]);

  return { expanded, collapsed: !expanded, handleMouseEnter, handleMouseLeave, handleClick };
}
