import { GoogleDocsRegexReader } from "./GoogleDocsRegexReader";

const TEST_THEMES = ["DROUGHT_MONITOR"];

export function GoogleDocsRegexReaderTestHarness() {
  return (
    <GoogleDocsRegexReader
      themes={TEST_THEMES}
      city="Campina Grande"
      state="Paraíba"
      month="01"
      year={2024}
    />
  );
}
