"use client";

import type { IndexCatalogReportVariable } from "@/types/indexCatalog";

/**
 * Um exemplo que ainda tem colchetes é uma variável que não resolveu: o
 * relatório imprime exatamente isso para o cidadão, então a tela precisa
 * mostrá-la como erro em vez de escondê-la.
 */
function isUnresolved(variable: IndexCatalogReportVariable) {
  return variable.example.trim() === variable.token;
}

/**
 * As variáveis que este índice comporta, com o valor que cada uma teria em
 * Campina Grande.
 *
 * A lista muda de índice para índice de propósito: prometer uma janela de 12
 * meses a um índice anual daria uma frase errada com cara de certa.
 */
export function CatalogReportVariablesPanel({
  variables,
}: {
  variables: IndexCatalogReportVariable[];
}) {
  if (variables.length === 0) return null;
  const unresolved = variables.filter(isUnresolved);

  return (
    <details className="mt-3 rounded-xl border border-[#D9DAD4] bg-white p-4">
      <summary className="cursor-pointer text-sm font-bold">
        Variáveis que este índice aceita ({variables.length})
      </summary>
      <p className="mt-2 text-xs text-stone-600">
        Escreva qualquer uma delas entre colchetes no texto do relatório. A
        lista é deste índice: ela depende dos períodos que ele tem, da
        granularidade e de você ter declarado a ordem de gravidade das classes.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-stone-100 text-xs uppercase">
            <tr>
              <th className="px-3 py-2">Variável</th>
              <th className="px-3 py-2">O que ela traz</th>
              <th className="px-3 py-2">Em Campina Grande</th>
            </tr>
          </thead>
          <tbody>
            {variables.map((variable) => (
              <tr key={variable.token} className="border-t border-stone-200">
                <td className="px-3 py-2 font-mono text-xs">
                  {variable.token}
                </td>
                <td className="px-3 py-2 text-stone-700">
                  {variable.description}
                </td>
                <td
                  className={`px-3 py-2 ${isUnresolved(variable) ? "text-red-700" : "text-stone-900"}`}
                >
                  {variable.example}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {unresolved.length > 0 && (
        <p className="mt-2 text-xs text-red-700">
          {unresolved.length === 1
            ? "Uma variável não encontrou valor neste município e sairia com os colchetes no relatório."
            : `${unresolved.length} variáveis não encontraram valor neste município e sairiam com os colchetes no relatório.`}
        </p>
      )}
    </details>
  );
}
