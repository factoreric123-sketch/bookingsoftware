import { pageHead } from "../lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CalendarDays, Check, Clock3, Loader2, MapPin, Palette, Rocket, Sparkles } from "lucide-react";
import { invokeBackend } from "../integrations/supabase/backend";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/onboarding")({ head: () => pageHead("Avello \u2014 Set up your business", "Set up your business, services, hours, and booking page in Avello."), component: Onboarding });

const stepDefinitions = [
  { label: "Business", icon: BriefcaseBusiness },
  { label: "Operations", icon: Clock3 },
  { label: "Services", icon: Sparkles },
  { label: "Calendar", icon: CalendarDays },
  { label: "Booking page", icon: Palette },
  { label: "Publish", icon: Rocket },
];
const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type ProvisionResult = { organization_id: string; business_id: string; location_id: string; staff_id: string; booking_page_id: string };

function Onboarding() {
  const navigate = useNavigate();
  const [bookingHost, setBookingHost] = useState("");
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());
  const [business, setBusiness] = useState({
    name: "",
    slug: "",
    industry: "",
    email: user?.email ?? "",
    phone: "",
    address: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
    currency: "USD",
    accent: "#6d5dfc",
  });
  const [hours, setHours] = useState(() => dayNames.map((day, index) => ({ day, open: "09:00", close: "17:00", enabled: index < 5 })));
  const [service, setService] = useState({ name: "Initial consultation", description: "A focused session to understand what you need.", duration: 60, price: 100, color: "#6d5dfc" });

  useEffect(() => { setBookingHost(window.location.host); }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
    if (user && !business.email) setBusiness((current) => ({ ...current, email: user.email ?? "" }));
  }, [authLoading, business.email, navigate, user]);

  useEffect(() => {
    if (!user) return;
    supabase.from("business_members").select("id", { count: "exact", head: true }).eq("active", true).then(({ count }) => {
      if (count) navigate({ to: "/app", replace: true });
    });
  }, [navigate, user]);

  const valid = useMemo(() => {
    if (step === 0) return Boolean(business.name.trim() && business.slug.trim() && business.industry);
    if (step === 1) return hours.every((item) => !item.enabled || item.open < item.close);
    if (step === 2) return Boolean(service.name.trim() && service.duration >= 5 && service.price >= 0);
    return true;
  }, [business, hours, service, step]);

  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      const provisioned = await invokeBackend<ProvisionResult>("provision_business", {
        p_organization_id: null,
        p_organization_name: business.name.trim(),
        p_business_name: business.name.trim(),
        p_business_slug: business.slug.trim(),
        p_industry: business.industry,
        p_timezone: business.timezone,
        p_currency: business.currency,
        p_location_name: "Main location",
        p_request_key: requestKey,
      });
      await invokeBackend("complete_onboarding", {
        p_business_id: provisioned.business_id,
        p_location_id: provisioned.location_id,
        p_staff_id: provisioned.staff_id,
        p_business: { email: business.email.trim(), phone: business.phone.trim(), address: business.address.trim(), accent: business.accent },
        p_hours: hours.map((item, index) => ({ iso_weekday: index + 1, opens_at: item.open, closes_at: item.close, active: item.enabled })),
        p_service: {
          name: service.name.trim(),
          description: service.description.trim(),
          duration_minutes: service.duration,
          price_minor: Math.round(service.price * 100),
          currency: business.currency,
          color: service.color,
        },
      });
      // Provisioning creates the first membership after the app store's initial load.
      // Reload so the dashboard starts with a fresh membership and workspace snapshot.
      window.location.assign("/app");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace setup failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    setError("");
    if (step === stepDefinitions.length - 1) void finish();
    else setStep((current) => current + 1);
  };

  if (authLoading || !user) return <div className="app-loading">Loading secure setup…</div>;

  return <div className="onboarding-page">
    <aside>
      <div className="onboard-logo"><span>A</span>Avello</div>
      <p>Set up your business</p>
      <nav>{stepDefinitions.map(({ label, icon: Icon }, index) => <button className={index === step ? "active" : index < step ? "done" : ""} key={label} onClick={() => index < step && setStep(index)}><i>{index < step ? <Check size={15}/> : <Icon size={16}/>}</i><span>{label}</span></button>)}</nav>
      <small>Step {step + 1} of {stepDefinitions.length}</small>
    </aside>
    <main><div className="onboard-card">
      <div className="onboard-progress"><i style={{ width: `${((step + 1) / stepDefinitions.length) * 100}%` }}/></div>
      {step === 0 && <Step title="Tell us about your business" copy="This creates your secure organization, business, location, owner membership, and booking page.">
        <label>Business name<input value={business.name} onChange={(event) => { const name = event.target.value; setBusiness({ ...business, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") }); }} placeholder="Northstar Studio"/></label>
        <label>Industry<select value={business.industry} onChange={(event) => setBusiness({ ...business, industry: event.target.value })}><option value="">Choose an industry</option><option>Health & wellness</option><option>Beauty & personal care</option><option>Home services</option><option>Automotive</option><option>Professional services</option><option>Education</option><option>Other</option></select></label>
        <div className="field-pair"><label>Email<input type="email" value={business.email} onChange={(event) => setBusiness({ ...business, email: event.target.value })}/></label><label>Phone<input value={business.phone} onChange={(event) => setBusiness({ ...business, phone: event.target.value })}/></label></div>
        <label>Address<div className="icon-input"><MapPin size={16}/><input value={business.address} onChange={(event) => setBusiness({ ...business, address: event.target.value })}/></div></label>
      </Step>}
      {step === 1 && <Step title="When are you open?" copy="These hours become authoritative availability for your first location and owner calendar.">
        <div className="hours-list">{hours.map((item, index) => <div key={item.day}><label className="switch"><input type="checkbox" checked={item.enabled} onChange={(event) => setHours(hours.map((entry, entryIndex) => entryIndex === index ? { ...entry, enabled: event.target.checked } : entry))}/><i/></label><b>{item.day}</b>{item.enabled ? <><input type="time" value={item.open} onChange={(event) => setHours(hours.map((entry, entryIndex) => entryIndex === index ? { ...entry, open: event.target.value } : entry))}/><span>to</span><input type="time" value={item.close} onChange={(event) => setHours(hours.map((entry, entryIndex) => entryIndex === index ? { ...entry, close: event.target.value } : entry))}/></> : <em>Closed</em>}</div>)}</div>
      </Step>}
      {step === 2 && <Step title="Create your first service" copy="Pricing is stored in exact minor currency units and assigned to your first location and staff member.">
        <label>Service name<input value={service.name} onChange={(event) => setService({ ...service, name: event.target.value })}/></label>
        <label>Description<textarea value={service.description} onChange={(event) => setService({ ...service, description: event.target.value })}/></label>
        <div className="field-pair"><label>Duration<select value={service.duration} onChange={(event) => setService({ ...service, duration: Number(event.target.value) })}><option value={30}>30 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select></label><label>Price<input type="number" min="0" step="0.01" value={service.price} onChange={(event) => setService({ ...service, price: Number(event.target.value) })}/></label></div>
      </Step>}
      {step === 3 && <Step title="Choose your calendar" copy="The built-in Avello calendar works immediately. External calendars remain disabled until OAuth credentials are connected.">
        <div className="choice-cards"><button disabled><span className="google-cal">31</span><b>Google Calendar</b><small>Requires Google OAuth</small><em>Not configured</em></button><button disabled><span className="outlook-cal">O</span><b>Outlook Calendar</b><small>Requires Microsoft OAuth</small><em>Not configured</em></button><button className="selected"><span className="internal-cal"><CalendarDays size={22}/></span><b>Avello Calendar</b><small>Protected by database scheduling constraints</small><em><Check size={13}/>Selected</em></button></div>
      </Step>}
      {step === 4 && <Step title="Make it yours" copy="Choose the public URL and color customers will see.">
        <label>Booking page URL<div className="input-prefix"><span>{bookingHost}/book/</span><input value={business.slug} onChange={(event) => setBusiness({ ...business, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}/></div></label>
        <label>Brand color<div className="color-choice"><input type="color" value={business.accent} onChange={(event) => setBusiness({ ...business, accent: event.target.value })}/><span>{business.accent}</span></div></label>
        <div className="booking-mini-preview" style={{ "--brand": business.accent } as React.CSSProperties}><div><span>{business.name?.[0] || "B"}</span><b>{business.name || "Your business"}</b><small>{business.industry || "Your industry"}</small></div><button>Book an appointment</button></div>
      </Step>}
      {step === 5 && <Step title="Publish your workspace" copy="This final step writes your complete setup to Supabase and publishes the real booking page.">
        <div className="launch-card"><span><Rocket size={28}/></span><h3>{business.name}</h3><p>{bookingHost}/book/{business.slug}</p><ul><li><Check size={15}/>Secure organization and owner access</li><li><Check size={15}/>Location and operating hours</li><li><Check size={15}/>First service and staff assignment</li><li><Check size={15}/>Public booking page</li></ul></div>
      </Step>}
      {error && <div className="auth-error">{error}</div>}
      <div className="onboard-actions">{step > 0 ? <button className="back-action" disabled={saving} onClick={() => setStep(step - 1)}><ArrowLeft size={16}/>Back</button> : <span/>}<button className="solid-action" disabled={!valid || saving} onClick={next}>{saving ? <><Loader2 className="spin" size={16}/>Creating workspace…</> : <>{step === 5 ? "Publish and open dashboard" : "Continue"}<ArrowRight size={16}/></>}</button></div>
    </div></main>
  </div>;
}

function Step({ title, copy, children }: { title: string; copy: string; children: React.ReactNode }) {
  return <div className="onboard-step"><span className="step-kicker">SECURE SETUP</span><h1>{title}</h1><p>{copy}</p><div className="onboard-fields">{children}</div></div>;
}
