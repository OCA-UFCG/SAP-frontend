"use client";

import type { ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { cn } from "@/lib/utils";

type LoginFieldProps = {
  id: string;
  type: "text" | "password";
  placeholder: string;
  autoComplete: string;
  registration: UseFormRegisterReturn;
  errorMessage?: string;
  trailing?: ReactNode;
};

const INPUT_CLASS =
  "font-inter w-full rounded-[7px] bg-[#E4E5E2] px-2.5 py-2 text-[13px] font-medium leading-5 tracking-[-0.2px] text-[#292829] outline-none transition placeholder:text-[#676264] focus:ring-2 focus:ring-[#989F43] aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#B3261E]";

export const LoginField = ({
  id,
  type,
  placeholder,
  autoComplete,
  registration,
  errorMessage,
  trailing,
}: LoginFieldProps) => {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="relative w-full">
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? `${id}-error` : undefined}
          className={cn(INPUT_CLASS, trailing && "pr-9")}
          {...registration}
        />
        {trailing ? (
          <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center">
            {trailing}
          </div>
        ) : null}
      </div>
      {errorMessage ? (
        <p id={`${id}-error`} className="text-[12px] leading-4 text-[#B3261E]">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
};

export default LoginField;
