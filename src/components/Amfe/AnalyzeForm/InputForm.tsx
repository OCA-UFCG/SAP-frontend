import { InputFormI } from "@/utils/amfeInterfaces";
import { Controller } from "react-hook-form";
import ErrorMessage from "./ErrorMessage";

/**
 * Converte o texto de um `<input type="number">` no valor que o formulário deve
 * guardar. Um `<input>` sempre entrega string, e limiares guardados como string
 * chegam à aba "especificações" do XLSX como célula de texto em vez de número.
 *
 * @example parseInputValue("0.35", "number") // 0.35
 */
export const parseInputValue = (raw: string, type?: string) => {
  if (type !== "number" || raw === "") return raw;

  const parsed = Number(raw);

  // Estados intermediários como "1e" ou "-" viram NaN: devolve o texto cru para
  // o usuário continuar vendo o que digitou.
  return Number.isNaN(parsed) ? raw : parsed;
};

const InputForm = ({
  fieldLabel,
  formProps,
  inputProps,
  error,
  className = "h-10 w-24 shrink-0 rounded-lg border border-transparent bg-[#E4E5E2] px-3 text-right text-sm text-[#292829] shadow-sm transition outline-none hover:border-neutral-400 focus-visible:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-600",
}: InputFormI) => {
  return (
    <Controller
      {...formProps}
      render={({ field }) => (
        <div>
          {/* Uma linha branca como as opções de Comunicação: o nome à
              esquerda e o valor à direita. */}
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-[#EFEFEF] bg-white py-1 pr-1 pl-4">
            <span className="font-inter text-base leading-6 font-semibold tracking-[-0.015em] text-[#292829]">
              {fieldLabel}
            </span>
            <input
              className={className}
              value={(field.value as string | number) ?? ""}
              onChange={(event) =>
                field.onChange(
                  parseInputValue(event.target.value, inputProps?.type),
                )
              }
              {...inputProps}
              onBlur={(e) => {
                field.onBlur();
                inputProps?.onBlur?.(e);
              }}
            />
          </label>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </div>
      )}
    />
  );
};

export default InputForm;
