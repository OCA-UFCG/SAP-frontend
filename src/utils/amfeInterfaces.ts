import { Control, UseControllerProps, UseFormSetValue } from "react-hook-form";

export interface InputFormI {
  fieldLabel: string;
  formProps: UseControllerProps<AnalyzeFormData>;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  error?: string;
  className?: string;
}

export type CriteriaFields = {
  name: string;
  value: number;
  is_benefit: boolean;
};

export interface CriteriaCardI {
  fields: CriteriaFields[];
  control: Control<AnalyzeFormData>;
  setValue: UseFormSetValue<AnalyzeFormData>;
  error?: string;
}

export interface Criteria {
  name: string;
  value: number;
  is_benefit: boolean;
}

export interface AnalyzeFormData {
  criteria: Criteria[];
  indifference: number;
  preference: number;
  veto: number;
  typeScenario: string;
  level: AnalysisLevel;
  interestArea: interestArea;
  interestAreaValue: string;
}
export type AnalysisLevel = "national" | "state" | "region" | "biome";
export type interestArea =
  "national" | "state" | "region" | "biome" | "semiarid" | "asd";
export interface Threshold {
  indifference: number;
  preference: number;
  veto: number;
}
export interface Model {
  version: string;
  dataset?: string;
}

export interface AnalyzePayload {
  criteria: Criteria[];
  thresholds: Threshold;
  model: Model;
  typeScenario: string;
  ranking: {
    level: AnalysisLevel;
  };
  interestArea: { type: interestArea; value: string };
}

export interface AnalysisCoverage {
  count: number;
  totalCount: number;
  excludedCount: number;
}

export interface CityData {
  name: string;
  UF?: string;
  classification: number;
  [key: string]: string | number | boolean | null | undefined;
}

export type Cities = { [key: string]: CityData };
export interface ExcludedCity {
  name: string | null;
  missing_fields: string[];
}
export type ExcludedCities = Record<string, ExcludedCity>;
export interface AnalyzeFormProps {
  setFormPayload: React.Dispatch<React.SetStateAction<AnalyzePayload | null>>;
}
export interface CriterionOption {
  id: string;
  name: string;
  description?: string;
}

export interface CriterionMetadata {
  name: string;
  label: string;
  is_benefit: boolean;
  unit: string | null;
  description: string | null;
  default: boolean;
}
