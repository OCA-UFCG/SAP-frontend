"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { CriterionMetadata } from "@/utils/amfeInterfaces";

/**
 * O catálogo é o mesmo para toda a tela, e mais de um componente o consome
 * (`AnalyzeForm` e `SegmentedSlider`). Sem esta promise compartilhada cada um
 * dispara seu próprio GET e mantém seu próprio estado, que podem divergir.
 */
let criteriasRequest: Promise<CriterionMetadata[]> | null = null;

const fetchCriteriasOnce = () => {
  criteriasRequest ??= (async () => {
    const response = await fetch("/api/amfe/criterias");
    const data = await response.json();

    if (!response.ok) throw new Error(getErrorMessage(data));

    return data as CriterionMetadata[];
  })().catch((error) => {
    // Uma falha de rede não pode travar o catálogo pelo resto da sessão: solta
    // a promise para que a próxima montagem possa tentar de novo.
    criteriasRequest = null;
    throw error;
  });

  return criteriasRequest;
};

/** Descarta o catálogo em memória. Existe para isolar os testes. */
export const resetCriteriasCache = () => {
  criteriasRequest = null;
};

const useCriterias = () => {
  const t = useTranslations("Criteria");
  const [sourceCriterias, setSourceCriterias] = useState<CriterionMetadata[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCriterias = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchCriteriasOnce();

        if (!cancelled) setSourceCriterias(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCriterias();

    return () => {
      cancelled = true;
    };
  }, []);

  const criterias = useMemo(
    () =>
      sourceCriterias.map((criterion) => ({
        ...criterion,
        label: t.has(`${criterion.name}.label`)
          ? t(`${criterion.name}.label`)
          : criterion.label,
        description: t.has(`${criterion.name}.description`)
          ? t(`${criterion.name}.description`)
          : criterion.description,
      })),
    [sourceCriterias, t],
  );

  return { criterias, loading, error };
};

export default useCriterias;
