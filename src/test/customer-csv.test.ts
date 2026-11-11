import { describe, expect, it } from "vitest";
import { previewCustomerCsv } from "../lib/customer-csv";

describe("customer CSV preview", () => {
  it("parses exported quoting and marks existing and repeated emails", () => {
    const csv = 'Name,Email,Phone,Tags,Notes\r\n"Ada, A.",ada@example.com,,"VIP | Repeat","First line\nSecond line"\r\nBob,bob@example.com,,,\r\nCopy,BOB@example.com,,,\r\n';
    const rows = previewCustomerCsv(csv, ["ada@example.com"]);
    expect(rows.map((row) => row.status)).toEqual(["skip", "ready", "skip"]);
    expect(rows[0]!.name).toBe("Ada, A.");
    expect(rows[0]!.tags).toEqual(["VIP", "Repeat"]);
    expect(rows[0]!.notes).toBe("First line\nSecond line");
  });

  it("reports invalid rows without aborting valid rows", () => {
    const rows = previewCustomerCsv("Name,Email\nNo email,\nValid,valid@example.com\n", []);
    expect(rows.map((row) => row.status)).toEqual(["invalid", "ready"]);
  });

  it("rejects malformed files before import", () => {
    expect(() => previewCustomerCsv('Name,Email\n"Unclosed,bad@example.com', [])).toThrow(/unclosed quote/);
    expect(() => previewCustomerCsv("Name,Name,Email\nA,a,a@example.com", [])).toThrow(/exactly one name/);
  });
});
