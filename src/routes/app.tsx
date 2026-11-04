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
  Bell,
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
  HelpCircle,
  Inbox,
  LayoutDashboard,
  Link2,
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
import { availableSlots, useAppStore, type AppointmentStatus } from "../lib/app-store";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/app")({ component: Dashboard });
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
  const { user, loading: authLoading } = useAuth();
  const { workspace, isPreview, isLoading } = useAppStore();
  const [section, setSection] = useState<Section>("Overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", replace: true });
  }, [authLoading, navigate, user]);
  useEffect(() => {
    if (!authLoading && user && !isLoading && !workspace.business.id)
      navigate({ to: "/onboarding", replace: true });
  }, [authLoading, isLoading, navigate, user, workspace.business.id]);
  if (authLoading || !user || isLoading)
    return <div className="app-loading">Loading your workspace…</div>;
  return (
    <div className="app-layout">
      <aside className={mobileOpen ? "app-sidebar mobile-open" : "app-sidebar"}>
        <div className="app-logo">
          <span className="avello-logo">A</span>
          <b>Avello</b>
          <button onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <button className="business-switch">
          <span className="business-avatar">N</span>
          <span>
            <b>{workspace.business.name}</b>
            <small>Professional plan</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav>
          {navigation.map(({ label, icon: Icon }) => (
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
              {label === "Messages" && <i>3</i>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button>
            <HelpCircle size={18} />
            Help & support
          </button>
          <div className="user-chip">
            <span>ET</span>
            <div>
              <b>Eric Thompson</b>
              <small>Owner</small>
            </div>
            <MoreHorizontal size={17} />
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button className="app-menu" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="global-search">
            <Search size={17} />
            <input placeholder="Search customers, bookings, or anything…" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="top-actions">
            <Link
              to="/book/$slug"
              params={{ slug: workspace.business.slug }}
              target="_blank"
              className="view-booking"
            >
              <ExternalLink size={15} /> Booking page
            </Link>
            <button className="icon-button">
              <Bell size={18} />
              <i />
            </button>
            <span className="top-avatar">ET</span>
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
          <SectionView section={section} onNavigate={setSection} />
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
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: workspace.business.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const todays = workspace.appointments.filter(
    (item) => item.date === today && item.status !== "cancelled",
  );
  const revenue = workspace.appointments
    .filter((item) => item.status !== "cancelled")
    .reduce(
      (sum, item) =>
        sum + (workspace.services.find((service) => service.id === item.serviceId)?.price ?? 0),
      0,
    );
  const chart = Array.from({ length: 7 }, (_, offset) => {
    const value = new Date();
    value.setDate(value.getDate() - (6 - offset));
    const date = value.toISOString().slice(0, 10);
    return {
      day: value.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      bookings: workspace.appointments.filter(
        (appointment) => appointment.date === date && appointment.status !== "cancelled",
      ).length,
    };
  });
  const completedSetup = [Boolean(workspace.business.name), workspace.services.length > 0, Object.values(workspace.business.hours).some((item) => item.enabled), workspace.staff.length > 0, Boolean(workspace.business.slug)].filter(Boolean).length;
  const activeAppointments = workspace.appointments.filter((item) => item.status !== "cancelled");
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
          label="New customers"
          value={String(workspace.customers.length)}
          trend="Authorized customer records"
          icon={Users}
        />
        <Metric
          label="Booked revenue"
          value={`$${revenue.toLocaleString()}`}
          trend="Across active appointments"
          icon={CircleDollarSign}
        />
        <Metric label="Confirmation rate" value={bookingRate} trend={activeAppointments.length ? "Across active bookings" : "No booking data yet"} icon={Activity} />
      </div>
      <div className="overview-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Booking activity</h2>
              <p>Confirmed bookings over the last 7 days</p>
            </div>
            <button className="date-filter">
              Last 7 days <ChevronDown size={14} />
            </button>
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
  const [weekStart, setWeekStart] = useState(() => { const date = new Date(); const weekday = date.getDay(); date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1)); date.setHours(12, 0, 0, 0); return date; });
  const [form, setForm] = useState({
    staffId: workspace.staff[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    start: "12:00",
    end: "13:00",
    reason: "Unavailable",
  });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const moveWeek = (offset: number) => setWeekStart((current) => { const date = new Date(current); date.setDate(date.getDate() + offset * 7); return date; });
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
        <button className="secondary-action" onClick={() => { const date = new Date(); const weekday = date.getDay(); date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1)); date.setHours(12, 0, 0, 0); setWeekStart(date); }}>Today</button>
        <div>
          <button onClick={() => moveWeek(-1)}>‹</button>
          <b>{weekLabel}</b>
          <button onClick={() => moveWeek(1)}>›</button>
        </div>
        <span>Week view</span>
      </div>
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
                          onClick={() => removeBlockedTime(item.id)}
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
            <h2>Upcoming blocked time</h2>
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
                <button onClick={() => removeBlockedTime(item.id)}>Remove</button>
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
  const { workspace, addAppointment, updateAppointment } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    customerId: workspace.customers[0]?.id ?? "",
    serviceId: workspace.services[0]?.id ?? "",
    staffId: workspace.staff[0]?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
  });
  const submit = async () => {
    const service = workspace.services.find((s) => s.id === form.serviceId);
    if (!service) return;
    const result = await addAppointment({
      ...form,
      duration: service.duration,
      status: "confirmed",
      source: "dashboard",
    });
    if (result.error) setError(result.error);
    else {
      setShowForm(false);
      setError("");
    }
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
      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="table-search">
            <Search size={16} />
            <input placeholder="Search bookings…" />
          </div>
          <button>
            All statuses <ChevronDown size={14} />
          </button>
          <button>
            This month <ChevronDown size={14} />
          </button>
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
          {[...workspace.appointments]
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
                      onChange={(e) =>
                        updateAppointment(item.id, { status: e.target.value as AppointmentStatus })
                      }
                      className={`status-select ${item.status}`}
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no-show">No-show</option>
                    </select>
                  </span>
                  <span>{item.source === "booking-page" ? "Booking page" : "Dashboard"}</span>
                  <button>
                    <MoreHorizontal size={17} />
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
          <button className="solid-action full" onClick={submit}>
            Create booking
          </button>
        </Modal>
      )}
    </>
  );
}

