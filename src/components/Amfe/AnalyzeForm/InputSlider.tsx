import { InputSliderI } from "@/utils/amfeInterfaces";
import ErrorMessage from "./ErrorMessage";
import InputLabel from "./InputLabel";
import { Controller } from "react-hook-form";
import { accent } from "@/utils/amfeConsts";

const InputSlider = ({
  fieldLabel,
  className,
  formProps,
  error,
  min,
  max,
  step,
}: InputSliderI) => {
  return (
    <Controller
      {...formProps}
      render={({ field }) => {
        const currentValue = Number.isNaN(Number(field.value))
          ? 0
          : Number(field.value);
        const percent = ((currentValue - min) / (max - min)) * 100;

        return (
          <div className="mt-5 w-full max-w-md">
            <InputLabel title={fieldLabel} />

            <div className="relative mt-8">
              <div
                className="z-index-2 absolute -top-6 rounded px-1 py-1 text-xs text-white"
                style={{
                  left: `calc(${percent}% - ${percent / 100}%)`,
                  transform: "translateX(-50%)",
                  backgroundColor: accent,
                  pointerEvents: "none",
                }}
              >
                {currentValue.toFixed(2)}
              </div>
              <div className="relative w-full">
                <div
                  className="pointer-events-none absolute top-1/2 left-0 z-[2] h-2.5 -translate-y-1/2 rounded-full"
                  style={{
                    width: `calc(${percent}% - ${percent / 25}%)`,
                    backgroundColor: accent,
                  }}
                />

                <input
                  className={`relative z-[1] w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-orange-500 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-gray-200 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-gray-300 [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-orange-500 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 hover:[&::-webkit-slider-thumb]:scale-110 ${className} `}
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  placeholder={`Valor de ${fieldLabel}`}
                  value={currentValue}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </div>
              <div className="w-full px-[10px]">
                <div className="flex items-end justify-between">
                  {Array.from({ length: 11 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <div className="h-2 w-[2px] bg-gray-400"></div>
                      <span className="mt-1 text-xs text-gray-600">
                        {(i * 0.1).toFixed(1).replace(".0", "")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <ErrorMessage>{error}</ErrorMessage>
          </div>
        );
      }}
    />
  );
};

export default InputSlider;
