import { pageHead } from "../lib/page-head";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  FormInput,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  Mail,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  PhoneCall,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { availableSlots, useAppStore, type AppointmentStatus, type BusinessForm, type FormField, type PaymentMethod, type Staff } from "../lib/app-store";
import { businessDate, calendarWeekStart, shiftCalendarDate } from "../lib/business-date";
import { previewCustomerCsv, type CustomerImportRow } from "../lib/customer-csv";
import { useAuth } from "../lib/auth-context";
import { invokeBackend } from "../integrations/supabase/backend";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/app")({ head: () => pageHead("Avello \u2014 Business workspace", "Manage your Avello appointments, customers, team, payments, and business analytics."), component: Dashboard });
type Section =
  | "Overview"
  | "Calendar"
  | "Bookings"
  | "Booking Page"
  | "Customers"
  | "Services"
  | "Team"
  | "Messages"
  | "Phone & AI"
  | "Forms"
  | "Automations"
  | "Payments"
  | "Analytics"
  | "Integrations"
  | "Settings";

const navigation: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Calendar", icon: CalendarDays },
  { label: "Bookings", icon: Clock3 },
  { label: "Booking Page", icon: ExternalLink },
  { label: "Customers", icon: Users },
  { label: "Services", icon: Sparkles },
  { label: "Team", icon: UserPlus },
  { label: "Messages", icon: MessageSquareText },
  { label: "Phone & AI", icon: PhoneCall },
  { label: "Forms", icon: FormInput },
  { label: "Automations", icon: WandSparkles },
  { label: "Payments", icon: CreditCard },
  { label: "Analytics", icon: Activity },
  { label: "Integrations", icon: Link2 },
  { label: "Settings", icon: Settings },
];

function Dashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { workspace, businessChoices, switchBusiness, isPreview, isLoading, loadError } = useAppStore();
  const [switchError, setSwitchError] = useState("");
  const accountName = typeof user?.user_metadata?.["full_name"] === "string" && user.user_metadata["full_name"].trim()
    ? user.user_metadata["full_name"].trim() : user?.email ?? "Account";
  const [section, setSection] = useState<Section>("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasMembership, setHasMembership] = useState<boolean | null>(null);
  const canView = (label: Section) => {
    if (workspace.memberRole === "owner") return true;
    const permission = workspace.memberPermissions;
    if (["Calendar", "Bookings", "Customers"].includes(label)) return permission["can_manage_customers"] === true;
    if (label === "Services") return permission["can_manage_services"] === true;
    if (label === "Team") return permission["can_manage_staff"] === true;
    if (label === "Messages") return permission["can_manage_messages"] === true;
    if (label === "Forms") return permission["can_manage_forms"] === true;
    if (label === "Automations") return permission["can_manage_automations"] === true;
    if (label === "Payments") return permission["can_manage_billing"] === true;
    if (label === "Analytics") return permission["can_view_analytics"] === true;
    return label === "Booking Page";
  };
  const visibleNavigation = navigation.filter((item) => canView(item.label));
  useEffect(() => {
    if (workspace.business.id && !canView(section)) setSection(visibleNavigation[0]?.label ?? "Booking Page");
  }, [section, workspace.business.id, workspace.memberRole, workspace.memberPermissions]);
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
  }, [authLoading, navigate, user]);
  useEffect(() => {
    if (!authLoading && user && !isLoading && !workspace.business.id) {
      void supabase.from("business_members").select("role,all_locations").eq("active", true).order("created_at").limit(1)
        .then(({ data, error }) => {
          if (error) { setHasMembership(true); return; }
          if (data?.[0]?.role === "staff" || (data?.[0]?.role === "manager" && !data[0].all_locations)) void navigate({ to: "/staff", replace: true });
          else if (!data?.length) void navigate({ to: "/onboarding", replace: true });
          else setHasMembership(true);
        });
    }
  }, [authLoading, isLoading, navigate, user, workspace.business.id]);
  if (authLoading || !user || isLoading)
    return <div className="app-loading" role="status">Loading your workspace…</div>;
  if (!workspace.business.id) return <main className="dashboard-content" style={{ maxWidth: 760, margin: "auto" }}>
    {hasMembership ? <section className="panel"><h1>Workspace unavailable</h1><p>{loadError || "This account has a membership, but the full dashboard could not load."}</p></section> : <p>Checking your workspace access…</p>}
  </main>;
  return (
    <div className="app-layout">
      <aside className={mobileOpen ? "app-sidebar mobile-open" : "app-sidebar"}>
        <div className="app-logo">
          <span className="avello-logo">A</span>
          <b>Avello</b>
          <button aria-label="Close navigation" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="business-switch">
          <span className="business-avatar">N</span>
          <span>
            {businessChoices.length > 1 ? <select aria-label="Current business" value={workspace.business.id} onChange={(event) => { setSwitchError(""); void switchBusiness(event.target.value).catch((caught) => setSwitchError(caught instanceof Error ? caught.message : "Business could not be loaded.")); }}>{businessChoices.map((business) => <option key={business.id} value={business.id}>{business.name} · {business.role}</option>)}</select> : <b>{workspace.business.name}</b>}
            <small>Business workspace</small>
          </span>
        </div>
        {switchError && <p className="booking-error" role="alert">{switchError}</p>}
        <nav>
          {visibleNavigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={section === label ? "active" : ""}
              onClick={() => {
                setSection(label);
                setMobileOpen(false);
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => void signOut()}>
            <LogOut size={18} />
            Sign out
          </button>
          <div className="user-chip">
            <span>{initials(accountName)}</span>
            <div>
              <b>{accountName}</b>
              <small>{user.email}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button className="app-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="top-actions">
            <Link
              to="/book/$slug"
              params={{ slug: workspace.business.slug }}
              target="_blank"
              className="view-booking"
            >
              <ExternalLink size={15} /> Booking page
            </Link>
            <span className="top-avatar">{initials(accountName)}</span>
          </div>
        </header>
        {isPreview && (
          <div className="preview-banner">
            <Sparkles size={14} />
            <span>
              <b>Preview workspace</b> — changes are saved in this browser until the production
              Supabase schema is created in Lovable.
            </span>
          </div>
        )}
        <main className="dashboard-content">
          <SectionView section={canView(section) ? section : visibleNavigation[0]?.label ?? "Booking Page"} onNavigate={(target) => { if (canView(target)) setSection(target); }} />
        </main>
      </div>
    </div>
  );
}

function SectionView({
  section,
  onNavigate,
}: {
  section: Section;
  onNavigate: (section: Section) => void;
}) {
  if (section === "Overview") return <Overview onNavigate={onNavigate} />;
  if (section === "Calendar") return <CalendarWorkspace />;
  if (section === "Bookings") return <Bookings title={section} />;
  if (section === "Booking Page") return <BookingTools />;
  if (section === "Customers") return <Customers />;
  if (section === "Services") return <Services />;
  if (section === "Team") return <Team />;
  if (section === "Integrations") return <Integrations />;
  if (section === "Messages") return <Messages />;
  if (section === "Phone & AI") return <PhoneAi />;
  if (section === "Forms") return <Forms />;
  if (section === "Automations") return <Automations />;
  if (section === "Payments") return <Payments />;
  if (section === "Analytics") return <Analytics />;
  if (section === "Settings") return <BusinessSettings />;
  return <ComingSoon section={section} />;
}

function PageHeader({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow?: string;
  title: string;
  copy: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function Overview({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const { workspace } = useAppStore();
  const today = businessDate(workspace.business.timezone);
  const todays = workspace.appointments.filter(
    (item) => item.date === today && item.status !== "cancelled",
  );
  const revenue = workspace.appointments
    .filter((item) => item.status !== "cancelled")
    .reduce(
      (sum, item) =>
        sum + (item.bookedTotal ?? workspace.services.find((service) => service.id === item.serviceId)?.price ?? 0),
      0,
    );
  const chart = Array.from({ length: 7 }, (_, offset) => {
    const date = shiftCalendarDate(today, offset - 6);
    const value = new Date(`${date}T12:00:00Z`);
    return {
      day: value.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
      bookings: workspace.appointments.filter(
        (appointment) => appointment.date === date && appointment.status !== "cancelled",
      ).length,
    };
  });
  const completedSetup = [Boolean(workspace.business.name), workspace.services.length > 0, Object.values(workspace.business.hours).some((item) => item.enabled), workspace.staff.length > 0, Boolean(workspace.business.slug)].filter(Boolean).length;
  const activeAppointments = workspace.appointments.filter((item) => item.status !== "cancelled");
  const revenueLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: workspace.business.currency ?? "USD", maximumFractionDigits: 2 }).format(revenue);
  const bookingRate = activeAppointments.length ? `${Math.round((activeAppointments.filter((item) => item.status === "confirmed" || item.status === "completed").length / activeAppointments.length) * 100)}%` : "—";
  const setupItems = [
    { label: "Business profile", done: Boolean(workspace.business.name), section: "Settings" as Section },
    { label: "Create your first service", done: workspace.services.length > 0, section: "Services" as Section },
    { label: "Set your availability", done: Object.values(workspace.business.hours).some((item) => item.enabled), section: "Calendar" as Section },
    { label: "Add a team member", done: workspace.staff.length > 0, section: "Team" as Section },
    { label: "Publish booking page", done: Boolean(workspace.business.slug), section: "Booking Page" as Section },
  ];
  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", { timeZone: workspace.business.timezone, weekday: "long", month: "long", day: "numeric" }).toUpperCase()}
        title={`Welcome to ${workspace.business.name}`}
        copy="Here’s what’s happening across your business today."
        action={
          <button className="solid-action" onClick={() => onNavigate("Bookings")}>
            <Plus size={16} />
            New booking
          </button>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Today’s bookings"
          value={String(todays.length)}
          trend="Current business timezone"
          icon={CalendarDays}
        />
        <Metric
          label="Customers"
          value={String(workspace.customers.length)}
          trend="Authorized customer records"
          icon={Users}
        />
        <Metric
          label="Booked revenue"
          value={revenueLabel}
          trend="Across loaded active appointments"
          icon={CircleDollarSign}
        />
        <Metric label="Confirmation rate" value={bookingRate} trend={activeAppointments.length ? "Across active bookings" : "No booking data yet"} icon={Activity} />
      </div>
      <div className="overview-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Booking activity</h2>
              <p>Active bookings over the last 7 days</p>
            </div>
            <span className="date-filter">Last 7 days</span>
          </div>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="bookingFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#6d5dfc" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#6d5dfc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ececf2" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={11} />
                <YAxis axisLine={false} tickLine={false} fontSize={11} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="bookings"
                  stroke="#6d5dfc"
                  strokeWidth={2.5}
                  fill="url(#bookingFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel today-panel">
          <div className="panel-heading">
            <div>
              <h2>Today’s schedule</h2>
              <p>{todays.length} appointments</p>
            </div>
            <button onClick={() => onNavigate("Calendar")}>View calendar</button>
          </div>
          {todays.map((item) => (
            <AppointmentRow key={item.id} id={item.id} />
          ))}
        </section>
      </div>
      <div className="overview-grid lower">
        <section className="panel setup-panel">
          <div className="panel-heading">
            <div>
              <h2>Finish setting up Avello</h2>
              <p>Complete these steps to start accepting bookings.</p>
            </div>
            <b>{completedSetup} of 5</b>
          </div>
          <div className="progress-track">
            <i style={{ width: `${completedSetup * 20}%` }} />
          </div>
          {setupItems.map((item, index) => (
            <button
              className={item.done ? "setup-row done" : "setup-row"}
              key={item.label}
              onClick={() => onNavigate(item.section)}
            >
              <span>{item.done ? <Check size={13} /> : index + 1}</span>
              {item.label}
              <ChevronDown size={14} />
            </button>
          ))}
        </section>
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Quick actions</h2>
              <p>Common tasks, one click away.</p>
            </div>
          </div>
          <div className="quick-grid">
            <Quick icon={Plus} label="New booking" onClick={() => onNavigate("Bookings")} />
            <Quick icon={Users} label="Add customer" onClick={() => onNavigate("Customers")} />
            <Quick icon={Sparkles} label="Create service" onClick={() => onNavigate("Services")} />
            <Quick
              icon={Copy}
              label="Share booking link"
              onClick={() =>
                navigator.clipboard?.writeText(`${location.origin}/book/${workspace.business.slug}`)
              }
            />
          </div>
        </section>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string;
  trend: string;
  icon: typeof CalendarDays;
}) {
  return (
    <div className="metric-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{trend}</small>
      </div>
      <i>
        <Icon size={19} />
      </i>
    </div>
  );
}
function Quick({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <Icon size={19} />
      <span>{label}</span>
    </button>
  );
}
function AppointmentRow({ id }: { id: string }) {
  const { workspace } = useAppStore();
  const appointment = workspace.appointments.find((item) => item.id === id);
  if (!appointment) return null;
  const customer = workspace.customers.find((item) => item.id === appointment.customerId);
  const service = workspace.services.find((item) => item.id === appointment.serviceId);
  return (
    <div className="appointment-row">
      <time>{prettyTime(appointment.time)}</time>
      <i style={{ background: service?.color }} />
      <div>
        <b>{customer?.name}</b>
        <small>
          {service?.name} · {appointment.duration} min
        </small>
      </div>
      <span className={`status ${appointment.status}`}>{appointment.status}</span>
    </div>
  );
}

function CalendarWorkspace() {
  const { workspace, addBlockedTime, removeBlockedTime } = useAppStore();
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [weekStart, setWeekStart] = useState(() => calendarWeekStart(businessDate(workspace.business.timezone)));
  const [form, setForm] = useState({
    staffId: "",
    date: businessDate(workspace.business.timezone),
    start: "12:00",
    end: "13:00",
    reason: "Unavailable",
  });
  const days = Array.from({ length: 7 }, (_, index) => {
    return shiftCalendarDate(weekStart, index);
  });
  const moveWeek = (offset: number) => setWeekStart((current) => shiftCalendarDate(current, offset * 7));
  const weekLabel = `${new Date(`${days[0]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${new Date(`${days[6]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const save = async () => {
    const result = await addBlockedTime(form);
    if (result.error) {
      setError(result.error);
      return;
    }
    setError("");
    setShow(false);
  };
  const removeBlock = async (id: string) => {
    setError("");
    try {
      await removeBlockedTime(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Blocked time could not be removed.");
    }
  };
  return (
    <>
      <PageHeader
        title="Calendar"
        copy="See team schedules and protect unavailable time from every booking channel."
        action={
          <button className="solid-action" onClick={() => setShow(true)}>
            <Plus size={16} />
            Block time
          </button>
        }
      />
      <div className="calendar-toolbar">
        <button className="secondary-action" onClick={() => setWeekStart(calendarWeekStart(businessDate(workspace.business.timezone)))}>Today</button>
        <div>
          <button onClick={() => moveWeek(-1)}>‹</button>
          <b>{weekLabel}</b>
          <button onClick={() => moveWeek(1)}>›</button>
        </div>
        <span>Week view</span>
      </div>
      {error && <div className="booking-error" role="alert">{error}</div>}
      <div className="team-calendar panel">
        <div className="calendar-head">
          <span>Team member</span>
          {days.map((day) => (
            <div key={day}>
              <small>
                {new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" })}
              </small>
              <b>{new Date(`${day}T12:00:00`).getDate()}</b>
            </div>
          ))}
        </div>
        {workspace.staff
          .filter((member) => member.active)
          .map((member) => (
            <div className="calendar-staff-row" key={member.id}>
              <div className="calendar-person">
                <i>{initials(member.name)}</i>
                <span>
                  <b>{member.name}</b>
                  <small>{member.role}</small>
                </span>
              </div>
              {days.map((day) => {
                const appointments = workspace.appointments.filter(
                  (item) =>
                    item.staffId === member.id && item.date === day && item.status !== "cancelled",
                );
                const blocks = workspace.blockedTimes.filter(
                  (item) => (!item.staffId || item.staffId === member.id) && item.date === day,
                );
                return (
                  <div className="calendar-day" key={day}>
                    {appointments.map((item) => (
                      <span
                        className="calendar-event"
                        key={item.id}
                        style={{
                          borderColor: workspace.services.find(
                            (service) => service.id === item.serviceId,
                          )?.color,
                        }}
                      >
                        <b>{prettyTime(item.time)}</b>
                        <small>
                          {
                            workspace.services.find((service) => service.id === item.serviceId)
                              ?.name
                          }
                        </small>
                      </span>
                    ))}
                    {blocks.map((item) => (
                      <span className="calendar-block" key={item.id}>
                        <b>
                          {prettyTime(item.start)}–{prettyTime(item.end)}
                        </b>
                        <small>{item.reason}</small>
                        <button
                          aria-label={`Remove ${item.reason}`}
                          onClick={() => void removeBlock(item.id)}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
      </div>
      <div className="panel block-list">
        <div className="panel-heading">
          <div>
            <h2>Blocked time</h2>
            <p>These periods are excluded from public, dashboard, and AI availability.</p>
          </div>
          <b>{workspace.blockedTimes.length} blocks</b>
        </div>
        {workspace.blockedTimes.length === 0 ? (
          <p className="block-empty">No time is currently blocked.</p>
        ) : (
          [...workspace.blockedTimes]
            .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
            .map((item) => (
              <div className="block-row" key={item.id}>
                <span>
                  <Clock3 size={15} />
                </span>
                <div>
                  <b>{item.reason}</b>
                  <small>
                    {workspace.staff.find((member) => member.id === item.staffId)?.name ??
                      "All team members"}{" "}
                    · {formatDate(item.date)} · {prettyTime(item.start)}–{prettyTime(item.end)}
                  </small>
                </div>
                <button onClick={() => void removeBlock(item.id)}>Remove</button>
              </div>
            ))
        )}
      </div>
      {show && (
        <Modal title="Block unavailable time" onClose={() => setShow(false)}>
          <label>
            Team member
            <select
              value={form.staffId}
              onChange={(event) => setForm({ ...form, staffId: event.target.value })}
            >
              <option value="">All team members</option>
              {workspace.staff
                .filter((member) => member.active)
                .map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Reason
            <input
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              placeholder="Vacation, lunch, personal time"
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </label>
          <div className="field-pair">
            <label>
              Starts
              <input
                type="time"
                value={form.start}
                onChange={(event) => setForm({ ...form, start: event.target.value })}
              />
            </label>
            <label>
              Ends
              <input
                type="time"
                value={form.end}
                onChange={(event) => setForm({ ...form, end: event.target.value })}
              />
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button
            className="solid-action full"
            disabled={!form.reason || !form.date}
            onClick={save}
          >
            Block this time
          </button>
        </Modal>
      )}
    </>
  );
}

function Bookings({ title }: { title: string }) {
  const { workspace, addAppointment, updateAppointment, rescheduleAppointment } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("month");
  const [reschedulingId, setReschedulingId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const changeStatus = async (id: string, status: AppointmentStatus) => {
    setError("");
    setUpdatingId(id);
    try {
      await updateAppointment(id, { status });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Appointment status could not be saved.");
    } finally {
      setUpdatingId("");
    }
  };
  const [form, setForm] = useState({
    customerId: workspace.customers[0]?.id ?? "",
    serviceId: workspace.services[0]?.id ?? "",
    staffId: workspace.staff[0]?.id ?? "",
    date: businessDate(workspace.business.timezone),
    time: "09:00",
  });
  const submit = async () => {
    const service = workspace.services.find((s) => s.id === form.serviceId);
    if (!service) return;
    setSubmitting(true); setError("");
    try {
      const result = await addAppointment({ ...form, duration: service.duration, status: "confirmed", source: "dashboard" });
      if (result.error) setError(result.error);
      else { setShowForm(false); setError(result.warning ?? ""); }
    } finally { setSubmitting(false); }
  };
  const selectedReschedule = workspace.appointments.find((item) => item.id === reschedulingId);
  const monthParts = new Intl.DateTimeFormat("en-US", { timeZone: workspace.business.timezone, year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const currentMonth = `${monthParts.find((part) => part.type === "year")?.value}-${monthParts.find((part) => part.type === "month")?.value}`;
  const visibleAppointments = workspace.appointments.filter((item) => {
    const customer = workspace.customers.find((entry) => entry.id === item.customerId);
    const service = workspace.services.find((entry) => entry.id === item.serviceId);
    const matchesSearch = `${customer?.name ?? ""} ${customer?.email ?? ""} ${service?.name ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesDate = dateFilter === "all" || item.date.slice(0, 7) === currentMonth;
    return matchesSearch && matchesStatus && matchesDate;
  });
  const saveReschedule = async () => {
    if (!selectedReschedule?.rowVersion || !rescheduleDate || !rescheduleTime) return;
    setRescheduling(true); setError("");
    try {
      await rescheduleAppointment(selectedReschedule.id, rescheduleDate, rescheduleTime, selectedReschedule.rowVersion);
      setReschedulingId("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Appointment could not be rescheduled.";
      setError(message);
      if (message.startsWith("Reschedule outcome")) setReschedulingId("");
    } finally { setRescheduling(false); }
  };
  return (
    <>
      <PageHeader
        title={title}
        copy="Manage every appointment from one reliable schedule."
        action={
          <button className="solid-action" onClick={() => setShowForm(true)}>
            <Plus size={16} />
            New booking
          </button>
        }
      />
      {error && !showForm && <div className="booking-error" role="alert">{error}</div>}
      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search bookings…" />
          </div>
          <select aria-label="Filter booking status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no-show">No-show</option></select>
          <select aria-label="Filter booking date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}><option value="month">This month</option><option value="all">All dates</option></select>
        </div>
        <div className="data-table">
          <div className="data-row header">
            <span>Date & time</span>
            <span>Customer</span>
            <span>Service & staff</span>
            <span>Status</span>
            <span>Source</span>
            <span />
          </div>
          {[...visibleAppointments]
            .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
            .map((item) => {
              const customer = workspace.customers.find((c) => c.id === item.customerId);
              const service = workspace.services.find((s) => s.id === item.serviceId);
              const staff = workspace.staff.find((member) => member.id === item.staffId);
              return (
                <div className="data-row" key={item.id}>
                  <span>
                    <b>{formatDate(item.date)}</b>
                    <small>
                      {prettyTime(item.time)} · {item.duration} min
                    </small>
                  </span>
                  <span>
                    <b>{customer?.name}</b>
                    <small>{customer?.email}</small>
                  </span>
                  <span>
                    <b>{service?.name}</b>
                    <small>{staff?.name ?? "Unassigned"}</small>
                  </span>
                  <span>
                    <select
                      value={item.status}
                      disabled={updatingId === item.id || item.status === "cancelled"}
                      onChange={(e) => void changeStatus(item.id, e.target.value as AppointmentStatus)}
                      className={`status-select ${item.status}`}
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled" disabled={item.status !== "pending" && item.status !== "confirmed" && item.status !== "cancelled"}>Cancelled</option>
                      <option value="no-show">No-show</option>
                    </select>
                  </span>
                  <span>{item.source === "booking-page" ? "Booking page" : "Dashboard"}</span>
                  <button disabled={(item.status !== "pending" && item.status !== "confirmed") || !item.rowVersion} onClick={() => { setReschedulingId(item.id); setRescheduleDate(item.date); setRescheduleTime(item.time); setError(""); }}>
                    Reschedule
                  </button>
                </div>
              );
            })}
        </div>
      </div>
      {showForm && (
        <Modal title="Create booking" onClose={() => setShowForm(false)}>
          <label>
            Customer
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              {workspace.customers.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-pair">
            <label>
              Service
              <select
                value={form.serviceId}
                onChange={(e) => {
                  const serviceId = e.target.value;
                  const eligible = workspace.staff.find(
                    (member) => member.active && member.serviceIds.includes(serviceId),
                  );
                  setForm({ ...form, serviceId, staffId: eligible?.id ?? "" });
                }}
              >
                {workspace.services
                  .filter((s) => s.active)
                  .map((s) => (
                    <option value={s.id} key={s.id}>
                      {s.name} · ${s.price}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Team member
              <select
                value={form.staffId}
                onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              >
                {workspace.staff
                  .filter((member) => member.active && member.serviceIds.includes(form.serviceId))
                  .map((member) => (
                    <option value={member.id} key={member.id}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="field-pair">
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              Time
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
            </label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="solid-action full" onClick={submit} disabled={submitting || !form.customerId || !form.serviceId || !form.staffId || !form.date || !form.time}>
            {submitting ? "Creating…" : "Create booking"}
          </button>
        </Modal>
      )}
      {selectedReschedule && <Modal title="Reschedule appointment" onClose={() => { if (!rescheduling) setReschedulingId(""); }}>
        <p>Choose a new time for {workspace.customers.find((customer) => customer.id === selectedReschedule.customerId)?.name ?? "this customer"}. The current booking stays in place if the new time is unavailable.</p>
        <div className="field-pair">
          <label>Date<input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} /></label>
          <label>Time<input type="time" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="solid-action full" onClick={saveReschedule} disabled={rescheduling || !rescheduleDate || !rescheduleTime || (rescheduleDate === selectedReschedule.date && rescheduleTime === selectedReschedule.time)}>{rescheduling ? "Rescheduling…" : "Save new time"}</button>
      </Modal>}
    </>
  );
}

function Customers() {
  const { workspace, addCustomer, updateCustomer, mergeCustomer } = useAppStore();
  const [show, setShow] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState<CustomerImportRow[]>([]);
  const [importError, setImportError] = useState("");
  const [importSummary, setImportSummary] = useState("");
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "", tags: ["New"] });
  const selected = workspace.customers.find((customer) => customer.id === selectedId);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", notes: "", tags: "" });
  const [profileError, setProfileError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [mergeDestinationId, setMergeDestinationId] = useState("");
  const [mergeConfirmed, setMergeConfirmed] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeNotice, setMergeNotice] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const filtered = workspace.customers.filter((customer) =>
    `${customer.name} ${customer.email} ${customer.phone} ${customer.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const save = async () => {
    if (!form.name || !form.email) return;
    setCreating(true);
    setCreateError("");
    try {
      await addCustomer(form);
      setShow(false);
      setForm({ name: "", email: "", phone: "", notes: "", tags: ["New"] });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Customer could not be saved.";
      setCreateError(message);
      if (message.startsWith("Customer was created,")) setShow(false);
    } finally {
      setCreating(false);
    }
  };
  const openProfile = (id: string) => {
    const customer = workspace.customers.find((item) => item.id === id);
    if (!customer) return;
    setDraft({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      notes: customer.notes,
      tags: customer.tags.join(", "),
    });
    setSelectedId(id);
    setProfileError("");
    setMergeDestinationId("");
    setMergeConfirmed(false);
  };
  const mergeProfile = async () => {
    if (!selected || !mergeDestinationId || !mergeConfirmed) return;
    setMerging(true);
    setProfileError("");
    try {
      await mergeCustomer(selected.id, mergeDestinationId);
      setSelectedId("");
      setMergeNotice("Customer records merged. Related history now belongs to the destination customer.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Customer merge failed.";
      if (message.startsWith("Merge outcome")) { setSelectedId(""); setMergeNotice(message); }
      else setProfileError(message);
    } finally {
      setMerging(false);
    }
  };
  const saveProfile = async () => {
    if (!selected || !draft.name) return;
    setSavingProfile(true);
    setProfileError("");
    try {
      await updateCustomer(selected.id, {
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
      notes: draft.notes,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      });
      setSelectedId("");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to save customer profile.");
    } finally {
      setSavingProfile(false);
    }
  };
  const exportCsv = () => {
    const quote = (value: string | number) => {
      const text = String(value);
      const safe = typeof value === "string" && /^\s*[=+@-]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["Name", "Email", "Phone", "Tags", "Created", "Appointments", "Booked value", "Collected"],
      ...workspace.customers.map((customer) => {
        const appointments = workspace.appointments.filter(
          (item) => item.customerId === customer.id,
        );
        return [
          customer.name,
          customer.email,
          customer.phone,
          customer.tags.join(" | "),
          customer.createdAt,
          appointments.length,
          appointments.reduce(
            (sum, item) =>
              sum + (item.status === "cancelled" ? 0 : item.bookedTotal ?? 0),
            0,
          ),
          workspace.invoices
            .filter((invoice) => invoice.customerId === customer.id)
            .reduce((sum, invoice) => sum + invoice.paid, 0),
        ];
      }),
    ];
    const blob = new Blob([rows.map((row) => row.map(quote).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `avello-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const previewImport = async (file?: File) => {
    setImportRows([]);
    setImportError("");
    setImportSummary("");
    if (!file) return;
    if (file.size > 2_000_000) { setImportError("Choose a CSV smaller than 2 MB."); return; }
    try {
      const rows = previewCustomerCsv(await file.text(), workspace.customers.map((customer) => customer.email));
      setImportRows(rows);
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : "The CSV could not be read.");
    }
  };
  const runImport = async () => {
    if (importing || !importRows.some((row) => row.status === "ready")) return;
    setImporting(true);
    setImportError("");
    let imported = 0;
    let warnings = 0;
    let failed = 0;
    for (const row of importRows.filter((item) => item.status === "ready")) {
      let status: CustomerImportRow["status"] = "imported";
      let detail = "Imported";
      try {
        await addCustomer({ name: row.name, email: row.email, phone: row.phone, notes: row.notes, tags: row.tags }, "import");
        imported += 1;
      } catch (caught) {
        detail = caught instanceof Error ? caught.message : "Import failed.";
        if (detail.startsWith("Customer was created,")) { status = "warning"; warnings += 1; }
        else { status = "failed"; failed += 1; }
      }
      setImportRows((current) => current.map((item) => item.line === row.line ? { ...item, status, detail } : item));
    }
    setImportSummary(`${imported} imported, ${warnings} imported with warnings, ${failed} failed. Skipped and invalid rows were not sent.`);
    setImporting(false);
  };
  const profileAppointments = selected
    ? workspace.appointments.filter((item) => item.customerId === selected.id)
    : [];
  const profileInvoices = selected
    ? workspace.invoices.filter((item) => item.customerId === selected.id)
    : [];
  const profileForms = selected
    ? workspace.formSubmissions.filter((item) => item.customerId === selected.id)
    : [];
  const timeline = [
    ...profileAppointments.map((item) => ({
      date: item.createdAt,
      label: `${item.status} appointment`,
      meta: `${workspace.services.find((service) => service.id === item.serviceId)?.name ?? "Service"} · ${formatDate(item.date)} at ${prettyTime(item.time)}`,
    })),
    ...profileInvoices.map((item) => ({
      date: item.createdAt,
      label: `Invoice ${item.status}`,
      meta: `${item.number} · $${item.amount.toLocaleString()}`,
    })),
    ...profileForms.map((item) => ({
      date: item.submittedAt,
      label: "Form submitted",
      meta: workspace.forms.find((form) => form.id === item.formId)?.name ?? "Form",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeader
        title="Customers"
        copy="Search, edit, and understand every customer relationship."
        action={
          <button className="solid-action" onClick={() => { setCreateError(""); setShow(true); }}>
            <Plus size={16} />
            Add customer
          </button>
        }
      />
      {createError && !show && <p className="form-error" role="alert">{createError}</p>}
      {mergeNotice && <p role="status">{mergeNotice}</p>}
      <div className="panel customer-panel">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, phone, or tag…"
            />
          </div>
          <span className="record-count">
            {filtered.length} of {workspace.customers.length}
          </span>
          <button onClick={exportCsv}>
            <FileText size={15} />
            Export CSV
          </button>
          <button onClick={() => { setImportRows([]); setImportError(""); setImportSummary(""); setShowImport(true); }}>
            <FileText size={15} />
            Import CSV
          </button>
        </div>
        <div className="customer-grid">
          {filtered.map((customer) => {
            const appointments = workspace.appointments.filter(
              (item) => item.customerId === customer.id,
            );
            const invoices = workspace.invoices.filter(
              (item) => item.customerId === customer.id,
            );
            return (
              <article className="customer-card" key={customer.id}>
                <div className="customer-head">
                  <span>{initials(customer.name)}</span>
                  <div>
                    <h3>{customer.name}</h3>
                    <p>{customer.email || "No email"}</p>
                  </div>
                  <button
                    aria-label={`Open ${customer.name}`}
                    onClick={() => openProfile(customer.id)}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                </div>
                <div className="tag-row">
                  {customer.tags.map((tag) => (
                    <i key={tag}>{tag}</i>
                  ))}
                </div>
                <dl>
                  <div>
                    <dt>Phone</dt>
                    <dd>{customer.phone || "—"}</dd>
                  </div>
                  <div>
                    <dt>Appointments</dt>
                    <dd>{appointments.length}</dd>
                  </div>
                  <div>
                    <dt>Collected</dt>
                    <dd>
                      ${invoices.reduce((sum, item) => sum + item.paid, 0).toLocaleString()}
                    </dd>
                  </div>
                </dl>
                <button className="profile-action" onClick={() => openProfile(customer.id)}>
                  View customer profile
                </button>
              </article>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="customer-empty">
            <Users size={25} />
            <b>No matching customers</b>
            <span>Try a different name, email, phone number, or tag.</span>
          </div>
        )}
      </div>
      {show && (
        <Modal title="Add customer" onClose={() => setShow(false)}>
          <label>
            Full name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Jordan Smith"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jordan@example.com"
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(555) 000-0000"
            />
          </label>
          <label>
            Internal notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          {createError && <p className="form-error" role="alert">{createError}</p>}
          <button className="solid-action full" onClick={save} disabled={creating || !form.name.trim() || !form.email.trim()}>
            {creating ? "Saving…" : "Save customer"}
          </button>
        </Modal>
      )}
      {showImport && (
        <Modal title="Import customers" wide onClose={() => { if (!importing) setShowImport(false); }}>
          <p>Choose a CSV with Name and Email columns. Phone, Tags, and Notes are optional. Separate tags with |. Preview the rows before importing; existing and repeated emails are skipped.</p>
          <label>Customer CSV<input type="file" accept=".csv,text/csv" disabled={importing} onChange={(event) => void previewImport(event.target.files?.[0])} /></label>
          {importError && <p className="form-error" role="alert">{importError}</p>}
          {importRows.length > 0 && <>
            <p role="status">{importRows.filter((row) => row.status === "ready").length} ready, {importRows.filter((row) => row.status === "skip").length} duplicates, {importRows.filter((row) => row.status === "invalid").length} invalid.</p>
            <div className="customer-import-preview">
              <table><thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Result</th></tr></thead><tbody>
                {importRows.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.name || "—"}</td><td>{row.email || "—"}</td><td>{row.detail}</td></tr>)}
              </tbody></table>
            </div>
            <button className="solid-action full" onClick={() => void runImport()} disabled={importing || !importRows.some((row) => row.status === "ready")}>{importing ? "Importing…" : `Import ${importRows.filter((row) => row.status === "ready").length} customers`}</button>
          </>}
          {importSummary && <p role="status">{importSummary}</p>}
        </Modal>
      )}
      {selected && (
        <Modal title="Customer profile" onClose={() => setSelectedId("")}>
          <div className="profile-identity">
            <span>{initials(selected.name)}</span>
            <div>
              <h3>{selected.name}</h3>
              <p>Customer since {new Date(selected.createdAt).toLocaleDateString()}</p>
            </div>
            <b>
              $
              {profileInvoices
                .reduce((sum, item) => sum + item.paid, 0)
                .toLocaleString()}{" "}
              collected
            </b>
          </div>
          <div className="field-pair">
            <label>
              Full name
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              />
            </label>
          </div>
          <label>
            Phone
            <input
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            />
          </label>
          <label>
            Tags
            <input
              value={draft.tags}
              onChange={(event) => setDraft({ ...draft, tags: event.target.value })}
              placeholder="VIP, Repeat"
            />
          </label>
          <label>
            Internal notes
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            />
          </label>
          <div className="customer-history">
            <h3>Activity timeline</h3>
            {timeline.length ? (
              timeline.map((item, index) => (
                <div key={`${item.date}-${index}`}>
                  <i />
                  <span>
                    <b>{item.label}</b>
                    <small>{item.meta}</small>
                  </span>
                  <time>{new Date(item.date).toLocaleDateString()}</time>
                </div>
              ))
            ) : (
              <p>No activity recorded yet.</p>
            )}
          </div>
          {profileError && <p role="alert" className="form-error">{profileError}</p>}
          <button className="solid-action full" onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save customer profile"}
          </button>
          {workspace.customers.length > 1 && <section className="customer-history">
            <h3>Merge duplicate customer</h3>
            <p>Move this customer's appointments, invoices, forms, notes, and other history into another customer record.</p>
            <label>Keep this customer
              <select value={mergeDestinationId} onChange={(event) => { setMergeDestinationId(event.target.value); setMergeConfirmed(false); }}>
                <option value="">Select destination</option>
                {workspace.customers.filter((customer) => customer.id !== selected.id).map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email || customer.phone}</option>)}
              </select>
            </label>
            <label><input type="checkbox" checked={mergeConfirmed} onChange={(event) => setMergeConfirmed(event.target.checked)} /> I understand this customer will be marked merged and its history moved.</label>
            <button className="secondary-action" onClick={mergeProfile} disabled={!mergeDestinationId || !mergeConfirmed || merging}>{merging ? "Merging…" : "Merge into selected customer"}</button>
          </section>}
        </Modal>
      )}
    </>
  );
}

function Services() {
  const { workspace, addService, updateService } = useAppStore();
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const changeVisibility = async (id: string, active: boolean) => {
    setError("");
    setUpdatingId(id);
    try {
      await updateService(id, { active });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Service visibility could not be saved.");
    } finally {
      setUpdatingId("");
    }
  };
  const [form, setForm] = useState({
    name: "",
    description: "",
    duration: 60,
    price: 100,
    bufferBefore: 0,
    bufferAfter: 0,
    appointmentType: "individual" as "individual" | "group",
    capacity: 1,
    color: "#6d5dfc",
    active: true,
  });
  const openCreate = () => {
    setEditingId("");
    setError("");
    setForm({ name: "", description: "", duration: 60, price: 100, bufferBefore: 0, bufferAfter: 0, appointmentType: "individual", capacity: 1, color: "#6d5dfc", active: true });
    setShow(true);
  };
  const openEdit = (service: (typeof workspace.services)[number]) => {
    setEditingId(service.id);
    setError("");
    setForm({ name: service.name, description: service.description, duration: service.duration, price: service.price, bufferBefore: service.bufferBefore ?? 0, bufferAfter: service.bufferAfter ?? 0, appointmentType: service.appointmentType ?? "individual", capacity: service.capacity ?? 1, color: service.color, active: service.active });
    setShow(true);
  };
  const save = async () => {
    if (!form.name.trim() || form.duration <= 0 || form.price < 0 || !Number.isInteger(form.bufferBefore) || !Number.isInteger(form.bufferAfter) || form.bufferBefore < 0 || form.bufferAfter < 0 || form.bufferBefore > 1440 || form.bufferAfter > 1440 || (form.appointmentType === "group" && (!Number.isInteger(form.capacity) || form.capacity < 2 || form.capacity > 100))) return;
    setSaving(true);
    setError("");
    try {
      if (editingId) await updateService(editingId, form);
      else await addService(form);
      setShow(false);
      setEditingId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Service could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Services"
        copy="Control what customers can book, how long it takes, and what it costs."
        action={
          <button className="solid-action" onClick={openCreate}>
            <Plus size={16} />
            Create service
          </button>
        }
      />
      {error && <div className="booking-error" role="alert">{error}</div>}
      <div className="service-grid">
        {workspace.services.map((service) => (
          <article className="service-card" key={service.id}>
            <div className="service-color" style={{ background: service.color }} />
            <div className="service-top">
              <span style={{ background: `${service.color}18`, color: service.color }}>
                <Sparkles size={18} />
              </span>
            </div>
            <h3>{service.name}</h3>
            <p>{service.description}</p>
            <div className="service-meta">
              <span>
                <Clock3 size={15} />
                {service.duration} min
              </span>
              <span>
                <CircleDollarSign size={15} />${service.price}
              </span>
              {service.appointmentType === "group" && <span>Group · {service.capacity ?? 1} seats</span>}
            </div>
            <div className="service-footer">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={service.active}
                  disabled={updatingId === service.id}
                  onChange={(e) => void changeVisibility(service.id, e.target.checked)}
                />
                <i />
              </label>
              <span>{service.active ? "Bookable" : "Hidden"}</span>
              <button type="button" className="text-action" onClick={() => openEdit(service)}>Edit service</button>
            </div>
          </article>
        ))}
      </div>
      {show && (
        <Modal title={editingId ? "Edit service" : "Create service"} onClose={() => setShow(false)}>
          <label>
            Service name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Initial consultation"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="field-pair">
            <label>
              Duration (minutes)
              <input
                type="number"
                min="1"
                step="1"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              />
            </label>
            <label>
              Price
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="field-pair">
            <label>Buffer before (minutes)<input type="number" min="0" max="1440" step="1" value={form.bufferBefore} onChange={(event) => setForm({ ...form, bufferBefore: Number(event.target.value) })} /></label>
            <label>Buffer after (minutes)<input type="number" min="0" max="1440" step="1" value={form.bufferAfter} onChange={(event) => setForm({ ...form, bufferAfter: Number(event.target.value) })} /></label>
          </div>
          <div className="field-pair"><label>Booking type<select value={form.appointmentType} disabled={Boolean(editingId)} onChange={(event) => setForm({ ...form, appointmentType: event.target.value as "individual" | "group", capacity: event.target.value === "group" ? 2 : 1 })}><option value="individual">Individual</option><option value="group">Group</option></select></label>{form.appointmentType === "group" && <label>Group capacity<input type="number" min="2" max="100" step="1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} /></label>}</div>
          {editingId && <p>Booking type stays fixed after creation so existing appointments keep their original session rules.</p>}
          <p>Buffers reserve extra staff time around each booking without changing its customer-facing duration.</p>
          <button className="solid-action full" disabled={saving || !form.name.trim() || form.duration <= 0 || form.price < 0 || !Number.isInteger(form.bufferBefore) || !Number.isInteger(form.bufferAfter) || form.bufferBefore < 0 || form.bufferAfter < 0 || form.bufferBefore > 1440 || form.bufferAfter > 1440 || (form.appointmentType === "group" && (!Number.isInteger(form.capacity) || form.capacity < 2 || form.capacity > 100))} onClick={save}>
            {saving ? "Saving…" : editingId ? "Save service" : "Create service"}
          </button>
        </Modal>
      )}
    </>
  );
}

function Integrations() {
  const { workspace } = useAppStore();
  return (
    <>
      <PageHeader
        title="Integrations"
        copy="Connect the tools that power your business. Nothing is presented as connected until credentials are verified."
      />
      <div className="integration-grid">
        {workspace.integrations.map((item) => (
          <article className="integration-app" key={item.id}>
            <div className={`integration-brand ${item.id}`}>{item.name.charAt(0)}</div>
            <div>
              <span>{item.category}</span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </div>
            <div className={`connection-state ${item.status}`}>
              {item.status === "connected"
                ? "Connected"
                : item.status === "pending-approval"
                  ? "Partner approval required"
                  : "Not configured"}
            </div>
            <button className="secondary-action" disabled>
              {item.status === "pending-approval" ? "Partner approval pending" : "Provider credentials required"}
            </button>
          </article>
        ))}
      </div>
      <div className="panel provider-note">
        <Bot size={22} />
        <div>
          <h3>Provider setup is intentionally paused</h3>
          <p>
            OAuth, payments, SMS, and AI calling require provider accounts, secrets, callback URLs,
            compliance choices, and—for Google Book Online—partner approval. Their UI and boundaries
            are ready, but no fake connection has been created.
          </p>
        </div>
      </div>
    </>
  );
}

function Messages() {
  return (
    <>
      <PageHeader
        title="Messages"
        copy="Customer conversations will appear here after a messaging provider is connected."
      />
      <div className="inbox-shell">
        <aside>
          <p>No conversations yet.</p>
        </aside>
        <section>
          <div className="conversation-head">
            <div>
              <b>Messaging unavailable</b>
              <small>SMS provider not configured</small>
            </div>
          </div>
          <div className="message-empty">
            <Inbox size={34} />
            <h3>No messages to show</h3>
            <p>
              Connect a messaging provider to send and receive real messages. Delivery will be shown only after a provider event.
            </p>
          </div>
          <div className="composer">
            <input disabled placeholder="Connect Twilio to send a message" />
            <button disabled>Send</button>
          </div>
        </section>
      </div>
    </>
  );
}

function PhoneAi() {
  const { workspace, updateAiReceptionist, addCallLog, addCustomer } =
    useAppStore();
  const [settings, setSettings] = useState(workspace.aiReceptionist);
  const [show, setShow] = useState(false);
  const [result, setResult] = useState("");
  const [call, setCall] = useState({
    caller: "(555) 010-2020",
    name: "Taylor Reed",
    serviceId: workspace.services.find((service) => service.active)?.id ?? "",
    date: businessDate(workspace.business.timezone),
    time: "",
  });
  const eligible = workspace.staff.filter(
    (member) => member.active && member.serviceIds.includes(call.serviceId),
  );
  const slots =
    call.serviceId && call.date
      ? [
          ...new Set(
            eligible.flatMap((member) =>
              availableSlots(workspace, call.serviceId, call.date, undefined, member.id),
            ),
          ),
        ].sort()
      : [];
  const run = async () => {
    const service = workspace.services.find((item) => item.id === call.serviceId);
    const staff = eligible.find((member) =>
      availableSlots(workspace, call.serviceId, call.date, undefined, member.id).includes(
        call.time,
      ),
    );
    if (!service || !staff || !call.time) return;
    let customer = workspace.customers.find((item) => item.phone === call.caller);
    if (!customer)
      customer = await addCustomer({
        name: call.name,
        email: "",
        phone: call.caller,
        notes: "Created by AI receptionist sandbox.",
        tags: ["AI call"],
      });
    await addCallLog({
      caller: call.caller,
      customerId: customer.id,
      durationSeconds: 96,
      outcome: "booked",
      summary: `${settings.name} disclosed that it was an AI assistant and simulated booking ${service.name} with ${staff.name} for ${call.name} on ${formatDate(call.date)} at ${prettyTime(call.time)}. No appointment was reserved.`,
    });
    setResult("Sandbox call saved. Availability was checked, but no real appointment was created.");
    setShow(false);
  };
  return (
    <>
      <PageHeader
        title="Phone & AI"
        copy="Configure your receptionist and test booking conversations safely before connecting telephony."
        action={
          <button className="solid-action" onClick={() => setShow(true)}>
            <Play size={15} />
            Simulate a call
          </button>
        }
      />
      <div className="sandbox-banner">
        <Bot size={20} />
        <div>
          <b>Sandbox mode</b>
          <span>
            No phone number or voice provider is connected. Simulations are saved as test calls and
            never presented as real traffic.
          </span>
        </div>
      </div>
      {result && (
        <div className="success-notice">
          <Check size={16} />
          {result}
        </div>
      )}
      <div className="phone-ai-grid">
        <section className="panel ai-config">
          <div className="panel-heading">
            <div>
              <h2>AI receptionist</h2>
              <p>Customer-facing identity and escalation behavior.</p>
            </div>
            <span className="sandbox-pill">SANDBOX</span>
          </div>
          <div className="field-pair">
            <label>
              Assistant name
              <input
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              />
            </label>
            <label>
              Voice
              <select
                value={settings.voice}
                onChange={(e) => setSettings({ ...settings, voice: e.target.value })}
              >
                <option>Warm and professional</option>
                <option>Calm and concise</option>
                <option>Bright and friendly</option>
              </select>
            </label>
          </div>
          <label>
            Greeting
            <textarea
              value={settings.greeting}
              onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
            />
          </label>
          <div className="field-pair">
            <label>
              Transfer number
              <input
                value={settings.transferPhone}
                onChange={(e) => setSettings({ ...settings, transferPhone: e.target.value })}
                placeholder="Not configured"
              />
            </label>
            <label>
              After-hours behavior
              <select
                value={settings.afterHours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    afterHours: e.target.value as typeof settings.afterHours,
                  })
                }
              >
                <option value="take-message">Take a message</option>
                <option value="offer-callback">Offer a callback</option>
              </select>
            </label>
          </div>
          <div className="ai-controls">
            <label>
              <input
                type="checkbox"
                checked={settings.disclosureEnabled}
                onChange={(e) => setSettings({ ...settings, disclosureEnabled: e.target.checked })}
              />
              Disclose that the assistant is AI
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.recordingEnabled}
                onChange={(e) => setSettings({ ...settings, recordingEnabled: e.target.checked })}
              />
              Enable recording after consent
            </label>
          </div>
          <button
            className="solid-action"
            onClick={async () => {
              try {
                await updateAiReceptionist(settings);
                setResult("Receptionist settings saved to your workspace.");
              } catch (error) {
                setResult(error instanceof Error ? error.message : "Unable to save receptionist settings.");
              }
            }}
          >
            Save settings
          </button>
        </section>
        <section className="panel call-log">
          <div className="panel-heading">
            <div>
              <h2>Call log</h2>
              <p>Real calls remain empty until a provider is connected.</p>
            </div>
            <b>{workspace.callLogs.length} sandbox</b>
          </div>
          {workspace.callLogs.length === 0 ? (
            <div className="call-empty">
              <PhoneCall size={28} />
              <h3>No simulated calls yet</h3>
              <p>Run a test call to verify the assistant uses live workspace availability.</p>
            </div>
          ) : (
            workspace.callLogs.map((log) => (
              <article key={log.id}>
                <span className="call-outcome">
                  <Check size={14} />
                </span>
                <div>
                  <b>{log.caller}</b>
                  <p>{log.summary}</p>
                  <small>
                    {new Date(log.startedAt).toLocaleString()} ·{" "}
                    {Math.floor(log.durationSeconds / 60)}m {log.durationSeconds % 60}s · Sandbox
                  </small>
                </div>
                <i>{log.outcome}</i>
              </article>
            ))
          )}
        </section>
      </div>
      {show && (
        <Modal title="Simulate an AI booking call" onClose={() => setShow(false)}>
          <div className="simulation-note">
            <Bot size={18} />
            This checks live availability and saves a sandbox call log. It does not reserve an
            appointment or place a telephone call.
          </div>
          <div className="field-pair">
            <label>
              Caller name
              <input
                value={call.name}
                onChange={(e) => setCall({ ...call, name: e.target.value })}
              />
            </label>
            <label>
              Caller number
              <input
                value={call.caller}
                onChange={(e) => setCall({ ...call, caller: e.target.value })}
              />
            </label>
          </div>
          <label>
            Requested service
            <select
              value={call.serviceId}
              onChange={(e) => setCall({ ...call, serviceId: e.target.value, time: "" })}
            >
              {workspace.services
                .filter((item) => item.active)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="field-pair">
            <label>
              Date
              <input
                type="date"
                value={call.date}
                onChange={(e) => setCall({ ...call, date: e.target.value, time: "" })}
              />
            </label>
            <label>
              Available time
              <select
                value={call.time}
                onChange={(e) => setCall({ ...call, time: e.target.value })}
              >
                <option value="">Choose a real slot</option>
                {slots.map((slot) => (
                  <option value={slot} key={slot}>
                    {prettyTime(slot)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="solid-action full"
            disabled={!call.name || !call.caller || !call.time}
            onClick={run}
          >
            Run sandbox conversation
          </button>
        </Modal>
      )}
    </>
  );
}

function BookingTools() {
  const { workspace } = useAppStore();
  const [copied, setCopied] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const bookingUrl = `${origin}/book/${workspace.business.slug}`;
  const copy = (label: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1800);
  };
  const buttonCode = `<a href="${bookingUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:12px 20px;border-radius:8px;background:${workspace.business.accent};color:#fff;text-decoration:none;font-family:sans-serif;font-weight:600">Book online</a>`;
  const iframeCode = `<iframe src="${bookingUrl}" title="Book with ${workspace.business.name}" width="100%" height="760" style="border:0;border-radius:12px" loading="lazy"></iframe>`;
  return (
    <>
      <PageHeader
        title="Booking page"
        copy="Publish your booking experience anywhere customers find your business."
        action={
          <Link
            to="/book/$slug"
            params={{ slug: workspace.business.slug }}
            target="_blank"
            className="solid-action"
          >
            <ExternalLink size={15} />
            Open live page
          </Link>
        }
      />
      <div className="booking-tools-grid">
        <section className="panel share-panel">
          <div className="tool-icon">
            <Link2 size={20} />
          </div>
          <h2>Shareable booking link</h2>
          <p>
            Use this link in email, social profiles, text messages, and your Google Business Profile
            website field.
          </p>
          <div className="copy-field">
            <code>{bookingUrl}</code>
            <button onClick={() => copy("link", bookingUrl)}>
              {copied === "link" ? <Check size={15} /> : <Copy size={15} />}
            </button>
          </div>
          <div className="service-links">
            <b>Direct service links</b>
            {workspace.services
              .filter((service) => service.active)
              .map((service) => (
                <div key={service.id}>
                  <span>{service.name}</span>
                  <button onClick={() => copy(service.id, `${bookingUrl}?service=${service.id}`)}>
                    {copied === service.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ))}
          </div>
        </section>
        <section className="panel booking-preview-card">
          <span>LIVE PREVIEW</span>
          <div className="preview-business">
            <i style={{ background: workspace.business.accent }}>
              {workspace.business.name.charAt(0)}
            </i>
            <div>
              <b>{workspace.business.name}</b>
              <small>{workspace.business.industry}</small>
            </div>
          </div>
          <h2>Book your next appointment.</h2>
          <p>Choose a service and find a time that works for you.</p>
          <Link to="/book/$slug" params={{ slug: workspace.business.slug }} target="_blank" style={{ background: workspace.business.accent }}>
            Book an appointment <ArrowRight size={15} />
          </Link>
          <small>Powered by Avello</small>
        </section>
      </div>
      <div className="embed-grid">
        <section className="panel embed-card">
          <div className="panel-heading">
            <div>
              <h2>Website button</h2>
              <p>A styled link that works on any website.</p>
            </div>
            <span className="ready-pill">Ready</span>
          </div>
          <pre>{buttonCode}</pre>
          <button className="secondary-action" onClick={() => copy("button", buttonCode)}>
            {copied === "button" ? <Check size={15} /> : <Copy size={15} />}Copy button code
          </button>
        </section>
        <section className="panel embed-card">
          <div className="panel-heading">
            <div>
              <h2>Inline booking widget</h2>
              <p>Embed the full booking experience on a page.</p>
            </div>
            <span className="ready-pill">Ready</span>
          </div>
          <pre>{iframeCode}</pre>
          <button className="secondary-action" onClick={() => copy("iframe", iframeCode)}>
            {copied === "iframe" ? <Check size={15} /> : <Copy size={15} />}Copy iframe code
          </button>
        </section>
      </div>
      <div className="panel google-booking-note">
        <div className="integration-brand google-booking">G</div>
        <div>
          <span>GOOGLE BUSINESS PROFILE</span>
          <h3>Book Online integration requires partner approval</h3>
          <p>
            The public link can be shared now. The official Google Book Online button is not claimed
            as active until Avello completes Google’s approved scheduling-provider process.
          </p>
        </div>
        <button className="secondary-action" disabled>
          Pending approval
        </button>
      </div>
    </>
  );
}

function Team() {
  const { workspace, addStaff, updateStaff } = useAppStore();
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);
  const [scheduleMember, setScheduleMember] = useState<Staff | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"staff" | "manager">("staff");
  const [invitePermissions, setInvitePermissions] = useState<Record<string, boolean>>({});
  const [inviteLink, setInviteLink] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const managerFlags = [
    ["can_manage_customers", "Manage customers"],
    ["can_manage_services", "Manage services"],
    ["can_manage_staff", "Invite staff"],
    ["can_manage_forms", "Manage forms"],
    ["can_manage_messages", "Manage messages"],
    ["can_manage_automations", "Manage automations"],
    ["can_view_analytics", "View analytics"],
    ["can_manage_billing", "Manage billing"],
  ] as const;
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "staff" as const,
    active: true,
    serviceIds: [] as string[],
    weeklyHours: 40,
    bufferBefore: 0,
    bufferAfter: 0,
  });
  const save = async () => {
    if (!form.name.trim() || (!editingId && !form.email.trim()) || form.weeklyHours < 0 || !Number.isInteger(form.bufferBefore) || !Number.isInteger(form.bufferAfter) || form.bufferBefore < 0 || form.bufferAfter < 0 || form.bufferBefore > 1440 || form.bufferAfter > 1440) return;
    setError("");
    setSavingStaff(true);
    try {
      if (editingId) await updateStaff(editingId, form);
      else await addStaff(form);
      setShow(false);
      setEditingId("");
      setForm({ name: "", email: "", role: "staff", active: true, serviceIds: [], weeklyHours: 40, bufferBefore: 0, bufferAfter: 0 });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Team profile could not be saved.");
    } finally {
      setSavingStaff(false);
    }
  };
  const openCreate = () => {
    setEditingId("");
    setError("");
    setForm({ name: "", email: "", role: "staff", active: true, serviceIds: [], weeklyHours: 40, bufferBefore: 0, bufferAfter: 0 });
    setShow(true);
  };
  const openEdit = (member: (typeof workspace.staff)[number]) => {
    setEditingId(member.id);
    setError("");
    setForm({ name: member.name, email: member.email, role: "staff", active: member.active, serviceIds: member.serviceIds, weeklyHours: member.weeklyHours, bufferBefore: member.bufferBefore ?? 0, bufferAfter: member.bufferAfter ?? 0 });
    setShow(true);
  };
  const createInvitation = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    setInviteLink("");
    try {
      const result = await invokeBackend<{ token: string }>("create_member_invitation", {
        p_business_id: workspace.business.id,
        p_email: inviteEmail.trim(),
        p_role: inviteRole,
        p_location_ids: inviteRole === "manager" ? [] : workspace.business.defaultLocationId ? [workspace.business.defaultLocationId] : [],
        p_permissions: inviteRole === "manager" ? invitePermissions : {},
      });
      setInviteLink(`${location.origin}/invite/${encodeURIComponent(result.token)}`);
    } catch (caught) {
      setInviteError(caught instanceof Error ? caught.message : "Invitation could not be created.");
    } finally {
      setInviting(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Team"
        copy="Create bookable staff profiles and invite team members to access the workspace."
        action={
          <button className="solid-action" onClick={openCreate}>
            <UserPlus size={16} />
            Add team member
          </button>
        }
      />
      <section className="panel settings-form">
        <h2>Invite a team member</h2>
        <p>Create a private invitation link. It expires after seven days and can be used once.</p>
        <label>Email address<input type="email" value={inviteEmail} onChange={(event) => { setInviteEmail(event.target.value); setInviteLink(""); }} placeholder="morgan@business.com" /></label>
        {workspace.memberRole === "owner" && <label>Account role<select value={inviteRole} onChange={(event) => { setInviteRole(event.target.value as "staff" | "manager"); setInvitePermissions({}); setInviteLink(""); }}><option value="staff">Staff</option><option value="manager">Manager</option></select></label>}
        {inviteRole === "manager" && <fieldset className="service-checks"><legend>Manager permissions</legend><p>This invitation grants access to all business locations. Select only the permissions this manager needs.</p>{managerFlags.map(([key, label]) => <label key={key}><input type="checkbox" checked={invitePermissions[key] === true} onChange={(event) => { setInvitePermissions((current) => ({ ...current, [key]: event.target.checked })); setInviteLink(""); }} />{label}</label>)}</fieldset>}
        <button className="solid-action" onClick={createInvitation} disabled={inviting || !inviteEmail.trim()}>{inviting ? "Creating…" : "Create invitation link"}</button>
        {inviteError && <p className="form-error" role="alert">{inviteError}</p>}
        {inviteLink && <div role="status"><p>Share this link securely with {inviteEmail}. It is shown once.</p><input readOnly value={inviteLink} aria-label="Invitation link" /><button onClick={() => void navigator.clipboard.writeText(inviteLink)}>Copy link</button></div>}
      </section>
      <div className="team-grid">
        {workspace.staff.map((member) => (
          <article className="team-card" key={member.id}>
            <div className="team-avatar">{initials(member.name)}</div>
            <div className="team-title">
              <h3>{member.name}</h3>
              <p>{member.email}</p>
            </div>
            <span className={`role-pill ${member.role}`}>{member.role}</span>
            <dl>
              <div>
                <dt>Weekly capacity</dt>
                <dd>{member.weeklyHours} hours</dd>
              </div>
              <div>
                <dt>Assigned services</dt>
                <dd>{member.serviceIds.length}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className={member.active ? "active-text" : ""}>
                  {member.active ? "Active" : "Inactive"}
                </dd>
              </div>
            </dl>
            <div className="assigned-services">
              {member.serviceIds.map((id) => (
                <span key={id}>
                  {workspace.services.find((service) => service.id === id)?.name}
                </span>
              ))}
            </div>
            <button type="button" className="secondary-action" onClick={() => openEdit(member)}>Edit profile</button>
            <button type="button" className="secondary-action" onClick={() => setScheduleMember(member)}>Weekly availability</button>
          </article>
        ))}
      </div>
      {show && (
        <Modal title={editingId ? "Edit team profile" : "Add team member"} onClose={() => setShow(false)}>
          {error && <div className="booking-error" role="alert">{error}</div>}
          <label>
            Full name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Morgan Chen"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="morgan@business.com"
            />
          </label>
          <div className="field-pair">
            <p>{editingId ? "This changes the scheduling profile. Account login and manager permissions are managed separately." : "This creates a scheduling profile. Login access and manager permissions require an invitation."}</p>
            <label>
              Weekly hours
              <input
                type="number"
                min="0"
                value={form.weeklyHours}
                onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="field-pair">
            <label>Buffer before (minutes)<input type="number" min="0" max="1440" step="1" value={form.bufferBefore} onChange={(event) => setForm({ ...form, bufferBefore: Number(event.target.value) })} /></label>
            <label>Buffer after (minutes)<input type="number" min="0" max="1440" step="1" value={form.bufferAfter} onChange={(event) => setForm({ ...form, bufferAfter: Number(event.target.value) })} /></label>
          </div>
          {editingId && <label>Active profile<input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /></label>}
          <fieldset className="service-checks">
            <legend>Assigned services</legend>
            {workspace.services.map((service) => (
              <label key={service.id}>
                <input
                  type="checkbox"
                  checked={form.serviceIds.includes(service.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      serviceIds: e.target.checked
                        ? [...form.serviceIds, service.id]
                        : form.serviceIds.filter((id) => id !== service.id),
                    })
                  }
                />
                {service.name}
              </label>
            ))}
          </fieldset>
          <button className="solid-action full" onClick={save} disabled={savingStaff || !form.name.trim() || (!editingId && !form.email.trim()) || form.weeklyHours < 0 || !Number.isInteger(form.bufferBefore) || !Number.isInteger(form.bufferAfter) || form.bufferBefore < 0 || form.bufferAfter < 0 || form.bufferBefore > 1440 || form.bufferAfter > 1440}>
            {savingStaff ? "Saving…" : editingId ? "Save profile" : "Add member"}
          </button>
        </Modal>
      )}
      {scheduleMember && <WeeklyHoursDialog member={scheduleMember} businessId={workspace.business.id} locationId={workspace.business.defaultLocationId} onClose={() => setScheduleMember(null)} />}
    </>
  );
}

type WeeklyRule = { id: string; iso_weekday: number; opens_at: string; closes_at: string; active: boolean; row_version: number };
type LocationHour = { iso_weekday: number; opens_at: string; closes_at: string; active: boolean };
type DayDraft = { open: string; close: string; active: boolean };
const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function WeeklyHoursDialog({ member, businessId, locationId, onClose }: { member: Staff; businessId: string; locationId: string | undefined; onClose: () => void }) {
  const [rules, setRules] = useState<WeeklyRule[]>([]);
  const [locationHours, setLocationHours] = useState<LocationHour[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DayDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingDay, setSavingDay] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!locationId) { setError("Set a default location before editing availability."); setLoading(false); return; }
    let mounted = true;
    invokeBackend<{ rules: WeeklyRule[]; business_hours: LocationHour[] }>("get_staff_weekly_hours", { p_business_id: businessId, p_staff_id: member.id, p_location_id: locationId })
      .then((result) => {
        if (!mounted) return;
        setRules(result.rules);
        setLocationHours(result.business_hours);
        setDrafts(Object.fromEntries(weekdayNames.map((_, index) => {
          const weekday = index + 1;
          const rule = result.rules.find((item) => item.iso_weekday === weekday);
          const hour = result.business_hours.find((item) => item.iso_weekday === weekday);
          return [weekday, { open: (rule?.opens_at ?? hour?.opens_at ?? "09:00").slice(0, 5), close: (rule?.closes_at ?? hour?.closes_at ?? "17:00").slice(0, 5), active: rule?.active ?? false }];
        })));
      })
      .catch((caught) => { if (mounted) setError(caught instanceof Error ? caught.message : "Availability could not be loaded."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [businessId, locationId, member.id]);
  const saveDay = async (weekday: number) => {
    if (!locationId) return;
    const draft = drafts[weekday];
    if (!draft) return;
    const rule = rules.find((item) => item.iso_weekday === weekday);
    setSavingDay(weekday); setError(""); setNotice("");
    try {
      const saved = await invokeBackend<WeeklyRule>("set_staff_weekly_hours_day", { p_business_id: businessId, p_staff_id: member.id, p_location_id: locationId, p_iso_weekday: weekday, p_opens_at: draft.open, p_closes_at: draft.close, p_active: draft.active, p_expected_row_version: rule?.row_version ?? null });
      setRules((current) => [...current.filter((item) => item.iso_weekday !== weekday), saved]);
      setNotice(`${weekdayNames[weekday - 1]} availability saved.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Availability could not be saved."); }
    finally { setSavingDay(0); }
  };
  return <Modal title={`Weekly availability · ${member.name}`} onClose={onClose} wide>
    <p>These hours control new booking slots at the default location. Existing appointments stay booked.</p>
    {loading && <p role="status">Loading weekly hours…</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && locationId && <div className="weekly-hours-list">{weekdayNames.map((name, index) => {
      const weekday = index + 1;
      const draft = drafts[weekday];
      const hour = locationHours.find((item) => item.iso_weekday === weekday);
      const dayRules = rules.filter((item) => item.iso_weekday === weekday);
      if (!draft) return null;
      const available = Boolean(hour?.active);
      const valid = draft.open < draft.close && (!draft.active || (available && draft.open >= hour!.opens_at.slice(0, 5) && draft.close <= hour!.closes_at.slice(0, 5)));
      return <div className="weekly-hours-row" key={weekday}>
        <b>{name}</b>
        <label><input type="checkbox" checked={draft.active} disabled={!available || dayRules.length > 1} onChange={(event) => setDrafts((current) => ({ ...current, [weekday]: { ...(current[weekday] ?? draft), active: event.target.checked } }))} />Available</label>
        <input type="time" aria-label={`${name} starts`} value={draft.open} disabled={!draft.active || dayRules.length > 1} onChange={(event) => setDrafts((current) => ({ ...current, [weekday]: { ...(current[weekday] ?? draft), open: event.target.value } }))} />
        <input type="time" aria-label={`${name} ends`} value={draft.close} disabled={!draft.active || dayRules.length > 1} onChange={(event) => setDrafts((current) => ({ ...current, [weekday]: { ...(current[weekday] ?? draft), close: event.target.value } }))} />
        <button type="button" className="secondary-action" disabled={!valid || Boolean(savingDay) || dayRules.length > 1} onClick={() => void saveDay(weekday)}>{savingDay === weekday ? "Saving…" : "Save"}</button>
        {dayRules.length > 1 && <small>Multiple rules exist for this day; edit them in the advanced schedule.</small>}
        {!available && <small>Location closed</small>}
      </div>;
    })}</div>}
  </Modal>;
}

function Forms() {
  const { workspace, addForm, updateForm } = useAppStore();
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState("");
  const [savingForm, setSavingForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedFormId, setSelectedFormId] = useState(workspace.forms[0]?.id ?? "");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [fields, setFields] = useState<FormField[]>([
    { id: "new_name", label: "Full name", type: "text", required: true, customerMapping: "full_name" },
  ]);
  const addField = () =>
    setFields([
      ...fields,
      {
        id: `field_${fields.length}`,
        label: "New question",
        type: "text" as const,
        required: false,
      },
    ]);
  const save = async () => {
    if (!name) return;
    setSavingForm(true); setFormError("");
    try {
      if (editingId) {
        await updateForm(editingId, { name, fields });
        setShow(false);
        setEditingId("");
        return;
      }
      const form = await addForm({ name, description: "Custom customer intake form", active: true, fields });
      setSelectedFormId(form.id);
      setShow(false);
      setName("");
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Form could not be saved.");
    } finally {
      setSavingForm(false);
    }
  };
  const editForm = (form: BusinessForm) => {
    setEditingId(form.id);
    setName(form.name);
    setFields(form.fields.map((field) => ({ ...field })));
    setShow(true);
  };
  const selectedForm = workspace.forms.find((form) => form.id === selectedFormId);
  const submissions = workspace.formSubmissions
    .filter((submission) => submission.formId === selectedFormId)
    .filter((submission) => {
      const customer = workspace.customers.find((item) => item.id === submission.customerId);
      return `${customer?.name ?? ""} ${customer?.email ?? ""} ${Object.values(submission.answers).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const selectedSubmission = workspace.formSubmissions.find(
    (submission) => submission.id === selectedSubmissionId,
  );
  const exportSubmissions = () => {
    if (!selectedForm) return;
    const headers = ["Submitted", "Customer", ...selectedForm.fields.map((field) => field.label)];
    const rows = submissions.map((submission) => {
      const customer = workspace.customers.find((item) => item.id === submission.customerId);
      return [
        new Date(submission.submittedAt).toISOString(),
        customer?.name ?? "Unmatched",
        ...selectedForm.fields.map((field) => String(submission.answers[field.id] ?? "")),
      ];
    });
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const blob = new Blob([[headers, ...rows].map((row) => row.map(quote).join(",")).join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedForm.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-submissions.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        title="Forms"
        copy="Build branded forms and review every real response connected to your CRM."
        action={
          <button className="solid-action" onClick={() => setShow(true)}>
            <Plus size={16} />
            Create form
          </button>
        }
      />
      {formError && !show && <p className="form-error" role="alert">{formError}</p>}
      <div className="forms-grid">
        {workspace.forms.map((form) => (
          <article
            className={`form-card ${selectedFormId === form.id ? "selected" : ""}`}
            key={form.id}
          >
            <div className="form-card-icon">
              <FormInput size={20} />
            </div>
            <div className="form-card-title">
              <h3>{form.name}</h3>
              <p>{form.description}</p>
            </div>
            <button aria-label={`Edit ${form.name}`} onClick={() => editForm(form)}>
              <MoreHorizontal size={17} />
            </button>
            <div className="form-stats">
              <span>
                <b>{form.fields.length}</b> fields
              </span>
              <span>
                <b>{form.submissions}</b> submissions
              </span>
            </div>
            <div className="form-card-footer">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={async (e) => { try { setFormError(""); await updateForm(form.id, { active: e.target.checked }); } catch (caught) { setFormError(caught instanceof Error ? caught.message : "Form status could not be changed."); } }}
                />
                <i />
              </label>
              <span>{form.active ? "Accepting responses" : "Draft"}</span>
              <button
                onClick={() =>
                  navigator.clipboard?.writeText(`${location.origin}/forms/${form.id}`)
                }
              >
                <Copy size={14} />
                Copy link
              </button>
            </div>
            <button className="submission-action" onClick={() => setSelectedFormId(form.id)}>
              View submissions
            </button>
          </article>
        ))}
      </div>
      <section className="panel submissions-panel">
        <div className="panel-heading">
          <div>
            <h2>Form submissions</h2>
            <p>
              {selectedForm
                ? `${selectedForm.name} · ${submissions.length} saved responses`
                : "Choose a form"}
            </p>
          </div>
          <button
            className="secondary-action"
            disabled={!submissions.length}
            onClick={exportSubmissions}
          >
            <FileText size={14} />
            Export CSV
          </button>
        </div>
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search respondents or answers…"
            />
          </div>
          <select
            value={selectedFormId}
            onChange={(event) => setSelectedFormId(event.target.value)}
          >
            {workspace.forms.map((form) => (
              <option value={form.id} key={form.id}>
                {form.name}
              </option>
            ))}
          </select>
        </div>
        {submissions.length ? (
          <div className="submission-list">
            {submissions.map((submission) => {
              const customer = workspace.customers.find(
                (item) => item.id === submission.customerId,
              );
              return (
                <button key={submission.id} onClick={() => setSelectedSubmissionId(submission.id)}>
                  <span>{initials(customer?.name ?? "Guest")}</span>
                  <div>
                    <b>{customer?.name ?? "Unmatched respondent"}</b>
                    <small>
                      {customer?.email || "No customer email"} ·{" "}
                      {new Date(submission.submittedAt).toLocaleString()}
                    </small>
                    <p>
                      {selectedForm?.fields
                        .slice(0, 2)
                        .map(
                          (field) =>
                            `${field.label}: ${String(submission.answers[field.id] ?? "—")}`,
                        )
                        .join(" · ")}
                    </p>
                  </div>
                  <ArrowRight size={15} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="submission-empty">
            <FormInput size={27} />
            <h3>No matching submissions</h3>
            <p>Share the public form link to start collecting real responses.</p>
          </div>
        )}
      </section>
      {show && (
        <Modal title={editingId ? "Edit form" : "Build a form"} onClose={() => { setShow(false); setEditingId(""); }}>
          <label>
            Form name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pre-appointment questionnaire"
            />
          </label>
          <div className="field-builder">
            {fields.map((field, index) => (
              <div key={field.id}>
                <span>{index + 1}</span>
                <input
                  value={field.label}
                  onChange={(e) =>
                    setFields(
                      fields.map((item, i) =>
                        i === index ? { ...item, label: e.target.value } : item,
                      ),
                    )
                  }
                />
                <select
                  value={field.type}
                  onChange={(e) =>
                    setFields(
                      fields.map((item, i) =>
                        i === index ? { ...item, type: e.target.value as typeof field.type } : item,
                      ),
                    )
                  }
                >
                  <option value="text">Short text</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="textarea">Long text</option>
                  <option value="select">Dropdown</option>
                  <option value="checkbox">Checkbox</option>
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      setFields(
                        fields.map((item, i) =>
                          i === index ? { ...item, required: e.target.checked } : item,
                        ),
                      )
                    }
                  />
                  Required
                </label>
                <select
                  aria-label={`CRM mapping for ${field.label}`}
                  value={field.customerMapping ?? ""}
                  onChange={(e) => setFields(fields.map((item, i) => {
                    if (i !== index) return item;
                    if (!e.target.value) {
                      const { customerMapping: _mapping, ...withoutMapping } = item;
                      return withoutMapping;
                    }
                    return { ...item, customerMapping: e.target.value as NonNullable<FormField["customerMapping"]> };
                  }))}
                >
                  <option value="">No CRM mapping</option>
                  <option value="full_name">Customer full name</option>
                  <option value="email">Customer email</option>
                  <option value="phone_e164">Customer phone</option>
                  <option value="company_name">Company name</option>
                  <option value="address">Address</option>
                </select>
              </div>
            ))}
          </div>
          <button className="add-another" onClick={addField}>
            <Plus size={15} />
            Add field
          </button>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="solid-action full" onClick={save} disabled={savingForm}>
            {savingForm ? "Saving…" : editingId ? "Publish new version" : "Save form"}
          </button>
        </Modal>
      )}
      {selectedSubmission && (
        <Modal title="Submission details" onClose={() => setSelectedSubmissionId("")}>
          <div className="submission-person">
            <span>
              {initials(
                workspace.customers.find((item) => item.id === selectedSubmission.customerId)
                  ?.name ?? "Guest",
              )}
            </span>
            <div>
              <b>
                {workspace.customers.find((item) => item.id === selectedSubmission.customerId)
                  ?.name ?? "Unmatched respondent"}
              </b>
              <small>Submitted {new Date(selectedSubmission.submittedAt).toLocaleString()}</small>
            </div>
          </div>
          <div className="answer-list">
            {selectedForm?.fields.map((field) => (
              <div key={field.id}>
                <small>{field.label}</small>
                <p>{String(selectedSubmission.answers[field.id] ?? "No answer")}</p>
              </div>
            ))}
          </div>
          {selectedSubmission.customerId && <p>Linked customer: {workspace.customers.find((customer) => customer.id === selectedSubmission.customerId)?.name ?? "Customer record"}</p>}
        </Modal>
      )}
    </>
  );
}

function Automations() {
  const { workspace, addWorkflow } = useAppStore();
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger: "booking_created",
    action: "create_task",
    active: false,
  });
  const triggerOptions = [
    { value: "booking_created", label: "New booking" },
    { value: "booking_cancelled", label: "Booking cancelled" },
    { value: "appointment_completed", label: "Appointment completed" },
    { value: "customer_created", label: "New customer" },
    { value: "form_submitted", label: "Form submitted" },
    { value: "payment_failed", label: "Failed payment" },
  ];
  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    setError("");
    try {
      await addWorkflow(form);
      setShow(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workflow could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Automations"
        copy="Create repeatable workflows with transparent provider requirements and execution history."
        action={
          <button className="solid-action" onClick={() => setShow(true)}>
            <Plus size={16} />
            New workflow
          </button>
        }
      />
      {error && <div className="booking-error" role="alert">{error}</div>}
      <div className="automation-list">
        {workspace.workflows.map((workflow) => (
          <article className="automation-card" key={workflow.id}>
            <div className="automation-icon">
              <Zap size={19} />
            </div>
            <div className="automation-main">
              <div>
                <h3>{workflow.name}</h3>
                <span className={workflow.active ? "workflow-live" : "workflow-draft"}>
                  {workflow.active ? "Active" : "Draft"}
                </span>
              </div>
              <div className="flow-line">
                <span>
                  <small>WHEN</small>
                  {triggerOptions.find((option) => option.value === workflow.trigger)?.label ?? workflow.trigger}
                </span>
                <i>
                  <ArrowRight size={15} />
                </i>
                <span>
                  <small>THEN</small>
                  {workflow.action === "create_task" ? "Create follow-up task" : workflow.action}
                </span>
              </div>
              <p>
                {workflow.runs} recorded runs{" "}
                {workflow.lastRun ? `· Last run ${workflow.lastRun}` : "· No production executions"}
              </p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={workflow.active} disabled aria-label="Workflow activation requires a job runner" />
              <i />
            </label>
          </article>
        ))}
      </div>
      <div className="panel automation-note">
        <Bot size={21} />
        <div>
          <h3>Execution safety</h3>
          <p>
            Workflows are saved as drafts. Execution starts after a production job runner is connected.
          </p>
        </div>
      </div>
      {show && (
        <Modal title="Create automation" onClose={() => setShow(false)}>
          {error && <div className="booking-error" role="alert">{error}</div>}
          <label>
            Workflow name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Follow up with new customers"
            />
          </label>
          <label>
            Trigger
            <select
              value={form.trigger}
              onChange={(e) => setForm({ ...form, trigger: e.target.value })}
            >
              {triggerOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            Action
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
            >
              <option value="create_task">Create follow-up task</option>
            </select>
          </label>
          <button className="solid-action full" disabled={saving || !form.name.trim()} onClick={save}>
            {saving ? "Saving…" : "Save as draft"}
          </button>
        </Modal>
      )}
    </>
  );
}

function Payments() {
  const { workspace, addInvoice, recordManualPayment } = useAppStore();
  const [show, setShow] = useState(false);
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [paymentError, setPaymentError] = useState("");
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState("");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [form, setForm] = useState({
    customerId: workspace.customers[0]?.id ?? "",
    amount: 0,
    status: "draft" as const,
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  });
  const activeInvoices = workspace.invoices.filter((invoice) => invoice.status !== "void");
  const total = activeInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = activeInvoices.reduce((sum, invoice) => sum + invoice.paid, 0);
  const formatAmount = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: workspace.business.currency ?? "USD" }).format(amount);
  const paymentInvoice = workspace.invoices.find((invoice) => invoice.id === paymentInvoiceId);
  const paymentBalance = paymentInvoice ? Math.round((paymentInvoice.amount - paymentInvoice.paid) * 100) / 100 : 0;
  const validPaymentAmount = Number.isFinite(paymentAmount) && paymentAmount > 0 && Math.abs(paymentAmount * 100 - Math.round(paymentAmount * 100)) < 0.000001 && Math.round(paymentAmount * 100) <= Math.round(paymentBalance * 100);
  const save = async () => {
    if (!form.customerId || form.amount <= 0) return;
    setSaving(true); setPaymentError("");
    try { await addInvoice(form); setShow(false); }
    catch (caught) { setPaymentError(caught instanceof Error ? caught.message : "Invoice could not be created."); }
    finally { setSaving(false); }
  };
  const markPaid = async (id: string, amount: number) => {
    if (!paymentMethod) return;
    setPayingId(id); setPaymentError("");
    try { await recordManualPayment(id, amount, paymentMethod); setPaymentInvoiceId(""); }
    catch (caught) { setPaymentError(caught instanceof Error ? caught.message : "Payment could not be recorded."); }
    finally { setPayingId(""); }
  };
  return (
    <>
      <PageHeader
        title="Payments & invoices"
        copy="Track money owed and collected. Card processing stays disabled until Stripe is configured."
        action={
          <button className="solid-action" onClick={() => setShow(true)}>
            <Plus size={16} />
            Create invoice
          </button>
        }
      />
      <div className="metric-grid payments-metrics">
        <Metric
          label="Invoice total"
          value={formatAmount(total)}
          trend="Non-void invoice records"
          icon={FileText}
        />
        <Metric
          label="Collected"
          value={formatAmount(paid)}
          trend={`${total ? Math.round((paid / total) * 100) : 0}% collection rate`}
          icon={CircleDollarSign}
        />
        <Metric
          label="Outstanding"
          value={formatAmount(total - paid)}
          trend="Unpaid non-void balance"
          icon={Clock3}
        />
        <Metric label="Stripe status" value="Offline" trend="No payment claims" icon={CreditCard} />
      </div>
      <div className="panel table-panel">
        <div className="table-toolbar">
          <b className="toolbar-title">Invoices</b>
          <select aria-label="Filter invoice status" value={invoiceFilter} onChange={(event) => setInvoiceFilter(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="void">Void</option></select>
        </div>
        <div className="invoice-table">
          <div className="invoice-row header">
            <span>Invoice</span>
            <span>Customer</span>
            <span>Due</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {workspace.invoices.filter((invoice) => invoiceFilter === "all" || invoice.status === invoiceFilter).map((invoice) => (
            <div className="invoice-row" key={invoice.id}>
              <span>
                <b>{invoice.number}</b>
                <small>{formatDate(invoice.createdAt.slice(0, 10))}</small>
              </span>
              <span>{workspace.customers.find((c) => c.id === invoice.customerId)?.name}</span>
              <span>{formatDate(invoice.dueDate)}</span>
              <span>
                <b>{formatAmount(invoice.amount)}</b>
                {invoice.paid > 0 && invoice.status !== "paid" && <small>{formatAmount(invoice.paid)} recorded</small>}
              </span>
              <span className={`invoice-status ${invoice.status}`}>{invoice.status}{invoice.status !== "paid" && invoice.status !== "void" && <button disabled={payingId === invoice.id || invoice.amount <= invoice.paid} onClick={() => { setPaymentInvoiceId(invoice.id); setPaymentAmount(Math.round((invoice.amount - invoice.paid) * 100) / 100); setPaymentMethod(""); setPaymentError(""); }}>Record payment</button>}</span>
            </div>
          ))}
        </div>
      </div>
      {paymentError && !show && !paymentInvoiceId && <p role="alert" className="form-error">{paymentError}</p>}
      <div className="panel provider-note">
        <CreditCard size={21} />
        <div>
          <h3>Stripe is not configured</h3>
          <p>
            Invoices can be prepared and tracked, but payment links, charges, refunds, and
            subscription events remain unavailable until Stripe and webhook signing are configured
            server-side.
          </p>
        </div>
      </div>
      {show && (
        <Modal title="Create invoice" onClose={() => setShow(false)}>
          <label>
            Customer
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              {workspace.customers.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="field-pair">
            <label>
              Amount
              <input
                type="number"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </label>
            <label>
              Due date
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </label>
          </div>
          {paymentError && <p role="alert" className="form-error">{paymentError}</p>}
          <button className="solid-action full" onClick={save} disabled={saving || !form.customerId || form.amount <= 0}>
            {saving ? "Saving…" : "Save draft invoice"}
          </button>
        </Modal>
      )}
      {paymentInvoice && (
        <Modal title={`Record payment for ${paymentInvoice.number}`} onClose={() => { if (!payingId) setPaymentInvoiceId(""); }}>
          <p>Record money already received. This does not charge a card.</p>
          <p>Remaining balance: {formatAmount(paymentBalance)}</p>
          <label>Amount received<input type="number" min="0.01" max={paymentBalance} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(Number(event.target.value))} /></label>
          <label>Payment method<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | "")}><option value="">Select a method</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="external_terminal">External terminal</option><option value="card">Card processed elsewhere</option><option value="other">Other</option></select></label>
          {paymentError && <p role="alert" className="form-error">{paymentError}</p>}
          <button className="solid-action full" disabled={Boolean(payingId) || !validPaymentAmount || !paymentMethod} onClick={() => void markPaid(paymentInvoice.id, paymentAmount)}>{payingId ? "Recording…" : "Record manual payment"}</button>
        </Modal>
      )}
    </>
  );
}

function Analytics() {
  const { workspace } = useAppStore();
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsError, setAnalyticsError] = useState("");
  useEffect(() => {
    const through = new Date(); const from = new Date(); from.setDate(from.getDate() - 29);
    invokeBackend<any>("get_business_analytics", { p_business_id: workspace.business.id, p_location_id: null, p_from_date: from.toISOString().slice(0, 10), p_through_date: through.toISOString().slice(0, 10) }).then(setAnalytics).catch((caught) => setAnalyticsError(caught instanceof Error ? caught.message : "Analytics unavailable"));
  }, [workspace.business.id]);
  const activeCount = Number(analytics?.booking_count ?? 0) - Number(analytics?.cancelled_count ?? 0);
  const completedCount = Number(analytics?.completed_count ?? 0);
  const revenue = Number(analytics?.net_revenue_minor ?? 0) / 100;
  const serviceCounts: Array<{ name: string; count: number }> = (analytics?.booking_value_by_service ?? []).map((item: any) => ({ name: item.service_name, count: Number(item.total_minor) / 100 }));
  const bookingSources: Array<{ source: string; count: number }> = analytics?.booking_sources ?? [];
  const max = Math.max(1, ...serviceCounts.map((item) => item.count));
  const exportCsv = () => {
    if (!analytics) return;
    const safeCell = (value: string | number) => {
      const text = String(value);
      const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows: Array<Array<string | number>> = [
      ["Metric", "Value"],
      ["Total bookings", analytics.booking_count ?? 0],
      ["Cancelled bookings", analytics.cancelled_count ?? 0],
      ["Completed bookings", completedCount],
      ["Collected revenue", revenue],
      ["Repeat customers", analytics.repeat_customers ?? 0],
      [], ["Service", "Booking value"],
      ...serviceCounts.map((item) => [item.name, item.count]),
      [], ["Booking source", "Count"],
      ...bookingSources.map((item) => [item.source, item.count]),
    ];
    const blob = new Blob([rows.map((row) => row.map(safeCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `avello-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageHeader
        title="Analytics"
        copy="Metrics are calculated only from workspace records—no fabricated production data."
        action={
          <button className="secondary-action" onClick={exportCsv} disabled={!analytics}>
            <FileText size={15} />
            Export CSV
          </button>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Total bookings"
          value={analytics ? String(activeCount) : "—"}
          trend="Excludes cancelled"
          icon={CalendarDays}
        />
        <Metric
          label="Completed"
          value={analytics ? String(completedCount) : "—"}
          trend={activeCount ? `${Math.round((completedCount / activeCount) * 100)}% completion rate` : "No completed bookings"}
          icon={Check}
        />
        <Metric
          label="Collected revenue"
          value={`$${revenue.toLocaleString()}`}
          trend="Paid invoices only"
          icon={CircleDollarSign}
        />
        <Metric
          label="Repeat customers"
          value={analytics ? String(analytics.repeat_customers ?? 0) : "—"}
          trend="More than one booking"
          icon={Users}
        />
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Services by booking volume</h2>
              <p>Authoritative booking value for the last 30 days</p>
            </div>
          </div>
          <div className="service-bars">
            {serviceCounts.map((item) => (
              <div key={item.name}>
                <span>{item.name}</span>
                <div>
                  <i style={{ width: `${(item.count / max) * 100}%` }} />
                </div>
                <b>${item.count.toLocaleString()}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel source-panel">
          <div className="panel-heading">
            <div>
              <h2>Booking sources</h2>
              <p>Where appointments were created</p>
            </div>
          </div>
          {bookingSources.map((entry) => {
            const source = String(entry.source);
            const count = Number(entry.count);
            return (
              <div className="source-row" key={source}>
                <span>{source.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>
                <b>{count}</b>
                <i
                  style={{
                    width: `${analytics.booking_count ? (count / Number(analytics.booking_count)) * 100 : 0}%`,
                  }}
                />
              </div>
            );
          })}
          {analyticsError && <div className="booking-error">{analyticsError}</div>}
          <div className="analytics-disclaimer">
            Visitor conversion, provider costs, SMS usage, and AI call metrics remain unavailable
            until their real event sources are connected.
          </div>
        </section>
      </div>
    </>
  );
}

function BusinessSettings() {
  const { workspace, updateBusiness } = useAppStore();
  const [business, setBusiness] = useState(workspace.business);
  const [policy, setPolicy] = useState<Record<string, number> | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [manualApproval, setManualApproval] = useState(false);
  const [policyError, setPolicyError] = useState("");
  const [policySaved, setPolicySaved] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);
  useEffect(() => {
    let active = true;
    setPolicy(null);
    invokeBackend<{ settings: Record<string, number | boolean | null> }>("get_workspace_snapshot", { p_business_id: workspace.business.id })
      .then((snapshot) => { if (active) { setPolicy(snapshot.settings as Record<string, number>); setDailyLimit(typeof snapshot.settings["maximum_appointments_per_day"] === "number" ? snapshot.settings["maximum_appointments_per_day"] : null); setManualApproval(snapshot.settings["manual_approval_required"] === true); } })
      .catch((caught) => { if (active) setPolicyError(caught instanceof Error ? caught.message : "Booking policy could not be loaded."); });
    return () => { active = false; };
  }, [workspace.business.id]);
  const policyFields = [
    { key: "slot_interval_minutes", label: "Slot interval (minutes)", min: 5, max: 120 },
    { key: "minimum_notice_minutes", label: "Minimum booking notice (minutes)", min: 0, max: 525600 },
    { key: "maximum_advance_days", label: "Maximum advance booking (days)", min: 1, max: 730 },
    { key: "cancellation_notice_minutes", label: "Cancellation cutoff (minutes)", min: 0, max: 525600 },
    { key: "reschedule_notice_minutes", label: "Reschedule cutoff (minutes)", min: 0, max: 525600 },
  ] as const;
  const savePolicy = async () => {
    if (!policy) return;
    setPolicySaving(true); setPolicySaved(false); setPolicyError("");
    try {
      const values = { ...Object.fromEntries(policyFields.map(({ key }) => [key, policy[key]])), maximum_appointments_per_day: dailyLimit, manual_approval_required: manualApproval };
      const updated = await invokeBackend<Record<string, number | boolean | null>>("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "business_settings", p_operation: "update", p_values: values });
      setPolicy(updated as Record<string, number>); setDailyLimit(typeof updated["maximum_appointments_per_day"] === "number" ? updated["maximum_appointments_per_day"] : null); setManualApproval(updated["manual_approval_required"] === true); setPolicySaved(true);
    } catch (caught) { setPolicyError(caught instanceof Error ? caught.message : "Booking policy could not be saved."); }
    finally { setPolicySaving(false); }
  };
  const invalidPolicy = !policy || (dailyLimit !== null && (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 1000)) || policyFields.some(({ key, min, max }) => {
    const value = policy[key];
    return typeof value !== "number" || !Number.isInteger(value) || value < min || value > max;
  });
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      await updateBusiness({ name: business.name, industry: business.industry, email: business.email, phone: business.phone });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save business profile.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Business settings"
        copy="Manage the details customers see across your booking experience."
      />
      <div className="settings-layout">
        <aside>
          <button className="active" disabled>Business profile</button>
        </aside>
        <section className="panel settings-form">
          <h2>Business profile</h2>
          <p>These details appear on confirmations and your public booking page.</p>
          <div className="field-pair">
            <label>
              Business name
              <input
                value={business.name}
                onChange={(e) => setBusiness({ ...business, name: e.target.value })}
              />
            </label>
            <label>
              Industry
              <input
                value={business.industry}
                onChange={(e) => setBusiness({ ...business, industry: e.target.value })}
              />
            </label>
          </div>
          <label>
            Booking page slug
            <div className="input-prefix">
              <span>/book/</span>
              <input
                value={business.slug}
                readOnly
              />
            </div>
          </label>
          <p>The booking slug is read only here. Open Booking Page to copy the current public link.</p>
          <div className="field-pair">
            <label>
              Email
              <input
                value={business.email}
                onChange={(e) => setBusiness({ ...business, email: e.target.value })}
              />
            </label>
            <label>
              Phone
              <input
                value={business.phone}
                onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
              />
            </label>
          </div>
          <label>
            Address
            <input
              value={business.address}
              readOnly
            />
          </label>
          <p>The address comes from your booking location and is read only in this profile.</p>
          <div className="settings-actions">
            <button className="solid-action" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
          {saveError && <p role="alert" className="form-error">{saveError}</p>}
          {saved && <p role="status">Business profile saved.</p>}
        </section>
        <section className="panel settings-form">
          <h2>Booking rules</h2>
          <p>These limits apply to new bookings and customer changes. Enter zero minutes to allow an action until its appointment starts.</p>
          {!policy && !policyError && <p role="status">Loading booking rules…</p>}
          {policy && <div className="field-pair">{policyFields.map(({ key, label, min, max }) => <label key={key}>{label}<input type="number" min={min} max={max} step="1" value={policy[key] ?? ""} onChange={(event) => setPolicy((current) => current ? { ...current, [key]: event.target.value === "" ? NaN : Number(event.target.value) } : current)} /></label>)}</div>}
          {policy && <><label>Maximum appointments per day (blank for no limit)<input type="number" min="1" max="1000" step="1" value={dailyLimit ?? ""} onChange={(event) => setDailyLimit(event.target.value === "" ? null : Number(event.target.value))} /></label><label><input type="checkbox" checked={manualApproval} onChange={(event) => setManualApproval(event.target.checked)} /> Require manual approval for new bookings</label></>}
          {policy && <div className="settings-actions"><button type="button" className="solid-action" disabled={policySaving || invalidPolicy} onClick={() => void savePolicy()}>{policySaving ? "Saving…" : "Save booking rules"}</button></div>}
          {policyError && <p role="alert" className="form-error">{policyError}</p>}
          {policySaved && <p role="status">Booking rules saved.</p>}
        </section>
      </div>
    </>
  );
}

function ComingSoon({ section }: { section: Section }) {
  return (
    <>
      <PageHeader
        title={section}
        copy={`The ${section.toLowerCase()} workspace is architected and queued after the core scheduling data model is promoted to Supabase.`}
      />
      <div className="empty-state panel">
        <span>
          <Sparkles size={25} />
        </span>
        <h2>{section} is in the next build phase</h2>
        <p>
          This screen is not pretending to be functional. Its provider and database dependencies are
          documented in <code>IMPLEMENTATION_STATUS.md</code>.
        </p>
      </div>
    </>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={wide ? "modal-card wide" : "modal-card"} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
const prettyTime = (value: string) =>
  new Date(`2026-01-01T${value}:00`).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
const formatDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
