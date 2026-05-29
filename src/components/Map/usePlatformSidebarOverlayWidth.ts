import { useEffect, useState } from "react";
import {
  PLATFORM_SIDE_PANEL_SELECTOR,
  PLATFORM_SIDE_RAIL_SELECTOR,
  PLATFORM_SIDEBAR_OVERLAY_SELECTOR,
  resolvePlatformSidebarOverlayWidth,
} from "./mapViewport";

export const usePlatformSidebarOverlayWidth = () => {
  const [leftOverlayWidth, setLeftOverlayWidth] = useState(0);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const overlay = document.querySelector<HTMLElement>(
      PLATFORM_SIDEBAR_OVERLAY_SELECTOR,
    );
    const sideRail = document.querySelector<HTMLElement>(
      PLATFORM_SIDE_RAIL_SELECTOR,
    );
    const sidePanel = document.querySelector<HTMLElement>(
      PLATFORM_SIDE_PANEL_SELECTOR,
    );

    if (!overlay && !sideRail && !sidePanel) {
      return;
    }

    const updateOverlayWidth = () => {
      const nextWidth = resolvePlatformSidebarOverlayWidth(document);
      setLeftOverlayWidth((current) =>
        current === nextWidth ? current : nextWidth,
      );
    };

    const frameId = window.requestAnimationFrame(updateOverlayWidth);
    window.addEventListener("resize", updateOverlayWidth);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(frameId);
        window.removeEventListener("resize", updateOverlayWidth);
      };
    }

    const observer = new ResizeObserver(updateOverlayWidth);
    [overlay, sideRail, sidePanel].forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", updateOverlayWidth);
    };
  }, []);

  return leftOverlayWidth;
};
