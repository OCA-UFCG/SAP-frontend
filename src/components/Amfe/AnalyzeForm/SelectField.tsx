import { forwardRef, type SelectHTMLAttributes } from "react";
import { Icon } from "@/components/Icon/Icon";

/**
 * `<select>` do formulário da análise multicritério com a seta do próprio
 * projeto no lugar da seta nativa do navegador.
 *
 * A seta nativa muda de forma, de peso e de distância da borda conforme o
 * sistema operacional, e na mesma tela ela aparecia ao lado das caixas que já
 * usam `chevron-down` (acordeão, controles do mapa) — duas setas diferentes,
 * cada uma a uma distância diferente da borda.
 *
 * @example
 *   <SelectField className={softSelectClass} {...field}>
 *     <option value="state">Estadual</option>
 *   </SelectField>
 */
export const SelectField = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function SelectField({ className = "", children, ...selectProps }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={`${className} appearance-none pr-12`}
        {...selectProps}
      >
        {children}
      </select>
      {/* `pointer-events-none`: o clique tem que continuar abrindo o select. */}
      <Icon
        id="chevron-down"
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2"
      />
    </div>
  );
});

export default SelectField;
