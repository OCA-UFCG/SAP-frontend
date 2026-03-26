import { ChevronI } from "@/utils/interfaces";
import { Icon } from "../Icon/Icon";


export function Chevron({ open, from, to }: ChevronI) {
  const directions = {
    down: "rotate-180",
    up: "rotate-0",
    left: "-rotate-90",
    right: "rotate-90"
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden
      className={`shrink-0 transition-transform duration-200 ${open ? directions[from] : directions[to]}`}
    >
     <Icon id="chevron-down" />
    </svg>
  );
}