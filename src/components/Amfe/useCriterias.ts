"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getErrorMessage } from "@/utils/getErrorMessage";
import { CriterionMetadata } from "@/utils/amfeInterfaces";

const useCriterias = () => {
  const t = useTranslations("Criteria");
  const [sourceCriterias, setSourceCriterias] = useState<CriterionMetadata[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCriterias = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/amfe/criterias");
        const data = await response.json();

        if (!response.ok) throw new Error(getErrorMessage(data));

        setSourceCriterias(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchCriterias();
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
