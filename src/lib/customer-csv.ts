export type CustomerImportRow = {
  line: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
  tags: string[];
  status: "ready" | "skip" | "invalid" | "imported" | "warning" | "failed";
  detail: string;
};

function parseCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;
  const finishCell = () => { row.push(cell); cell = ""; closedQuote = false; };
  const finishRow = () => { finishCell(); if (row.some((value) => value.trim())) rows.push(row); row = []; };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
    } else if (char === ",") finishCell();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      finishRow();
    } else if (closedQuote) {
      if (char !== " " && char !== "\t") throw new Error("Unexpected text after a quoted CSV value.");
    } else if (char === '"' && !cell) quoted = true;
    else if (char === '"') throw new Error("Unexpected quote in an unquoted CSV value.");
    else cell += char;
  }
  if (quoted) throw new Error("A CSV value has an unclosed quote.");
  if (cell || row.length) finishRow();
  return rows;
}

export function previewCustomerCsv(text: string, existingEmails: string[]): CustomerImportRow[] {
  const rows = parseCells(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) throw new Error("The CSV needs a header and at least one customer row.");
  if (rows.length > 501) throw new Error("Import at most 500 customers per file.");
  const header = rows[0]!.map((value) => value.trim().toLowerCase());
  for (const required of ["name", "email"]) {
    if (header.filter((value) => value === required).length !== 1) {
      throw new Error(`The CSV needs exactly one ${required} column.`);
    }
  }
  const index = (name: string) => header.indexOf(name);
  const read = (row: string[], name: string) => (index(name) < 0 ? "" : row[index(name)] ?? "").trim();
  const seen = new Set(existingEmails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  return rows.slice(1).map((row, position) => {
    const name = read(row, "name");
    const email = read(row, "email");
    const phone = read(row, "phone");
    const notes = read(row, "notes");
    const tags = read(row, "tags").split("|").map((tag) => tag.trim()).filter(Boolean);
    let status: CustomerImportRow["status"] = "ready";
    let detail = "Ready to import";
    if (row.length > header.length || !name || name.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || phone.length > 30 || notes.length > 2000 || tags.length > 25 || tags.some((tag) => tag.length > 60)) {
      status = "invalid";
      detail = "Check the name, email, phone, notes, or tags.";
    } else if (seen.has(email.toLowerCase())) {
      status = "skip";
      detail = "Email already exists in this workspace or file.";
    } else seen.add(email.toLowerCase());
    return { line: position + 2, name, email, phone, notes, tags, status, detail };
  });
}
