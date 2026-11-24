import { useEffect, useState } from "react";
import { invokeBackend } from "../integrations/supabase/backend";

type Exception = {
  id: string;
  date: string;
  closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  reason: string;
  row_version: number;
};

type Impact = {
  affected: Array<{ appointment_id: string; starts_at: string; timezone: string; service_name: string }>;
};

export function ScheduleExceptions({ businessId, locationId, calendarDate }: {
  businessId: string;
  locationId: string;
  calendarDate: string;
}) {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [editing, setEditing] = useState<Exception | null>(null);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setBusy(true);
    setError("");
    invokeBackend<Exception[]>("get_schedule_exceptions", { p_business_id: businessId, p_location_id: locationId })
      .then((data) => { if (current) setExceptions(data); })
      .catch((error) => { if (current) setError(error instanceof Error ? error.message : "Could not load special hours."); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [businessId, locationId, reload]);
  const edit = (exception: Exception) => {
    setEditing(exception);
    setImpact(null);
    setError("");
  };
  const submit = async (save: boolean) => {
    if (!editing || busy) return;
    setBusy(true);
    setError("");
    const params = {
      p_business_id: businessId, p_location_id: locationId,
      p_exception_date: editing.date, p_closed: editing.closed,
      p_opens_at: editing.closed ? null : editing.opens_at,
      p_closes_at: editing.closed ? null : editing.closes_at,
      p_reason: editing.reason.trim(), p_expected_row_version: editing.row_version || null,
    };
    try {
      if (save) {
        await invokeBackend("save_schedule_exception", params);
        setEditing(null);
        setImpact(null);
        setReload((value) => value + 1);
      } else setImpact(await invokeBackend<Impact>("preview_schedule_exception", params));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update special hours."); }
    finally { setBusy(false); }
  };
  const remove = async (item: Exception) => {
    if (!window.confirm("Remove these special hours and use the normal schedule for this date?")) return;
    setBusy(true);
    setError("");
    try {
      await invokeBackend("remove_schedule_exception", {
        p_business_id: businessId, p_location_id: locationId,
        p_exception_date: item.date, p_expected_row_version: item.row_version,
      });
      setEditing(null);
      setImpact(null);
      setReload((value) => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not remove special hours."); }
    finally { setBusy(false); }
  };
  const valid = editing?.date && (editing.closed || Boolean(editing.opens_at && editing.closes_at && editing.opens_at < editing.closes_at));
  return <section className="panel block-list settings-form">
    <div className="panel-heading">
      <div><h2>Holidays and special hours</h2><p>Set hours for a single date, or close the location for the entire day.</p></div>
      <button type="button" disabled={busy} className="secondary-action" onClick={() => edit({
        id: "", date: calendarDate, closed: true, opens_at: "09:00", closes_at: "17:00", reason: "", row_version: 0,
      })}>Add exception</button>
    </div>
    {error && <p className="booking-error" role="alert">{error}</p>}
    {exceptions.map((item) => (
      <div className="approval-row" key={item.id}>
        <div><b>{item.date} · {item.closed ? "Closed" : `${item.opens_at?.slice(0, 5)}–${item.closes_at?.slice(0, 5)}`}</b>
          {item.reason && <p>{item.reason}</p>}</div>
        <div className="approval-actions">
          <button className="secondary-action" disabled={busy} onClick={() => edit(item)}>Edit</button>
          <button className="secondary-action" disabled={busy} onClick={() => void remove(item)}>Remove</button>
        </div>
      </div>
    ))}
    {!editing && !busy && !exceptions.length && !error && <p>No exceptions set.</p>}
    {editing && <div className="schedule-exception-fields">
      <div className="field-pair">
        <label>Date<input type="date" disabled={busy || Boolean(editing.id)} value={editing.date} onChange={(event) => edit({ ...editing, date: event.target.value })} /></label>
        <label>Hours<select disabled={busy} value={editing.closed ? "closed" : "special"} onChange={(event) => edit({ ...editing, closed: event.target.value === "closed" })}>
          <option value="closed">Closed all day</option><option value="special">Special hours</option>
        </select></label>
      </div>
      {!editing.closed && <div className="field-pair">
        <label>Opens at<input type="time" disabled={busy} value={editing.opens_at ?? ""} onChange={(event) => edit({ ...editing, opens_at: event.target.value })} /></label>
        <label>Closes at<input type="time" disabled={busy} value={editing.closes_at ?? ""} onChange={(event) => edit({ ...editing, closes_at: event.target.value })} /></label>
      </div>}
      <label>Reason (optional)<input disabled={busy} value={editing.reason} onChange={(event) => edit({ ...editing, reason: event.target.value })} /></label>
      {impact && <div role="status">
        <b>{impact.affected.length ? "Existing bookings outside these hours" : "No existing bookings affected"}</b>
        {impact.affected.length > 0 && <ul>{impact.affected.map((item) => (
          <li key={item.appointment_id}>{item.service_name} · {new Intl.DateTimeFormat("en-US", { timeZone: item.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(item.starts_at))}</li>
        ))}</ul>}
        <p>Existing bookings stay on the calendar.</p>
      </div>}
      <div className="approval-actions">
        <button className="secondary-action" disabled={busy} onClick={() => { setEditing(null); setImpact(null); }}>Cancel</button>
        <button className="secondary-action" disabled={!valid || busy} onClick={() => void submit(false)}>Check affected bookings</button>
        <button className="solid-action" disabled={!impact || !valid || busy} onClick={() => void submit(true)}>Save hours</button>
      </div>
    </div>}
  </section>;
}
