import { useEffect, useState } from "react";
import { businessDate } from "../lib/business-date";

export type ReplacementSlot = {
  starts_at: string;
  ends_at: string;
  timezone: string;
};

export type ReplacementAvailability = {
  min_date: string;
  max_date: string;
  slots: ReplacementSlot[];
};

export function RescheduleSlotPicker({
  timezone,
  initialDate,
  loadSlots,
  onSelect,
  disabled = false,
}: {
  timezone: string;
  initialDate?: string;
  loadSlots: (date: string) => Promise<ReplacementAvailability>;
  onSelect: (slot: ReplacementSlot | null) => void;
  disabled?: boolean;
}) {
  const today = businessDate(timezone);
  const [date, setDate] = useState(initialDate && initialDate > today ? initialDate : today);
  const [availability, setAvailability] = useState<ReplacementAvailability | null>(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;
    setSelected("");
    onSelect(null);
    if (!date) {
      setAvailability(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    loadSlots(date)
      .then((result) => { if (current) setAvailability(result); })
      .catch((error) => {
        if (!current) return;
        setAvailability(null);
        setError(error instanceof Error ? error.message : "Available times could not be loaded.");
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [date, loadSlots, onSelect, retry]);

  const timeLabel = (start: string, zone: string) => new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour: "numeric",
    minute: "numeric",
    timeZoneName: "short",
  }).format(new Date(start));

  return (
    <div className="replacement-times">
      <label>
        New date
        <input
          type="date"
          min={availability?.min_date ?? today}
          max={availability?.max_date}
          disabled={disabled}
          value={date}
          onChange={(event) => {
            setSelected("");
            onSelect(null);
            setDate(event.target.value);
          }}
        />
      </label>
      {loading && <p role="status">Checking available times…</p>}
      {!loading && error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" className="secondary-action" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>
      )}
      {!loading && availability && availability.slots.length === 0 && <p>No available times on this date.</p>}
      {!loading && availability && availability.slots.length > 0 && (
        <label>
          New time
          <select
            value={selected}
            disabled={disabled}
            onChange={(event) => {
              setSelected(event.target.value);
              onSelect(availability.slots.find((slot) => slot.starts_at === event.target.value) ?? null);
            }}
          >
            <option value="">Select a time</option>
            {availability.slots.map((slot) => (
              <option key={slot.starts_at} value={slot.starts_at}>{timeLabel(slot.starts_at, slot.timezone)}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
