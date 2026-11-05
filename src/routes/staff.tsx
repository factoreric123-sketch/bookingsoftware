import { pageHead } from "../lib/page-head";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth-context";
import { invokeBackend } from "../integrations/supabase/backend";

type Schedule = {
  business: { name: string; timezone: string; slug: string };
  role: "staff" | "manager";
  staff: { display_name: string } | null;
  sessions: Array<{ id: string; starts_at: string; ends_at: string; primary_service_id: string | null; appointments: Array<{ id: string; customer_id?: string | null; status: string }> }>;
  customers: Array<{ id: string; full_name: string }>;
  services: Array<{ id: string; name: string }>;
};

export const Route = createFileRoute("/staff")({ head: () => pageHead("Avello — My schedule", "View your assigned appointments."), component: StaffSchedule });

function StaffSchedule() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [error, setError] = useState("");
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    invokeBackend<Schedule>("get_staff_schedule", {}).then((data) => { if (active) setSchedule(data); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Schedule unavailable."); })
      .finally(() => { if (active) setLoadingSchedule(false); });
    return () => { active = false; };
  }, [user]);

  if (loading || loadingSchedule) return <main className="app-loading">Loading your schedule…</main>;
  if (!user) return null;
  const timeZone = schedule?.business.timezone ?? "America/New_York";
  const dateTime = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <main className="dashboard-content" style={{ maxWidth: 900, margin: "auto" }}>
    <header className="page-header"><div><Link to="/">Avello</Link><h1>{schedule?.role === "manager" ? "Location schedule" : "My schedule"}</h1><p>{schedule?.business.name ?? "Team workspace"}</p></div><button className="secondary-action" onClick={() => void signOut()}>Sign out</button></header>
    {error && <p role="alert" className="form-error">{error}</p>}
    {schedule?.role === "staff" && !schedule.staff && <section className="panel"><h2>No scheduling profile linked yet</h2><p>Your account has staff access. Ask the business owner to create a staff profile using your verified email address.</p></section>}
    {(schedule?.staff || schedule?.role === "manager") && <section className="panel table-panel"><h2>{schedule.role === "manager" ? "Appointments at your locations" : `${schedule.staff?.display_name}’s upcoming appointments`}</h2>
      {schedule.sessions.length === 0 ? <p>No assigned appointments in the current schedule.</p> : schedule.sessions.map((session) => <div className="appointment-row" key={session.id}>
        <time>{dateTime(session.starts_at)}</time><div><b>{schedule.services.find((service) => service.id === session.primary_service_id)?.name ?? "Appointment"}</b>
        <small>{schedule.role === "manager" ? `${session.appointments.length} booking${session.appointments.length === 1 ? "" : "s"}` : session.appointments.map((appointment) => schedule.customers.find((customer) => customer.id === appointment.customer_id)?.full_name ?? "Guest").join(", ")}</small></div>
        <span>{session.appointments.map((appointment) => appointment.status).join(", ")}</span>
      </div>)}</section>}
  </main>;
}
