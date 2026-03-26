import { ChevronI } from "@/utils/interfaces";
import { Icon } from "../Icon/Icon";


export function Chevron({ open, from, to }: ChevronI) {
  const directions = {
    down: "180",
    up: "0",
    left: "270",
    right: "90"
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      className={`shrink-0 transition-transform duration-200 ${open ? `-rotate-${directions[from]}` : `-rotate-${directions[to]}`}`}
    >
     <Icon id="chevron-down" />
    </svg>
  );
}