function Customers() {
  const { workspace, addCustomer, updateCustomer } = useAppStore();
  const [show, setShow] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "", tags: ["New"] });
  const selected = workspace.customers.find((customer) => customer.id === selectedId);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "", notes: "", tags: "" });
  const filtered = workspace.customers.filter((customer) =>
    `${customer.name} ${customer.email} ${customer.phone} ${customer.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const save = async () => {
    if (!form.name || !form.email) return;
    await addCustomer(form);
    setShow(false);
    setForm({ name: "", email: "", phone: "", notes: "", tags: ["New"] });
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
  };
  const saveProfile = () => {
    if (!selected || !draft.name) return;
    updateCustomer(selected.id, {
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
  };
  const exportCsv = () => {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Name", "Email", "Phone", "Tags", "Created", "Appointments", "Lifetime value"],
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
              sum +
              (workspace.services.find((service) => service.id === item.serviceId)?.price ?? 0),
            0,
          ),
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
          <button className="solid-action" onClick={() => setShow(true)}>
            <Plus size={16} />
            Add customer
          </button>
        }
      />
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
        </div>
        <div className="customer-grid">
          {filtered.map((customer) => {
            const appointments = workspace.appointments.filter(
              (item) => item.customerId === customer.id,
            );
            const invoices = workspace.invoices.filter(
              (item) => item.customerId === customer.id && item.status === "paid",
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
                      ${invoices.reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
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
          <button className="solid-action full" onClick={save}>
            Save customer
          </button>
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
                .filter((item) => item.status === "paid")
                .reduce((sum, item) => sum + item.amount, 0)
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
          <button className="solid-action full" onClick={saveProfile}>
            Save customer profile
          </button>
        </Modal>
      )}
    </>
  );
}

function Services() {
  const { workspace, addService, updateService } = useAppStore();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    duration: 60,
    price: 100,
    color: "#6d5dfc",
    active: true,
  });
  const save = () => {
    if (!form.name) return;
    addService(form);
    setShow(false);
  };
  return (
    <>
      <PageHeader
        title="Services"
        copy="Control what customers can book, how long it takes, and what it costs."
        action={
          <button className="solid-action" onClick={() => setShow(true)}>
            <Plus size={16} />
            Create service
          </button>
        }
      />
      <div className="service-grid">
        {workspace.services.map((service) => (
          <article className="service-card" key={service.id}>
            <div className="service-color" style={{ background: service.color }} />
            <div className="service-top">
              <span style={{ background: `${service.color}18`, color: service.color }}>
                <Sparkles size={18} />
              </span>
              <button>
                <MoreHorizontal size={18} />
              </button>
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
            </div>
            <div className="service-footer">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={service.active}
                  onChange={(e) => updateService(service.id, { active: e.target.checked })}
                />
                <i />
              </label>
              <span>{service.active ? "Bookable" : "Hidden"}</span>
            </div>
          </article>
        ))}
      </div>
      {show && (
        <Modal title="Create service" onClose={() => setShow(false)}>
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
              Duration
              <select
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              >
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
                <option value="90">90 minutes</option>
              </select>
            </label>
            <label>
              Price
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </label>
          </div>
          <button className="solid-action full" onClick={save}>
            Create service
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
              {item.status === "pending-approval" ? "View requirements" : "Configure in Lovable"}
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
  const { workspace } = useAppStore();
  const [selected, setSelected] = useState(workspace.customers[0]?.id);
  return (
    <>
      <PageHeader
        title="Messages"
        copy="One inbox for customer conversations and booking updates."
      />
      <div className="inbox-shell">
        <aside>
          <div className="table-search">
            <Search size={16} />
            <input placeholder="Search conversations" />
          </div>
          {workspace.customers.map((c, i) => (
            <button
              className={selected === c.id ? "active" : ""}
              onClick={() => setSelected(c.id)}
              key={c.id}
            >
              <span>{initials(c.name)}</span>
              <div>
                <b>{c.name}</b>
                <small>
                  {i === 0 ? "Thanks, that time works perfectly." : "No provider connected yet"}
                </small>
              </div>
              {i === 0 && <i>2</i>}
            </button>
          ))}
        </aside>
        <section>
          <div className="conversation-head">
            <span>{initials(workspace.customers.find((c) => c.id === selected)?.name ?? "")}</span>
            <div>
              <b>{workspace.customers.find((c) => c.id === selected)?.name}</b>
              <small>SMS unavailable · Twilio not configured</small>
            </div>
          </div>
          <div className="message-empty">
            <Inbox size={34} />
            <h3>Conversation preview</h3>
            <p>
              Connect Twilio in Lovable to send and receive real messages. Avello will never claim a
              message was delivered without a provider event.
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
  const { workspace, updateAiReceptionist, addCallLog, addCustomer, addAppointment } =
    useAppStore();
  const [settings, setSettings] = useState(workspace.aiReceptionist);
  const [show, setShow] = useState(false);
  const [result, setResult] = useState("");
  const [call, setCall] = useState({
    caller: "(555) 010-2020",
    name: "Taylor Reed",
    serviceId: workspace.services.find((service) => service.active)?.id ?? "",
    date: new Date().toISOString().slice(0, 10),
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
    const booked = await addAppointment({
      serviceId: service.id,
      staffId: staff.id,
      customerId: customer.id,
      date: call.date,
      time: call.time,
      duration: service.duration,
      status: "confirmed",
      source: "dashboard",
      notes: "Booked during a simulated AI receptionist call.",
    });
    if (booked.error) {
      setResult(booked.error);
      return;
    }
    addCallLog({
      caller: call.caller,
      durationSeconds: 96,
      outcome: "booked",
      ...(booked.appointment ? { appointmentId: booked.appointment.id } : {}),
      summary: `${settings.name} disclosed that it was an AI assistant, checked live availability, and booked ${service.name} with ${staff.name} for ${call.name} on ${formatDate(call.date)} at ${prettyTime(call.time)}.`,
    });
    setResult("Sandbox call completed and appointment created from real staff availability.");
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
            onClick={() => {
              updateAiReceptionist(settings);
              setResult("Receptionist settings saved in this preview workspace.");
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
            This creates a sandbox call log and a real preview appointment. It does not place a
            telephone call.
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
          <button style={{ background: workspace.business.accent }}>
            Book an appointment <ArrowRight size={15} />
          </button>
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
  const { workspace, addStaff } = useAppStore();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "staff" as const,
    active: true,
    serviceIds: [] as string[],
    weeklyHours: 40,
  });
  const save = () => {
    if (!form.name || !form.email) return;
    addStaff(form);
    setShow(false);
  };
  return (
    <>
      <PageHeader
        title="Team"
        copy="Assign services, roles, and working capacity without sharing owner access."
        action={
          <button className="solid-action" onClick={() => setShow(true)}>
            <UserPlus size={16} />
            Add team member
          </button>
        }
      />
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
          </article>
        ))}
      </div>
      {show && (
        <Modal title="Add team member" onClose={() => setShow(false)}>
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
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "staff" })}
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
            </label>
            <label>
              Weekly hours
              <input
                type="number"
                value={form.weeklyHours}
                onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })}
              />
            </label>
          </div>
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
          <button className="solid-action full" onClick={save}>
            Add member
          </button>
        </Modal>
      )}
    </>
  );
}

function Forms() {
  const { workspace, addForm, updateForm } = useAppStore();
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedFormId, setSelectedFormId] = useState(workspace.forms[0]?.id ?? "");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [fields, setFields] = useState([
    { id: "new_name", label: "Full name", type: "text" as const, required: true },
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
  const save = () => {
    if (!name) return;
    const form = addForm({
      name,
      description: "Custom customer intake form",
      active: true,
      fields,
    });
    setSelectedFormId(form.id);
    setShow(false);
    setName("");
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
            <button aria-label={`Select ${form.name}`} onClick={() => setSelectedFormId(form.id)}>
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
                  onChange={(e) => updateForm(form.id, { active: e.target.checked })}
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
        <Modal title="Build a form" onClose={() => setShow(false)}>
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
              </div>
            ))}
          </div>
          <button className="add-another" onClick={addField}>
            <Plus size={15} />
            Add field
          </button>
          <button className="solid-action full" onClick={save}>
            Save form
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
          {selectedSubmission.customerId && (
            <button className="secondary-action full">Associated CRM customer</button>
          )}
        </Modal>
      )}
    </>
  );
}

function Automations() {
  const { workspace, addWorkflow, updateWorkflow } = useAppStore();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: "",
    trigger: "New booking",
    action: "Create follow-up task",
    active: false,
  });
  const save = () => {
    if (!form.name) return;
    addWorkflow(form);
    setShow(false);
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
                  {workflow.trigger}
                </span>
                <i>
                  <ArrowRight size={15} />
                </i>
                <span>
                  <small>THEN</small>
                  {workflow.action}
                </span>
              </div>
              <p>
                {workflow.runs} recorded runs{" "}
                {workflow.lastRun ? `· Last run ${workflow.lastRun}` : "· No production executions"}
              </p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={workflow.active}
                onChange={(e) => updateWorkflow(workflow.id, { active: e.target.checked })}
              />
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
            Activating a preview workflow saves its configuration only. Provider actions are not
            executed until the production job runner, idempotency store, and verified email/SMS
            credentials exist.
          </p>
        </div>
      </div>
      {show && (
        <Modal title="Create automation" onClose={() => setShow(false)}>
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
              {[
                "New booking",
                "Booking cancelled",
                "Appointment completed",
                "New customer",
                "Form submitted",
                "Failed payment",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Action
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
            >
              {[
                "Create follow-up task",
                "Add customer tag",
                "Notify business owner",
                "Send confirmation email",
                "Send SMS reminder",
                "Send review request",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <button className="solid-action full" onClick={save}>
            Save as draft
          </button>
        </Modal>
      )}
    </>
  );
}

function Payments() {
  const { workspace, addInvoice, recordManualPayment } = useAppStore();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    customerId: workspace.customers[0]?.id ?? "",
    amount: 0,
    status: "draft" as const,
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  });
  const total = workspace.invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const paid = workspace.invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const save = async () => {
    if (!form.customerId || !form.amount) return;
    await addInvoice(form);
    setShow(false);
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
          label="Total invoiced"
          value={`$${total.toLocaleString()}`}
          trend="Authorized invoice records"
          icon={FileText}
        />
        <Metric
          label="Collected"
          value={`$${paid.toLocaleString()}`}
          trend={`${total ? Math.round((paid / total) * 100) : 0}% collection rate`}
          icon={CircleDollarSign}
        />
        <Metric
          label="Outstanding"
          value={`$${(total - paid).toLocaleString()}`}
          trend="Sent and overdue"
          icon={Clock3}
        />
        <Metric label="Stripe status" value="Offline" trend="No payment claims" icon={CreditCard} />
      </div>
      <div className="panel table-panel">
        <div className="table-toolbar">
          <b className="toolbar-title">Invoices</b>
          <button>
            All statuses <ChevronDown size={14} />
          </button>
        </div>
        <div className="invoice-table">
          <div className="invoice-row header">
            <span>Invoice</span>
            <span>Customer</span>
            <span>Due</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {workspace.invoices.map((invoice) => (
            <div className="invoice-row" key={invoice.id}>
              <span>
                <b>{invoice.number}</b>
                <small>{formatDate(invoice.createdAt.slice(0, 10))}</small>
              </span>
              <span>{workspace.customers.find((c) => c.id === invoice.customerId)?.name}</span>
              <span>{formatDate(invoice.dueDate)}</span>
              <span>
                <b>${invoice.amount.toLocaleString()}</b>
              </span>
              <span className={`invoice-status ${invoice.status}`}>{invoice.status}{invoice.status !== "paid" && invoice.status !== "void" && <button onClick={() => void recordManualPayment(invoice.id, invoice.amount)}>Record paid</button>}</span>
            </div>
          ))}
        </div>
      </div>
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
          <button className="solid-action full" onClick={save}>
            Save draft invoice
          </button>
        </Modal>
      )}
    </>
  );
}

function Analytics() {
  const { workspace } = useAppStore();
  const completed = workspace.appointments.filter((a) => a.status === "completed");
  const active = workspace.appointments.filter((a) => a.status !== "cancelled");
  const revenue = workspace.invoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const serviceCounts = workspace.services.map((service) => ({
    name: service.name,
    count: workspace.appointments.filter(
      (a) => a.serviceId === service.id && a.status !== "cancelled",
    ).length,
  }));
  const max = Math.max(1, ...serviceCounts.map((item) => item.count));
  return (
    <>
      <PageHeader
        title="Analytics"
        copy="Metrics are calculated only from workspace records—no fabricated production data."
        action={
          <button className="secondary-action">
            <FileText size={15} />
            Export CSV
          </button>
        }
      />
      <div className="metric-grid">
        <Metric
          label="Total bookings"
          value={String(active.length)}
          trend="Excludes cancelled"
          icon={CalendarDays}
        />
        <Metric
          label="Completed"
          value={String(completed.length)}
          trend={`${active.length ? Math.round((completed.length / active.length) * 100) : 0}% completion rate`}
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
          value={String(
            workspace.customers.filter(
              (c) => workspace.appointments.filter((a) => a.customerId === c.id).length > 1,
            ).length,
          )}
          trend="More than one booking"
          icon={Users}
        />
      </div>
      <div className="analytics-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Services by booking volume</h2>
              <p>Actual non-cancelled appointments</p>
            </div>
          </div>
          <div className="service-bars">
            {serviceCounts.map((item) => (
              <div key={item.name}>
                <span>{item.name}</span>
                <div>
                  <i style={{ width: `${(item.count / max) * 100}%` }} />
                </div>
                <b>{item.count}</b>
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
          {["booking-page", "dashboard"].map((source) => {
            const count = workspace.appointments.filter((a) => a.source === source).length;
            return (
              <div className="source-row" key={source}>
                <span>{source === "booking-page" ? "Public booking page" : "Dashboard"}</span>
                <b>{count}</b>
                <i
                  style={{
                    width: `${workspace.appointments.length ? (count / workspace.appointments.length) * 100 : 0}%`,
                  }}
                />
              </div>
            );
          })}
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
  const save = () => updateBusiness(business);
  return (
    <>
      <PageHeader
        title="Business settings"
        copy="Manage the details customers see across your booking experience."
      />
      <div className="settings-layout">
        <aside>
          <button className="active">Business profile</button>
          <button>Hours & availability</button>
          <button>Team & permissions</button>
          <button>Booking policies</button>
          <button>Branding</button>
          <button>Billing</button>
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
            Booking page URL
            <div className="input-prefix">
              <span>avello.app/book/</span>
              <input
                value={business.slug}
                onChange={(e) =>
                  setBusiness({
                    ...business,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                  })
                }
              />
            </div>
          </label>
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
              onChange={(e) => setBusiness({ ...business, address: e.target.value })}
            />
          </label>
          <div className="settings-actions">
            <button className="solid-action" onClick={save}>
              Save changes
            </button>
          </div>
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
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={onClose}>
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
