import { InputFormI } from "@/utils/amfeInterfaces";
import { Controller } from "react-hook-form";
import ErrorMessage from "./ErrorMessage";
import { inputBg } from "@/utils/amfeConsts";
import InputLabel from "./InputLabel";

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
            value={(field.value as string) ?? ""}
            onChange={field.onChange}
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
