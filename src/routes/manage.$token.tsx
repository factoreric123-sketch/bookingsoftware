import { pageHead } from "../lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, Check, Clock3, Loader2, RefreshCw, X } from "lucide-react";
import { invokeBackend } from "../integrations/supabase/backend";

export const Route = createFileRoute("/manage/$token")({ head: () => pageHead("Avello \u2014 Manage appointment", "View, reschedule, or cancel your Avello appointment securely."), component: ManageBooking });

type ManagedAppointment = {
  appointment_id: string;
  status: string;
  row_version: number;
  starts_at: string;
  ends_at: string;
  timezone: string;
  services: Array<{ name: string; duration_minutes: number; line_total_minor: number }>;
  total_minor: number;
  currency: string;
  payment_status: string;
  cancellation_policy: string;
  allowed_actions: { can_reschedule: boolean; can_cancel: boolean };
};

const dateTime = (value: string, timeZone: string) => new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);

function ManageBooking() {
  const { token } = Route.useParams();
  const [appointment, setAppointment] = useState<ManagedAppointment | null>(null);
  const [newTime, setNewTime] = useState("");
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try { setAppointment(await invokeBackend<ManagedAppointment>("get_managed_appointment", { p_token: token })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "This management link is invalid or expired."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);

  const reschedule = async () => {
    if (!appointment || !newTime) return;
    setLoading(true); setError("");
    try {
      await invokeBackend("reschedule_appointment", { p_appointment_id: appointment.appointment_id, p_new_starts_at: new Date(newTime).toISOString(), p_management_token: token, p_expected_row_version: appointment.row_version, p_request_key: crypto.randomUUID() });
      setMessage("Your appointment was rescheduled.");
      setMode("view");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The appointment could not be rescheduled."); setLoading(false); }
  };

  const cancel = async () => {
    if (!appointment) return;
    setLoading(true); setError("");
    try {
      await invokeBackend("cancel_appointment", { p_appointment_id: appointment.appointment_id, p_reason: reason.trim() || "Cancelled by customer", p_management_token: token, p_expected_row_version: appointment.row_version, p_request_key: crypto.randomUUID() });
      setMessage("Your appointment was cancelled.");
      setMode("view");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The appointment could not be cancelled."); setLoading(false); }
  };

  if (loading && !appointment) return <div className="manage-page"><main className="manage-card"><Loader2 className="spin"/> Loading appointment…</main></div>;
  if (!appointment) return <div className="manage-page"><main className="manage-card"><h1>Management link unavailable</h1><p>{error}</p><Link to="/">Return to Avello</Link></main></div>;
  const service = appointment.services?.[0];

  return <div className="manage-page"><main className="manage-card">
    <div className="manage-brand"><span>A</span><b>Avello</b></div>
    <span className={`status ${appointment.status}`}>{appointment.status.replace("_", " ")}</span>
    <h1>Manage your appointment</h1>
    {message && <div className="auth-success"><Check size={16}/>{message}</div>}
    <div className="manage-summary"><div><CalendarDays size={18}/><span><b>{dateTime(appointment.starts_at, appointment.timezone)}</b><small>{appointment.timezone}</small></span></div><div><Clock3 size={18}/><span><b>{service?.name ?? "Appointment"}</b><small>{service?.duration_minutes ?? Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000)} minutes · {money(appointment.total_minor, appointment.currency)}</small></span></div></div>
    {mode === "view" && <div className="manage-actions"><button disabled={!appointment.allowed_actions.can_reschedule || appointment.status === "cancelled"} onClick={() => setMode("reschedule")}><RefreshCw size={16}/>Reschedule</button><button className="danger" disabled={!appointment.allowed_actions.can_cancel || appointment.status === "cancelled"} onClick={() => setMode("cancel")}><X size={16}/>Cancel appointment</button></div>}
    {mode === "reschedule" && <section className="manage-form"><h2>Choose a new time</h2><p>The database will verify availability before changing your original booking.</p><label>New date and time<input type="datetime-local" value={newTime} onChange={(event) => setNewTime(event.target.value)}/></label><div><button onClick={() => setMode("view")}>Keep original</button><button className="solid-action" disabled={!newTime || loading} onClick={reschedule}>{loading ? <Loader2 className="spin" size={16}/> : "Confirm new time"}</button></div></section>}
    {mode === "cancel" && <section className="manage-form"><h2>Cancel this appointment?</h2><p>This releases the reserved capacity. It does not automatically issue or claim a refund.</p><label>Reason <small>Optional</small><textarea value={reason} onChange={(event) => setReason(event.target.value)}/></label><div><button onClick={() => setMode("view")}>Keep appointment</button><button className="danger-action" disabled={loading} onClick={cancel}>{loading ? <Loader2 className="spin" size={16}/> : "Cancel appointment"}</button></div></section>}
    {error && <div className="booking-error">{error}</div>}
    {appointment.cancellation_policy && <p className="manage-policy">{appointment.cancellation_policy}</p>}
  </main></div>;
}
