"use client";

import { MUNICIPAL_SPREADSHEET_COLUMNS } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";

const TERRITORIAL_COLUMNS = Object.values(MUNICIPAL_SPREADSHEET_COLUMNS).join(
  ", ",
);

/**
 * Os campos de um índice criado a partir de uma planilha do Google.
 *
 * São três, e não os dez do caminho do Earth Engine, porque a convenção das
 * planilhas já fixa o resto: as colunas territoriais têm nome conhecido e as
 * colunas de dado são reconhecidas pelo sufixo `_{ano}`. O que sobra para o
 * operador é dizer onde está a planilha, qual dado dela usar e como os
 * territórios maiores somam.
 */
export function SpreadsheetSourceFields({
  source,
  inputClass,
  onChange,
}: {
  source: MunicipalSpreadsheetStatisticsSource;
  inputClass: string;
  onChange: (values: Partial<MunicipalSpreadsheetStatisticsSource>) => void;
}) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium md:col-span-2">
        Link da planilha
        <input
          className={inputClass}
          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
          value={source.spreadsheetUrl}
          onChange={(event) => onChange({ spreadsheetUrl: event.target.value })}
        />
        <span className="mt-1 block text-xs font-normal text-stone-500">
          Cole o link que o botão Compartilhar do Google gera. A planilha
          precisa estar como “qualquer pessoa com o link pode ver”, e precisa
          ter as colunas da convenção: {TERRITORIAL_COLUMNS}.
        </span>
      </label>
      <label className="text-sm font-medium">
        Prefixo das colunas de dado
        <input
          className={inputClass}
          placeholder="pib"
          value={source.valuePrefix}
          onChange={(event) => onChange({ valuePrefix: event.target.value })}
        />
        <span className="mt-1 block text-xs font-normal text-stone-500">
          O que vem antes do ano no nome da coluna: escreva <b>pib</b> para uma
          planilha com pib_2010, pib_2020 e pib_2023. Cada coluna dessas vira um
          período do índice.
        </span>
      </label>
      <label className="text-sm font-medium">
        Como somar os municípios
        <select
          className={inputClass}
          value={source.aggregation}
          onChange={(event) =>
            onChange({ aggregation: event.target.value as "sum" | "mean" })
          }
        >
          <option value="sum">
            Soma dos municípios (PIB, população, contagens)
          </option>
          <option value="mean">
            Média dos municípios (IDHM, taxas, índices)
          </option>
        </select>
        <span className="mt-1 block text-xs font-normal text-stone-500">
          O valor de cada UF, região, bioma, ASD, semiárido e do Brasil sai
          daqui. É uma média simples: cada município pesa igual, independente do
          tamanho.
        </span>
      </label>
    </div>
  );
}
