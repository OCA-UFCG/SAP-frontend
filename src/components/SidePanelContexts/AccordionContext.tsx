"use client";

import type { ModulesContextProps } from "./ModulesContext";
import { ModulesContext } from "./ModulesContext";

export type AccordionContextProps = ModulesContextProps;

export function AccordionContext(props: AccordionContextProps) {
  return <ModulesContext {...props} />;
}
