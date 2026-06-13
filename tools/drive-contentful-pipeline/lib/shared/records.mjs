export function sortRecordEntries(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey),
    ),
  );
}

export function indentJson(json, spaces) {
  return json.replace(/\n/gu, `\n${" ".repeat(spaces)}`);
}

export function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
