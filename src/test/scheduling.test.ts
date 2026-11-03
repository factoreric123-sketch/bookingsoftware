import { describe, expect, it } from "vitest";
import { availableSlots, seedWorkspace } from "../lib/app-store";

describe("availability engine", () => {
  it("removes slots that overlap an existing appointment", () => {
    const slots = availableSlots(seedWorkspace, "svc_strategy", "2026-11-04");

    expect(slots).toContain("10:00");
    expect(slots).not.toContain("10:30");
    expect(slots).not.toContain("11:00");
    expect(slots).not.toContain("11:30");
    expect(slots).not.toContain("12:00");
    expect(slots).toContain("12:30");
  });

  it("returns no slots on a closed day", () => {
    expect(availableSlots(seedWorkspace, "svc_strategy", "2026-11-08")).toEqual([]);
  });

  it("releases the current appointment while choosing a reschedule slot", () => {
    const slots = availableSlots(seedWorkspace, "svc_review", "2026-11-04", "apt_3");

    expect(slots).toContain("11:00");
  });
});
