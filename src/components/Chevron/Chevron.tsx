import { ChevronI } from "@/utils/interfaces";
import { Icon } from "../Icon/Icon";


export function Chevron({ open, from, to, size=20 }: ChevronI) {
  const directions = {
    down: "rotate-180",
    up: "rotate-0",
    left: "-rotate-90",
    right: "rotate-90"
  }

  return (

     <Icon size={size} className={`shrink-0 transition-transform duration-200 ${open ? directions[from] : directions[to]}`} id="chevron-down" />
 
  );
}