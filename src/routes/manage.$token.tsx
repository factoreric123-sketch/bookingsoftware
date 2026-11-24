import { pageHead } from "../lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Clock3, Loader2, RefreshCw, X } from "lucide-react";
import { invokeBackend } from "../integrations/supabase/backend";
import { RescheduleSlotPicker, type ReplacementAvailability, type ReplacementSlot } from "../components/RescheduleSlotPicker";
import { businessDate } from "../lib/business-date";
import { BookingIntakeFields, type BookingIntakeForm } from "../components/BookingIntakeFields";

export const Route = createFileRoute("/manage/$token")({
  head: () => pageHead("Avello \u2014 Manage appointment", "View, reschedule, or cancel your Avello appointment securely."),
  validateSearch: (search: Record<string, unknown>): { intake?: true } => search["intake"] === true ? { intake: true } : {},
  component: ManageBooking,
});

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
  const { intake: openIntake } = Route.useSearch();
  const [appointment, setAppointment] = useState<ManagedAppointment | null>(null);
  const [replacement, setReplacement] = useState<ReplacementSlot | null>(null);
  const [slotRefresh, setSlotRefresh] = useState(0);
  const request = useRef<{ startsAt: string; key: string } | null>(null);
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [reason, setReason] = useState("");
  const [intake, setIntake] = useState<{ form: BookingIntakeForm; submitted: boolean } | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, unknown>>({});
  const [intakeError, setIntakeError] = useState("");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const intakeRequest = useRef(crypto.randomUUID());
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
  useEffect(() => {
    let current = true;
    setIntake(null);
    setIntakeOpen(openIntake === true);
    setIntakeAnswers({});
    setIntakeError("");
    intakeRequest.current = crypto.randomUUID();
    void load();
    invokeBackend<{ form: BookingIntakeForm; submitted: boolean } | null>("get_appointment_intake", {
      p_management_token: token,
    }).then((result) => { if (current) setIntake(result); })
      .catch(() => { if (current) setIntakeError("Intake information could not be loaded. Refresh to retry."); });
    return () => { current = false; };
  }, [token, openIntake]);
  const appointmentId = appointment?.appointment_id;
  const version = appointment?.row_version;
  const loadReplacementSlots = useCallback((date: string) => invokeBackend<ReplacementAvailability>("get_reschedule_availability", {
    p_appointment_id: appointmentId,
    p_expected_row_version: version,
    p_management_token: token,
    p_local_date: date,
  }), [appointmentId, token, version]);

  const reschedule = async () => {
    if (!appointment || !replacement) return;
    if (request.current?.startsAt !== replacement.starts_at) {
      request.current = { startsAt: replacement.starts_at, key: crypto.randomUUID() };
    }
    setLoading(true); setError("");
    try {
      await invokeBackend("reschedule_appointment", {
        p_appointment_id: appointment.appointment_id,
        p_new_starts_at: replacement.starts_at,
        p_slot_date: businessDate(replacement.timezone, new Date(replacement.starts_at)),
        p_management_token: token,
        p_expected_row_version: appointment.row_version,
        p_request_key: request.current.key,
      });
      request.current = null;
      setMessage("Your appointment was rescheduled.");
      setMode("view");
      await load();
    } catch (caught) {
      const latest = await invokeBackend<ManagedAppointment>("get_managed_appointment", { p_token: token }).catch(() => null);
      if (latest) setAppointment(latest);
      if (latest && Date.parse(latest.starts_at) === Date.parse(replacement.starts_at)) {
        request.current = null;
        setReplacement(null);
        setMessage("Your appointment was rescheduled.");
        setMode("view");
        setLoading(false);
        return;
      }
      setError(caught instanceof Error ? caught.message : "The appointment could not be rescheduled.");
      setReplacement(null);
      setSlotRefresh((value) => value + 1);
      setLoading(false);
    }
  };

  const cancel = async () => {
    if (!appointment) return;
    setLoading(true); setError("");
    try {
      await invokeBackend("cancel_appointment", { p_appointment_id: appointment.appointment_id, p_reason: reason.trim() || "Cancelled by customer", p_management_token: token, p_expected_row_version: appointment.row_version, p_request_key: crypto.randomUUID() });
      setMessage("Your appointment was cancelled.");
      setIntake(null);
      setIntakeOpen(false);
      setMode("view");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The appointment could not be cancelled."); setLoading(false); }
  };

  const submitIntake = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!intake || intake.submitted || loading) return;
    setLoading(true);
    setIntakeError("");
    try {
      await invokeBackend("submit_appointment_intake", {
        p_management_token: token,
        p_intake: { version_id: intake.form.version_id, answers: intakeAnswers },
        p_request_key: intakeRequest.current,
      });
      setIntake({ ...intake, submitted: true });
      setIntakeAnswers({});
      setIntakeOpen(false);
    } catch (caught) { setIntakeError(caught instanceof Error ? caught.message : "Your intake form could not be submitted."); }
    finally { setLoading(false); }
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
    {mode === "reschedule" && <section className="manage-form">
      <h2>Choose a new time</h2>
      <p>Your original appointment stays booked until the new time is confirmed.</p>
      <RescheduleSlotPicker
        key={slotRefresh}
        timezone={appointment.timezone}
        loadSlots={loadReplacementSlots}
        onSelect={setReplacement}
        disabled={loading}
      />
      <div>
        <button disabled={loading} onClick={() => setMode("view")}>Keep original</button>
        <button className="solid-action" disabled={!replacement || loading} onClick={reschedule}>
          {loading ? <Loader2 className="spin" size={16}/> : "Confirm new time"}
        </button>
      </div>
    </section>}
    {mode === "cancel" && <section className="manage-form"><h2>Cancel this appointment?</h2><p>This releases the reserved capacity. It does not automatically issue or claim a refund.</p><label>Reason <small>Optional</small><textarea value={reason} onChange={(event) => setReason(event.target.value)}/></label><div><button onClick={() => setMode("view")}>Keep appointment</button><button className="danger-action" disabled={loading} onClick={cancel}>{loading ? <Loader2 className="spin" size={16}/> : "Cancel appointment"}</button></div></section>}
    {mode === "view" && intake && <section className="manage-form">
      <h2>Appointment intake</h2>
      {intake.submitted ? <p role="status">Your intake form was received.</p> : (
        intakeOpen ? <form onSubmit={submitIntake}>
          <BookingIntakeFields form={intake.form} answers={intakeAnswers} disabled={loading}
            onChange={(key, value) => setIntakeAnswers((current) => ({ ...current, [key]: value }))} />
          <button type="submit" disabled={loading} className="solid-action">Submit intake form</button>
        </form> : <button className="secondary-action" onClick={() => setIntakeOpen(true)}>Complete optional intake</button>
      )}
    </section>}
    {mode === "view" && intakeError && <div className="booking-error" role="alert">{intakeError}</div>}
    {error && <div className="booking-error">{error}</div>}
    {appointment.cancellation_policy && <p className="manage-policy">{appointment.cancellation_policy}</p>}
  </main></div>;
}
