import { describe, expect, it } from "vitest";
import { businessDate, calendarWeekStart, shiftCalendarDate } from "../lib/business-date";

describe("business calendar dates", () => {
  it("uses the business day across the UTC boundary", () => {
    const instant = new Date("2026-11-09T01:00:00Z");
    expect(businessDate("America/New_York", instant)).toBe("2026-11-08");
    expect(businessDate("Pacific/Kiritimati", instant)).toBe("2026-11-09");
  });

  it("moves calendar days and week starts across month and year boundaries", () => {
    expect(shiftCalendarDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(calendarWeekStart("2027-01-03")).toBe("2026-12-28");
  });
});
