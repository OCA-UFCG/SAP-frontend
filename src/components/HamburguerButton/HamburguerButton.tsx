import { FunctionComponent as FC } from "react";
import { cn } from "@/lib/utils";

interface IProps {
  open: boolean;
  label: string;
  /** `id` do menu que o botão abre. */
  controls: string;
  onClick: () => void;
}

/**
 * Três traços que viram um X com o menu aberto. A área de toque tem 44 px, o
 * mínimo confortável para o dedo; o desenho continua com 30 x 20 px.
 */
export const Hamburguer: FC<IProps> = ({ open, label, controls, onClick }) => {
  const bar =
    "absolute left-0 h-1 w-full bg-black transition-[translate,rotate,opacity] duration-300 ease-out";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#777E32]"
    >
      <span aria-hidden className="relative block h-5 w-7.5">
        <span className={cn(bar, "top-0", open && "translate-y-2 rotate-45")} />
        <span className={cn(bar, "top-2", open && "opacity-0")} />
        <span
          className={cn(bar, "top-4", open && "-translate-y-2 -rotate-45")}
        />
      </span>
    </button>
  );
};
