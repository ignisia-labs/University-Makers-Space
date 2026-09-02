import ExcelJS from "exceljs";
import { ApiError } from "../../utils/api-error.js";
import type { ImportRow } from "./faculty-service.js";

/**
 * Reads the faculty spreadsheet.
 *
 * Columns are matched by *header name*, not position, so a file with the
 * columns in a different order — or with extra columns the registry happens to
 * keep — still imports. Matching is case- and punctuation-insensitive because
 * real spreadsheets carry headers like "Work Email", "work_email" and "E-mail".
 */

/** Only the columns a human types. `sheetRow` is derived, never read from a cell. */
type SheetField = Exclude<keyof ImportRow, "sheetRow">;

const HEADER_ALIASES: Record<SheetField, string[]> = {
  prefix: ["prefix", "title", "salutation", "honorific"],
  name: ["fullname", "name", "facultyname", "staffname"],
  email: ["workemail", "email", "emailaddress", "officialemail", "institutionalemail"],
  // "Sub branch" is what the university's own faculty exports call it.
  division: ["division", "divisionname", "subbranch", "branch", "school", "faculty"],
};

/** Strips case, spaces and punctuation so header variants collapse together. */
function normaliseHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  // A hyperlinked email arrives as an object; the visible text is what matters.
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      return value.hyperlink.replace(/^mailto:/i, "").trim();
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    }
    if ("result" in value) return String(value.result ?? "").trim();
  }
  return String(value).trim();
}

export async function parseFacultyWorkbook(buffer: Buffer): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new ApiError(
      400,
      "UNREADABLE_WORKBOOK",
      "That file could not be read as an Excel workbook (.xlsx)",
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    throw new ApiError(400, "EMPTY_WORKBOOK", "The workbook has no rows below the header");
  }

  const headerRow = sheet.getRow(1);
  const columns = new Map<SheetField, number>();
  headerRow.eachCell((cell, columnNumber) => {
    const header = normaliseHeader(cellText(cell));
    if (!header) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
      [SheetField, string[]]
    >) {
      if (!columns.has(field) && aliases.includes(header)) columns.set(field, columnNumber);
    }
  });

  const missing = (["name", "email"] as const).filter((field) => !columns.has(field));
  if (missing.length) {
    throw new ApiError(
      400,
      "MISSING_COLUMNS",
      `The workbook needs a ${missing
        .map((field) => (field === "name" ? "Full Name" : "Work Email"))
        .join(" and ")} column. Expected headers: Prefix, Full Name, Work Email, Division.`,
    );
  }

  const rows: ImportRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const read = (field: SheetField) => {
      const column = columns.get(field);
      return column ? cellText(row.getCell(column)) : "";
    };
    const name = read("name");
    const email = read("email");
    // A wholly empty line is trailing whitespace in the sheet, not an error.
    if (!name && !email && !read("prefix") && !read("division")) continue;
    rows.push({
      prefix: read("prefix") || null,
      name,
      email,
      division: read("division") || null,
      sheetRow: rowNumber,
    });
  }

  if (!rows.length) {
    throw new ApiError(400, "EMPTY_WORKBOOK", "No data rows were found below the header");
  }
  return rows;
}
