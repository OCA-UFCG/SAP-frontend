"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

/**
 * Estado de navegação da listagem de Monitoramento — quais acordeões estão
 * abertos e onde o painel estava rolado.
 *
 * A listagem desmonta quando o usuário abre o detalhamento de um índice (o
 * `PlatformSidePanel` troca o componente de contexto), então guardar isso num
 * `useState` dentro da própria listagem faz tudo voltar fechado e no topo ao
 * clicar em "Voltar para listagem". O provider fica acima dessa troca, no
 * `PlatformSidebar`, e sobrevive à ida e volta.
 *
 * @example
 * const { isCategoryOpen, setCategoryOpen } = useMonitoringListState();
 * <LayerAccordion open={isCategoryOpen(group.key)} onOpenChange={...} />
 */
export interface MonitoringListState {
  isCategoryOpen: (categoryKey: string) => boolean;
  setCategoryOpen: (categoryKey: string, open: boolean) => void;
  getScrollTop: () => number;
  setScrollTop: (scrollTop: number) => void;
}

const MonitoringListStateContext = createContext<MonitoringListState | null>(
  null,
);

export function MonitoringListStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    {},
  );
  // A rolagem não precisa re-renderizar nada: só é lida na remontagem da
  // listagem. Um ref evita um setState por evento de scroll.
  const scrollTopRef = useRef(0);

  const isCategoryOpen = useCallback(
    (categoryKey: string) => openCategories[categoryKey] ?? false,
    [openCategories],
  );

  const setCategoryOpen = useCallback((categoryKey: string, open: boolean) => {
    setOpenCategories((current) => ({ ...current, [categoryKey]: open }));
  }, []);

  const getScrollTop = useCallback(() => scrollTopRef.current, []);

  const setScrollTop = useCallback((scrollTop: number) => {
    scrollTopRef.current = scrollTop;
  }, []);

  const value = useMemo<MonitoringListState>(
    () => ({ isCategoryOpen, setCategoryOpen, getScrollTop, setScrollTop }),
    [isCategoryOpen, setCategoryOpen, getScrollTop, setScrollTop],
  );

  return (
    <MonitoringListStateContext.Provider value={value}>
      {children}
    </MonitoringListStateContext.Provider>
  );
}

/**
 * Sem provider a listagem continua funcionando, apenas sem lembrar o estado —
 * é o caso de stories e testes que montam o contexto isolado.
 */
export function useMonitoringListState(): MonitoringListState | null {
  return useContext(MonitoringListStateContext);
}
