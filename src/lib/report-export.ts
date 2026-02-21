type PdfOptions = {
  title: string;
  subtitleLines?: string[];
  headers: string[];
  rows: string[][];
};

function normalizeCell(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function toCell(value: unknown) {
  if (value === null || value === undefined) return "";
  return normalizeCell(String(value));
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function hardenCsvCell(value: string) {
  if (/^[=+\-@]/.test(value) || /^[\t\r\n]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function buildCsv(headers: string[], rows: string[][]) {
  const csvRows = [headers, ...rows].map((row) =>
    row.map((value) => escapeCsvCell(hardenCsvCell(toCell(value)))).join(",")
  );
  return `\uFEFF${csvRows.join("\n")}`;
}

function escapePdfText(value: string) {
  let out = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (char === "\\" || char === "(" || char === ")") {
      out += `\\${char}`;
      continue;
    }
    if (code < 32 || code > 126) {
      if (code <= 255) {
        out += `\\${code.toString(8).padStart(3, "0")}`;
      } else {
        out += "?";
      }
      continue;
    }
    out += char;
  }
  return out;
}

type PdfFont = "F1" | "F2";

type PreparedRow = {
  cells: string[][];
  height: number;
  index: number;
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN_LEFT = 28;
const MARGIN_RIGHT = 28;
const MARGIN_TOP = 26;
const MARGIN_BOTTOM = 24;
const FOOTER_HEIGHT = 18;
const TABLE_CELL_PADDING_X = 4;
const TABLE_CELL_PADDING_TOP = 5;
const TABLE_CELL_PADDING_BOTTOM = 4;
const TABLE_FONT_SIZE = 8.6;
const TABLE_FONT_LEADING = 10.4;
const TABLE_HEADER_FONT_SIZE = 9.2;
const TABLE_HEADER_LEADING = 11.4;

function fmt(value: number) {
  return Number(value.toFixed(2)).toString();
}

function estimateCharCapacity(width: number, fontSize: number) {
  const usable = Math.max(8, width - TABLE_CELL_PADDING_X * 2);
  const capacity = Math.floor(usable / (fontSize * 0.52));
  return Math.max(1, capacity);
}

function wrapByWords(value: string, maxChars: number) {
  const text = toCell(value);
  if (!text) return [""];
  if (text.length <= maxChars) return [text];

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!word) continue;
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }

    if (word.length <= maxChars) {
      current = word;
      continue;
    }

    for (let i = 0; i < word.length; i += maxChars) {
      const part = word.slice(i, i + maxChars);
      if (part.length === maxChars) {
        lines.push(part);
      } else {
        current = part;
      }
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function computeColumnWidths(headers: string[], rows: string[][], tableWidth: number) {
  const sampleRows = rows.slice(0, 500);
  const weights = headers.map((header, colIndex) => {
    const headerWeight = Math.max(8, Math.min(36, toCell(header).length + 4));
    const maxValueWeight = sampleRows.reduce((acc, row) => {
      const value = toCell(row[colIndex] ?? "");
      const size = Math.max(4, Math.min(42, value.length));
      return Math.max(acc, size);
    }, 4);
    return Math.max(headerWeight, maxValueWeight);
  });

  const minColWidth = Math.max(34, Math.floor(tableWidth * 0.055));
  const minTotal = minColWidth * headers.length;
  const extraSpace = Math.max(0, tableWidth - minTotal);
  const sumWeights = weights.reduce((acc, weight) => acc + weight, 0) || 1;

  const widths = weights.map((weight) => minColWidth + (extraSpace * weight) / sumWeights);
  const rounded = widths.map((width) => Math.floor(width));
  let diff = Math.floor(tableWidth - rounded.reduce((acc, width) => acc + width, 0));
  let idx = 0;
  while (diff > 0) {
    rounded[idx % rounded.length] += 1;
    diff -= 1;
    idx += 1;
  }

  return rounded.map((width) => width);
}

function makePreparedRows(rows: string[][], columnWidths: number[]) {
  return rows.map<PreparedRow>((row, rowIndex) => {
    const cellLines = columnWidths.map((width, colIndex) => {
      const text = toCell(row[colIndex] ?? "");
      const maxChars = estimateCharCapacity(width, TABLE_FONT_SIZE);
      return wrapByWords(text, maxChars);
    });

    const maxLines = cellLines.reduce((acc, lines) => Math.max(acc, lines.length), 1);
    const height =
      TABLE_CELL_PADDING_TOP + TABLE_CELL_PADDING_BOTTOM + maxLines * TABLE_FONT_LEADING;

    return { cells: cellLines, height, index: rowIndex };
  });
}

function drawRect(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    fillGray?: number;
    strokeGray?: number;
    strokeWidth?: number;
  } = {}
) {
  if (options.fillGray !== undefined) {
    commands.push(`${fmt(options.fillGray)} g`);
    commands.push(`${fmt(x)} ${fmt(y)} ${fmt(width)} ${fmt(height)} re f`);
  }
  if (options.strokeGray !== undefined) {
    commands.push(`${fmt(options.strokeGray)} G`);
    commands.push(`${fmt(options.strokeWidth ?? 0.4)} w`);
    commands.push(`${fmt(x)} ${fmt(y)} ${fmt(width)} ${fmt(height)} re S`);
  }
}

function drawTextLines(
  commands: string[],
  lines: string[],
  x: number,
  yTop: number,
  options: {
    font: PdfFont;
    fontSize: number;
    leading: number;
    gray?: number;
  }
) {
  if (!lines.length) return;
  commands.push(`${fmt(options.gray ?? 0)} g`);
  commands.push("BT");
  commands.push(`/${options.font} ${fmt(options.fontSize)} Tf`);
  commands.push(`${fmt(options.leading)} TL`);
  commands.push(`${fmt(x)} ${fmt(yTop - options.fontSize)} Td`);
  lines.forEach((line, index) => {
    if (index > 0) commands.push("T*");
    commands.push(`(${escapePdfText(line)}) Tj`);
  });
  commands.push("ET");
}

function buildPageContent(
  pageRows: PreparedRow[],
  pageIndex: number,
  pageCount: number,
  titleLines: string[],
  subtitleWrapped: string[],
  headerCells: string[][],
  headerHeight: number,
  columnWidths: number[]
) {
  const commands: string[] = [];
  const contentWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const footerY = MARGIN_BOTTOM + 4;

  drawRect(commands, MARGIN_LEFT, PAGE_HEIGHT - MARGIN_TOP - 3, 4, 18, {
    fillGray: 0.2,
  });
  drawTextLines(commands, titleLines, MARGIN_LEFT + 10, PAGE_HEIGHT - MARGIN_TOP, {
    font: "F2",
    fontSize: 15.5,
    leading: 18.5,
    gray: 0.1,
  });

  const subtitleTop =
    PAGE_HEIGHT - MARGIN_TOP - titleLines.length * 18.5 - (subtitleWrapped.length ? 8 : 0);
  if (subtitleWrapped.length) {
    drawTextLines(commands, subtitleWrapped, MARGIN_LEFT, subtitleTop, {
      font: "F1",
      fontSize: 9.6,
      leading: 12.4,
      gray: 0.25,
    });
  }

  const headerBlockHeight =
    titleLines.length * 18.5 +
    (subtitleWrapped.length ? subtitleWrapped.length * 12.4 + 8 : 0);
  const tableTop = PAGE_HEIGHT - MARGIN_TOP - headerBlockHeight - 12;

  commands.push("0.75 G");
  commands.push("0.6 w");
  commands.push(
    `${fmt(MARGIN_LEFT)} ${fmt(tableTop + 4)} m ${fmt(MARGIN_LEFT + contentWidth)} ${fmt(
      tableTop + 4
    )} l S`
  );

  let cursorY = tableTop;

  // Header row
  drawRect(commands, MARGIN_LEFT, cursorY - headerHeight, contentWidth, headerHeight, {
    fillGray: 0.92,
    strokeGray: 0.68,
    strokeWidth: 0.55,
  });

  let headerX = MARGIN_LEFT;
  headerCells.forEach((lines, colIndex) => {
    const cellWidth = columnWidths[colIndex];
    drawRect(commands, headerX, cursorY - headerHeight, cellWidth, headerHeight, {
      strokeGray: 0.7,
      strokeWidth: 0.45,
    });
    drawTextLines(
      commands,
      lines,
      headerX + TABLE_CELL_PADDING_X,
      cursorY - TABLE_CELL_PADDING_TOP,
      {
        font: "F2",
        fontSize: TABLE_HEADER_FONT_SIZE,
        leading: TABLE_HEADER_LEADING,
        gray: 0.1,
      }
    );
    headerX += cellWidth;
  });
  cursorY -= headerHeight;

  // Data rows
  for (const row of pageRows) {
    if (row.index % 2 === 0) {
      drawRect(commands, MARGIN_LEFT, cursorY - row.height, contentWidth, row.height, {
        fillGray: 0.985,
      });
    }

    let cellX = MARGIN_LEFT;
    row.cells.forEach((lines, colIndex) => {
      const cellWidth = columnWidths[colIndex];
      drawRect(commands, cellX, cursorY - row.height, cellWidth, row.height, {
        strokeGray: 0.84,
        strokeWidth: 0.35,
      });
      drawTextLines(
        commands,
        lines,
        cellX + TABLE_CELL_PADDING_X,
        cursorY - TABLE_CELL_PADDING_TOP,
        {
          font: "F1",
          fontSize: TABLE_FONT_SIZE,
          leading: TABLE_FONT_LEADING,
          gray: 0.12,
        }
      );
      cellX += cellWidth;
    });

    cursorY -= row.height;
  }

  commands.push("0.8 G");
  commands.push("0.5 w");
  commands.push(
    `${fmt(MARGIN_LEFT)} ${fmt(footerY + 12)} m ${fmt(MARGIN_LEFT + contentWidth)} ${fmt(
      footerY + 12
    )} l S`
  );

  drawTextLines(
    commands,
    [`Página ${pageIndex + 1} de ${pageCount}`],
    MARGIN_LEFT,
    footerY + 9,
    { font: "F1", fontSize: 8.4, leading: 10, gray: 0.35 }
  );

  return `${commands.join("\n")}\n`;
}

function createPdfDocument(pageContents: string[]) {
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] =
    "<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] =
    "<< /Type /Font /Subtype /Type1 /Name /F2 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const pageRefs: string[] = [];
  let objectId = 5;

  for (const content of pageContents) {
    const pageObjectId = objectId;
    const contentObjectId = objectId + 1;
    objectId += 2;

    pageRefs.push(`${pageObjectId} 0 R`);
    objects[pageObjectId] = [
      "<< /Type /Page",
      "/Parent 2 0 R",
      `/MediaBox [0 0 ${fmt(PAGE_WIDTH)} ${fmt(PAGE_HEIGHT)}]`,
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>",
      `/Contents ${contentObjectId} 0 R`,
      ">>",
    ].join(" ");

    objects[contentObjectId] = `<< /Length ${Buffer.byteLength(
      content,
      "utf8"
    )} >>\nstream\n${content}endstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(chunks[0], "utf8");

  for (let id = 1; id < objects.length; id += 1) {
    const body = `${id} 0 obj\n${objects[id]}\nendobj\n`;
    offsets[id] = cursor;
    chunks.push(body);
    cursor += Buffer.byteLength(body, "utf8");
  }

  const xrefOffset = cursor;
  const size = objects.length;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id += 1) {
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(xref, trailer);
  return Buffer.from(chunks.join(""), "utf8");
}

export function buildSimpleTablePdf({
  title,
  subtitleLines = [],
  headers,
  rows,
}: PdfOptions) {
  const contentWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const titleWrap = wrapByWords(title, Math.max(24, Math.floor(contentWidth / (15.5 * 0.52))));
  const wrappedSubtitles = subtitleLines.flatMap((line) =>
    wrapByWords(line, Math.max(28, Math.floor(contentWidth / (9.6 * 0.52))))
  );

  const headerBlockHeight =
    titleWrap.length * 18.5 +
    (wrappedSubtitles.length ? wrappedSubtitles.length * 12.4 + 8 : 0);
  const tableTop = PAGE_HEIGHT - MARGIN_TOP - headerBlockHeight - 12;
  const tableBottomLimit = MARGIN_BOTTOM + FOOTER_HEIGHT + 14;
  const availableTableHeight = tableTop - tableBottomLimit;

  const columnWidths = computeColumnWidths(headers, rows, contentWidth);
  const headerCells = headers.map((header, colIndex) =>
    wrapByWords(header, estimateCharCapacity(columnWidths[colIndex], TABLE_HEADER_FONT_SIZE))
  );
  const headerMaxLines = headerCells.reduce((acc, lines) => Math.max(acc, lines.length), 1);
  const headerHeight =
    TABLE_CELL_PADDING_TOP + TABLE_CELL_PADDING_BOTTOM + headerMaxLines * TABLE_HEADER_LEADING;

  const preparedRows = makePreparedRows(rows, columnWidths);
  const pages: PreparedRow[][] = [];
  let currentPageRows: PreparedRow[] = [];
  let usedHeight = headerHeight;

  for (const row of preparedRows) {
    if (usedHeight + row.height > availableTableHeight && currentPageRows.length > 0) {
      pages.push(currentPageRows);
      currentPageRows = [];
      usedHeight = headerHeight;
    }
    currentPageRows.push(row);
    usedHeight += row.height;
  }

  if (currentPageRows.length) {
    pages.push(currentPageRows);
  }
  if (!pages.length) {
    pages.push([]);
  }

  const pageContents = pages.map((pageRows, index) =>
    buildPageContent(
      pageRows,
      index,
      pages.length,
      titleWrap,
      wrappedSubtitles,
      headerCells,
      headerHeight,
      columnWidths
    )
  );

  return createPdfDocument(pageContents);
}
