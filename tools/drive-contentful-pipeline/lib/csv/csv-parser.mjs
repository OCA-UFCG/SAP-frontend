export function parseCsv(text) {
  const rows = [];
  let currentCell = "";
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (insideQuotes && text[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (insideQuotes) {
    throw new Error("CSV com aspas não fechadas.");
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

export function toRows(csvText) {
  const [header, ...dataRows] = parseCsv(csvText);

  if (!header || dataRows.length === 0) {
    throw new Error("CSV sem linhas de dados.");
  }

  return dataRows.map((cells, rowIndex) => {
    if (cells.length !== header.length) {
      throw new Error(
        `Linha ${rowIndex + 2} com ${cells.length} colunas; esperado ${header.length}.`,
      );
    }

    return Object.fromEntries(
      header.map((column, index) => [column, cells[index]]),
    );
  });
}
