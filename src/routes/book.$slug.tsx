import { pageHead } from "../lib/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Loader2, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { BackendError, invokeBackend } from "../integrations/supabase/backend";

export const Route = createFileRoute("/book/$slug")({ head: () => pageHead("Avello \u2014 Book an appointment", "Choose a service and available appointment time through Avello."), component: BookingPage });

type PublicService = { service_id: string; name: string; description: string; duration_minutes: number; price_minor: number; currency: string; payment_requirement: string };
type PublicStaff = { staff_id: string; display_name: string; bio?: string };
type PublicPage = { booking_page_id: string; title: string; accent_color: string; staff_selection_enabled: boolean; business: { name: string; description: string; timezone: string; currency: string; accent_color: string }; location: { name: string; address_line1: string; city: string; region: string; timezone: string }; services: PublicService[]; staff: PublicStaff[] };
type Slot = { session_id: string | null; staff_id: string; starts_at: string; ends_at: string; timezone: string; remaining_capacity: number };
type Hold = { hold_id: string; hold_token: string; expires_at: string; session_id: string; staff_id: string; price: { price_minor: number; currency: string; duration_minutes: number } };
type Confirmation = { appointment_id: string; status: string; management_token: string; summary: { starts_at: string; ends_at: string; timezone: string; service_name: string; total_minor: number; currency: string } };
type Step = "service" | "date" | "details" | "confirmed";

const money = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
const shortDate = (value: string, timeZone?: string) => new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(value));
const time = (value: string, timeZone?: string) => new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
const dateInZone = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

