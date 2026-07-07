"use client";

import { FormEvent, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import citiesIndex from "@/data/citiesIndex.json";

export function MunicipalReportContext() {
  const t = useTranslations("MunicipalReport");
  const locale = useLocale();
  const router = useRouter();
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [period, setPeriod] = useState(String(new Date().getFullYear()));

  const municipalities = useMemo(
    () =>
      [...citiesIndex].sort((left, right) =>
        left.label.localeCompare(right.label, "pt-BR"),
      ),
    [],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!municipalityCode || !/^\d{4}(-\d{2})?$/.test(period)) return;

    const params = new URLSearchParams({ municipalityCode, period });
    router.push(`/${locale}/platform/municipal-report?${params.toString()}`);
  }

  return (
    <section className="flex h-full w-full flex-col bg-white">
      <div className="border-b border-neutral-200 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#777E32]">
          {t("section")}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          {t("description")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6">
        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-800">
          {t("municipality")}
          <select
            value={municipalityCode}
            onChange={(event) => setMunicipalityCode(event.target.value)}
            required
            className="h-12 rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none focus:border-[#777E32] focus:ring-2 focus:ring-[#E1E2B4]"
          >
            <option value="">{t("selectMunicipality")}</option>
            {municipalities.map((municipality) => (
              <option key={municipality.code} value={municipality.code}>
                {municipality.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-neutral-800">
          {t("period")}
          <input
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            required
            pattern="\d{4}(-\d{2})?"
            placeholder="2024 ou 2024-01"
            className="h-12 rounded-lg border border-neutral-300 px-3 text-sm outline-none focus:border-[#777E32] focus:ring-2 focus:ring-[#E1E2B4]"
          />
          <span className="text-xs font-normal text-neutral-500">
            {t("periodHint")}
          </span>
        </label>

        <button
          type="submit"
          disabled={!municipalityCode || !/^\d{4}(-\d{2})?$/.test(period)}
          className="h-12 rounded-lg bg-[#777E32] px-4 font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("preview")}
        </button>
      </form>
    </section>
  );
}
