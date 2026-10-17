import { cn } from "@/lib/utils";

/**
 * Traço verde sob um item do menu do topo. É o único traço do item: fica
 * inteiro na página atual (`active`) e, nos outros, cresce do centro com o
 * mouse ou com o foco do teclado. Precisa de um pai `group relative`.
 */
export const NavUnderline = ({
  active = false,
  className,
}: {
  active?: boolean;
  className?: string;
}) => (
  <span
    aria-hidden
    className={cn(
      "pointer-events-none absolute inset-x-4 bottom-0 h-[3px] origin-center rounded-full bg-[#777E32] transition-[scale] duration-300 ease-out",
      active
        ? "scale-x-100"
        : "scale-x-0 group-hover:scale-x-100 group-has-[:focus-visible]:scale-x-100",
      className,
    )}
  />
);