function BookingPage() {
  const { slug } = Route.useParams();
  const [page, setPage] = useState<PublicPage | null>(null);
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [details, setDetails] = useState({ name: "", email: "", phone: "", notes: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [holdRequestKey, setHoldRequestKey] = useState(() => crypto.randomUUID());
  const [confirmRequestKey] = useState(() => crypto.randomUUID());
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);

  useEffect(() => {
    setLoading(true);
    invokeBackend<PublicPage>("get_public_booking_page", { p_slug: slug }).then(setPage).catch((caught) => setError(caught instanceof BackendError && caught.code === "P0404" ? "This booking page is not available." : caught instanceof Error ? caught.message : "Booking page unavailable")).finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!date || !serviceId || !page) return;
    setLoading(true);
    setError("");
    invokeBackend<Slot[]>("get_availability", { p_booking_page_id: page.booking_page_id, p_service_id: serviceId, p_from_date: date, p_through_date: date, p_staff_id: staffId, p_addon_quantities: [], p_seat_count: 1 })
      .then((data) => setSlots(data ?? []))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Availability could not be loaded"))
      .finally(() => setLoading(false));
  }, [date, page, serviceId, staffId, availabilityRefresh]);

  useEffect(() => {
    if (!hold) return;
    const update = () => setSecondsLeft(Math.max(0, Math.floor((new Date(hold.expires_at).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [hold]);

  const service = page?.services.find((item) => item.service_id === serviceId);
  const dates = useMemo(() => {
    const today = dateInZone(new Date(), page?.location.timezone ?? "UTC");
    return Array.from({ length: 14 }, (_, index) => {
      const value = new Date(`${today}T12:00:00Z`);
      value.setUTCDate(value.getUTCDate() + index);
      return value.toISOString().slice(0, 10);
    });
  }, [page?.location.timezone]);

  const reserve = async () => {
    if (!page || !slot) return;
    setLoading(true);
    setError("");
    try {
      const created = await invokeBackend<Hold>("create_booking_hold", { p_booking_page_id: page.booking_page_id, p_service_id: serviceId, p_staff_id: slot.staff_id, p_session_id: slot.session_id, p_starts_at: slot.starts_at, p_addon_quantities: [], p_seat_count: 1, p_request_key: holdRequestKey });
      setHold(created);
      setStep("details");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That time is no longer available");
      setHoldRequestKey(crypto.randomUUID());
      setSlot(null);
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    if (!hold || !details.name || !details.email) return;
    setLoading(true);
    setError("");
    try {
      const result = await invokeBackend<Confirmation>("confirm_booking", { p_hold_token: hold.hold_token, p_customer_id: null, p_contact: { full_name: details.name.trim(), email: details.email.trim(), phone_e164: details.phone.trim() || null }, p_customer_notes: details.notes.trim(), p_consent_decisions: [], p_request_key: confirmRequestKey });
      setConfirmation(result);
      setStep("confirmed");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Booking confirmation failed"); }
    finally { setLoading(false); }
  };

  const chooseAnotherTime = () => {
    setHold(null);
    setSlot(null);
    setError("");
    setHoldRequestKey(crypto.randomUUID());
    setAvailabilityRefresh((value) => value + 1);
    setStep("date");
  };

  if (loading && !page) return <div className="public-booking"><main className="booking-card" role="status"><Loader2 className="spin"/> Loading secure booking page…</main></div>;
  if (!page) return <div className="public-booking"><main className="booking-card"><h1>Booking unavailable</h1><p role="alert">{error || "This booking page is not published."}</p></main></div>;
  const accent = page.accent_color || page.business.accent_color;

  if (step === "confirmed" && confirmation) return <div className="public-booking"><div className="booking-card confirmation-card" style={{ "--booking-accent": accent } as React.CSSProperties}><div className="confirmation-icon"><Check size={28}/></div><span>BOOKING CONFIRMED</span><h1>You’re all set, {details.name.split(" ")[0]}.</h1><p>Your appointment with {page.business.name} is confirmed.</p><div className="confirmation-details"><div><CalendarDays size={18}/><span><b>{shortDate(confirmation.summary.starts_at, confirmation.summary.timezone)}</b><small>{time(confirmation.summary.starts_at, confirmation.summary.timezone)}</small></span></div><div><Clock3 size={18}/><span><b>{confirmation.summary.service_name}</b><small>{money(confirmation.summary.total_minor, confirmation.summary.currency)}</small></span></div><div><MapPin size={18}/><span><b>{page.location.name}</b><small>{page.location.address_line1}</small></span></div></div><Link className="manage-booking-link" to="/manage/$token" params={{ token: confirmation.management_token }}>Manage or reschedule this booking</Link></div></div>;

  return <div className="public-booking">
    <header><div className="public-brand" style={{ background: accent }}>{page.business.name.charAt(0)}</div><div><b>{page.business.name}</b><span>{page.location.name}</span></div></header>
    <main className="booking-card" style={{ "--booking-accent": accent } as React.CSSProperties}>
      {step === "service" && <section><span className="booking-kicker">WELCOME TO {page.business.name.toUpperCase()}</span><h1>What would you like to book?</h1><p>Choose a service and team member.</p><div className="public-service-list">{page.services.map((item) => <button aria-pressed={serviceId === item.service_id} className={serviceId === item.service_id ? "selected" : ""} onClick={() => { setServiceId(item.service_id); setStaffId(null); }} key={item.service_id}><i style={{ background: accent }}><Clock3 size={18}/></i><div><b>{item.name}</b><small>{item.description}</small><span>{item.duration_minutes} min · {money(item.price_minor, item.currency)}</span></div><em>{serviceId === item.service_id ? <Check size={15}/> : <ArrowRight size={16}/>}</em></button>)}</div>{serviceId && page.staff_selection_enabled && <div className="staff-picker"><b>Choose a team member</b><div><button aria-pressed={!staffId} className={!staffId ? "selected" : ""} onClick={() => setStaffId(null)}><span>★</span><small>Anyone available</small></button>{page.staff.map((member) => <button aria-pressed={staffId === member.staff_id} className={staffId === member.staff_id ? "selected" : ""} onClick={() => setStaffId(member.staff_id)} key={member.staff_id}><span>{member.display_name.split(" ").map((part) => part[0]).join("")}</span><small>{member.display_name}</small></button>)}</div></div>}<button className="booking-continue" disabled={!serviceId} onClick={() => setStep("date")}>Choose a time <ArrowRight size={16}/></button></section>}
      {step === "date" && <section><button className="booking-back" onClick={() => setStep("service")}><ArrowLeft size={15}/>Services & staff</button><span className="booking-kicker">{service?.name}</span><h1>Pick a date and time.</h1><p>Times shown in {page.location.timezone}.</p><div className="date-strip">{dates.map((item) => { const value = new Date(`${item}T12:00:00Z`); return <button aria-pressed={date === item} aria-label={value.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })} className={date === item ? "selected" : ""} onClick={() => { setDate(item); setSlot(null); }} key={item}><small>{value.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" })}</small><b>{value.getUTCDate()}</b><span>{value.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" })}</span></button>; })}</div>{date && <div className="slot-grid">{loading ? <div role="status"><Loader2 className="spin"/>Loading times…</div> : slots.length ? slots.map((item) => <button aria-pressed={slot?.starts_at === item.starts_at && slot.staff_id === item.staff_id} className={slot?.starts_at === item.starts_at && slot.staff_id === item.staff_id ? "selected" : ""} onClick={() => setSlot(item)} key={`${item.starts_at}-${item.staff_id}`}>{time(item.starts_at, item.timezone)}</button>) : <div className="no-slots">No times available on this date.</div>}</div>}{error && <div className="booking-error" role="alert">{error}</div>}<button className="booking-continue" disabled={!slot || loading} onClick={reserve}>{loading ? <Loader2 className="spin" size={16}/> : <>Reserve this time <ArrowRight size={16}/></>}</button></section>}
      {step === "details" && hold && <section><span className="booking-kicker">TIME RESERVED · {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</span><h1>Your details.</h1><p>Finish before the reservation expires.</p><div className="booking-summary"><CalendarDays size={18}/><div><b>{service?.name}</b><span>{slot && shortDate(slot.starts_at, slot.timezone)} at {slot && time(slot.starts_at, slot.timezone)} · {money(hold.price.price_minor, hold.price.currency)}</span></div></div><div className="public-fields"><label>Full name<div><UserRound size={16}/><input value={details.name} onChange={(event) => setDetails({ ...details, name: event.target.value })}/></div></label><label>Email address<input type="email" value={details.email} onChange={(event) => setDetails({ ...details, email: event.target.value })}/></label><label>Phone number<input type="tel" value={details.phone} onChange={(event) => setDetails({ ...details, phone: event.target.value })}/></label><label>Anything we should know? <small>Optional</small><textarea value={details.notes} onChange={(event) => setDetails({ ...details, notes: event.target.value })}/></label></div>{secondsLeft === 0 && <><div className="booking-error" role="alert">This reservation expired. Choose another time.</div><button className="booking-back" onClick={chooseAnotherTime}><ArrowLeft size={15}/>Choose another time</button></>}{error && <div className="booking-error" role="alert">{error}</div>}<button className="booking-continue" disabled={!details.name.trim() || !details.email.trim() || loading || secondsLeft === 0} onClick={confirm}>{loading ? <Loader2 className="spin" size={16}/> : <>Confirm booking <Check size={16}/></>}</button><small className="privacy-note"><ShieldCheck size={14}/>Your booking is protected by Avello’s secure scheduling system.</small></section>}
    </main>
    <footer>Powered by <b>Avello</b></footer>
  </div>;
}
