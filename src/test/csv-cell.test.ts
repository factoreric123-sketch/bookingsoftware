import { describe, expect, it } from "vitest";
import { csvCell } from "../lib/csv-cell";

describe("CSV cell escaping", () => {
  it("quotes embedded punctuation and prevents spreadsheet formulas after whitespace", () => {
    expect(csvCell('A, "B"\nC')).toBe('"A, ""B""\nC"');
    expect(csvCell(' \t=HYPERLINK("x")')).toBe('"\' \t=HYPERLINK(""x"")"');
    expect(csvCell("-SUM(1,2)")).toBe('"\'-SUM(1,2)"');
  });

  it("keeps numeric negatives as numbers", () => {
    expect(csvCell(-12)).toBe('"-12"');
  });
});
