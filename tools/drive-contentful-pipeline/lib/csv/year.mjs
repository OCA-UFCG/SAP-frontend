export function getYearKey(row) {
  const date = String(row.data_img ?? row.DATA_IMG ?? row.date ?? "").trim();
  const dateMatch = date.match(/^(\d{4})-(\d{2})-\d{2}$/u);

  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}`;
  }

  const year = String(row.ano ?? row.ANO ?? row.year ?? "").trim();

  if (/^\d{4}-\d{2}$/u.test(year) || /^\d{4}$/u.test(year)) {
    return year;
  }

  throw new Error(
    `Linha sem data_img YYYY-MM-DD, ano YYYY-MM ou ano YYYY reconhecido: ${JSON.stringify(row)}`,
  );
}

export function getCalendarYear(yearKey) {
  const match = String(yearKey).match(/^(\d{4})(?:-\d{2})?$/u);

  if (!match) {
    throw new Error(
      `Chave temporal inválida para particionar por ano: ${yearKey}`,
    );
  }

  return match[1];
}
