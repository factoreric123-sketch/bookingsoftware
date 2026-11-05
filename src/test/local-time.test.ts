import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const source = readFileSync("supabase/functions/backend-api/index.ts", "utf8");
const start = source.indexOf("function localDateTimeToIso(");
const end = source.indexOf("\nDeno.serve(", start);
const compiled = ts.transpileModule(`${source.slice(start, end)}\nlocalDateTimeToIso`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const convert = runInNewContext(compiled, { Date, Intl, Error }) as (date: string, time: string, zone: string) => string;

describe("business local time conversion", () => {
  it("converts ordinary local time to UTC", () => {
    expect(convert("2027-03-15", "09:30", "America/New_York")).toBe("2027-03-15T13:30:00.000Z");
  });

  it("rejects a nonexistent spring-forward time", () => {
    expect(() => convert("2027-03-14", "02:30", "America/New_York")).toThrow(/does not exist/);
  });

  it("rejects an ambiguous fall-back time", () => {
    expect(() => convert("2027-11-07", "01:30", "America/New_York")).toThrow(/occurs twice/);
  });

  it("rejects impossible calendar dates", () => {
    expect(() => convert("2027-02-30", "09:30", "UTC")).toThrow(/valid local/);
  });
});
