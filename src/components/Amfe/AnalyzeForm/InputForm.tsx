import { InputFormI } from "@/utils/amfeInterfaces";
import { Controller } from "react-hook-form";
import ErrorMessage from "./ErrorMessage";
import { inputBg } from "@/utils/amfeConsts";
import InputLabel from "./InputLabel";

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
  className = "w-full rounded-lg px-4 py-3 outline-none",
}: InputFormI) => {
  return (
    <Controller
      {...formProps}
      render={({ field }) => (
        <div className="mt-4">
          <InputLabel title={fieldLabel} />
          <input
            className={className}
            style={{ backgroundColor: inputBg }}
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
          <ErrorMessage>{error}</ErrorMessage>
        </div>
      )}
    />
  );
};

export default InputForm;
