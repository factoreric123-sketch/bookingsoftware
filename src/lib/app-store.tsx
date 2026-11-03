import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Service = { id: string; name: string; description: string; duration: number; price: number; color: string; active: boolean };
export type Customer = { id: string; name: string; email: string; phone: string; notes: string; tags: string[]; createdAt: string };
export type AppointmentStatus = "confirmed" | "pending" | "completed" | "cancelled" | "no-show";
export type Appointment = { id: string; serviceId: string; customerId: string; date: string; time: string; duration: number; status: AppointmentStatus; source: "dashboard" | "booking-page"; notes?: string; createdAt: string; manageToken: string };
export type Business = { id: string; name: string; slug: string; industry: string; email: string; phone: string; address: string; timezone: string; accent: string; setupComplete: boolean; hours: Record<string, { open: string; close: string; enabled: boolean }> };
export type Integration = { id: string; name: string; description: string; status: "connected" | "not-configured" | "pending-approval"; category: string };
export type Staff = { id: string; name: string; email: string; role: "owner" | "manager" | "staff"; active: boolean; serviceIds: string[]; weeklyHours: number };
export type FormField = { id: string; label: string; type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox"; required: boolean; options?: string[] };
export type BusinessForm = { id: string; name: string; description: string; active: boolean; fields: FormField[]; submissions: number; createdAt: string };
export type FormSubmission = { id: string; formId: string; customerId?: string; answers: Record<string, string | boolean>; submittedAt: string };
export type Workflow = { id: string; name: string; trigger: string; action: string; active: boolean; runs: number; lastRun?: string };
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";
export type Invoice = { id: string; customerId: string; number: string; amount: number; status: InvoiceStatus; dueDate: string; createdAt: string };
export type Workspace = { business: Business; services: Service[]; customers: Customer[]; appointments: Appointment[]; integrations: Integration[]; staff: Staff[]; forms: BusinessForm[]; formSubmissions: FormSubmission[]; workflows: Workflow[]; invoices: Invoice[] };

const STORAGE_KEY = "avello.phase1.workspace.v1";
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const defaultHours = Object.fromEntries(days.map((day, index) => [day, { open: "09:00", close: "17:00", enabled: index < 5 }])) as Business["hours"];

export const seedWorkspace: Workspace = {
  business: { id: "biz_demo", name: "Northstar Studio", slug: "northstar-studio", industry: "Professional services", email: "hello@northstar.example", phone: "(555) 014-0184", address: "128 Market Street, Brooklyn, NY", timezone: "America/New_York", accent: "#6d5dfc", setupComplete: true, hours: defaultHours },
  services: [
    { id: "svc_strategy", name: "Strategy session", description: "A focused planning session for your next project.", duration: 60, price: 150, color: "#6d5dfc", active: true },
    { id: "svc_consult", name: "Quick consultation", description: "A 30-minute introduction and needs assessment.", duration: 30, price: 75, color: "#27a57a", active: true },
    { id: "svc_review", name: "Project review", description: "Detailed review with recommendations and next steps.", duration: 90, price: 225, color: "#e38b36", active: true },
  ],
  customers: [
    { id: "cus_maya", name: "Maya Thompson", email: "maya@example.com", phone: "(555) 016-2201", notes: "Prefers afternoon appointments.", tags: ["Repeat", "VIP"], createdAt: "2026-09-12" },
    { id: "cus_jordan", name: "Jordan Lee", email: "jordan@example.com", phone: "(555) 016-4388", notes: "", tags: ["New lead"], createdAt: "2026-10-20" },
    { id: "cus_avery", name: "Avery Morgan", email: "avery@example.com", phone: "(555) 017-9914", notes: "Referred by Maya.", tags: ["Referral"], createdAt: "2026-10-28" },
  ],
  appointments: [
    { id: "apt_1", serviceId: "svc_strategy", customerId: "cus_maya", date: "2026-11-03", time: "10:00", duration: 60, status: "confirmed", source: "booking-page", createdAt: "2026-10-30T12:00:00Z", manageToken: "manage_maya_2026" },
    { id: "apt_2", serviceId: "svc_consult", customerId: "cus_jordan", date: "2026-11-03", time: "13:30", duration: 30, status: "confirmed", source: "booking-page", createdAt: "2026-11-01T16:00:00Z", manageToken: "manage_jordan_2026" },
    { id: "apt_3", serviceId: "svc_review", customerId: "cus_avery", date: "2026-11-04", time: "11:00", duration: 90, status: "pending", source: "dashboard", createdAt: "2026-11-02T09:00:00Z", manageToken: "manage_avery_2026" },
  ],
  integrations: [
    { id: "google", name: "Google Calendar", description: "Two-way calendar availability and event sync.", status: "not-configured", category: "Calendar" },
    { id: "stripe", name: "Stripe", description: "Deposits, payments, subscriptions, and invoices.", status: "not-configured", category: "Payments" },
    { id: "twilio", name: "Twilio", description: "Two-way SMS and dedicated business numbers.", status: "not-configured", category: "Communication" },
    { id: "voice", name: "AI Voice", description: "Real-time AI receptionist and call routing.", status: "not-configured", category: "AI" },
    { id: "google-booking", name: "Google Book Online", description: "Official Reserve with Google partner connection.", status: "pending-approval", category: "Booking" },
  ],
  staff: [
    { id: "staff_owner", name: "Eric Thompson", email: "eric@northstar.example", role: "owner", active: true, serviceIds: ["svc_strategy", "svc_consult", "svc_review"], weeklyHours: 40 },
    { id: "staff_morgan", name: "Morgan Chen", email: "morgan@northstar.example", role: "staff", active: true, serviceIds: ["svc_consult", "svc_review"], weeklyHours: 32 },
  ],
  forms: [
    { id: "form_intake", name: "New client intake", description: "Collect goals and project context before the first appointment.", active: true, submissions: 12, createdAt: "2026-10-12", fields: [{ id: "fld_name", label: "Full name", type: "text", required: true }, { id: "fld_email", label: "Email", type: "email", required: true }, { id: "fld_goals", label: "What would you like to accomplish?", type: "textarea", required: true }] },
  ],
  formSubmissions: [],
  workflows: [
    { id: "flow_confirmation", name: "Booking confirmation", trigger: "New booking", action: "Send confirmation email", active: false, runs: 0 },
    { id: "flow_reminder", name: "24-hour reminder", trigger: "Appointment approaching", action: "Send SMS reminder", active: false, runs: 0 },
    { id: "flow_review", name: "Review request", trigger: "Appointment completed", action: "Send review request next day", active: false, runs: 0 },
  ],
  invoices: [
    { id: "inv_1", customerId: "cus_maya", number: "INV-1001", amount: 150, status: "paid", dueDate: "2026-10-22", createdAt: "2026-10-15" },
    { id: "inv_2", customerId: "cus_avery", number: "INV-1002", amount: 225, status: "sent", dueDate: "2026-11-10", createdAt: "2026-11-01" },
  ],
};

type Store = {
  workspace: Workspace;
  isPreview: boolean;
  updateBusiness: (patch: Partial<Business>) => void;
  addService: (service: Omit<Service, "id">) => Service;
  updateService: (id: string, patch: Partial<Service>) => void;
  addCustomer: (customer: Omit<Customer, "id" | "createdAt">) => Customer;
  addAppointment: (appointment: Omit<Appointment, "id" | "createdAt" | "manageToken">) => { appointment?: Appointment; error?: string };
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  rescheduleAppointment: (id: string, date: string, time: string) => { appointment?: Appointment; error?: string };
  addStaff: (staff: Omit<Staff, "id">) => Staff;
  addForm: (form: Omit<BusinessForm, "id" | "createdAt" | "submissions">) => BusinessForm;
  updateForm: (id: string, patch: Partial<BusinessForm>) => void;
  submitForm: (formId: string, answers: Record<string, string | boolean>) => FormSubmission;
  addWorkflow: (workflow: Omit<Workflow, "id" | "runs">) => Workflow;
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void;
  addInvoice: (invoice: Omit<Invoice, "id" | "number" | "createdAt">) => Invoice;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  resetDemo: () => void;
};

const AppStore = createContext<Store | null>(null);
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const minutes = (time: string) => { const [h, m] = time.split(":").map(Number); return h * 60 + m; };

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(seedWorkspace);
  useEffect(() => { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { try { const parsed = JSON.parse(saved) as Partial<Workspace>; setWorkspace({ ...seedWorkspace, ...parsed, business: { ...seedWorkspace.business, ...parsed.business }, appointments: (parsed.appointments ?? seedWorkspace.appointments).map((appointment) => ({ ...appointment, manageToken: appointment.manageToken ?? uid("manage") })), staff: parsed.staff ?? seedWorkspace.staff, forms: parsed.forms ?? seedWorkspace.forms, formSubmissions: parsed.formSubmissions ?? [], workflows: parsed.workflows ?? seedWorkspace.workflows, invoices: parsed.invoices ?? seedWorkspace.invoices }); } catch { localStorage.removeItem(STORAGE_KEY); } } }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); }, [workspace]);

  const store = useMemo<Store>(() => ({
    workspace,
    isPreview: true,
    updateBusiness: (patch) => setWorkspace((current) => ({ ...current, business: { ...current.business, ...patch } })),
    addService: (input) => { const service = { ...input, id: uid("svc") }; setWorkspace((current) => ({ ...current, services: [...current.services, service] })); return service; },
    updateService: (id, patch) => setWorkspace((current) => ({ ...current, services: current.services.map((service) => service.id === id ? { ...service, ...patch } : service) })),
    addCustomer: (input) => { const customer = { ...input, id: uid("cus"), createdAt: new Date().toISOString() }; setWorkspace((current) => ({ ...current, customers: [...current.customers, customer] })); return customer; },
    addAppointment: (input) => {
      const start = minutes(input.time); const end = start + input.duration;
      const conflict = workspace.appointments.some((item) => item.date === input.date && item.status !== "cancelled" && start < minutes(item.time) + item.duration && end > minutes(item.time));
      if (conflict) return { error: "That time is no longer available. Choose another time." };
      const appointment = { ...input, id: uid("apt"), createdAt: new Date().toISOString(), manageToken: uid("manage") };
      setWorkspace((current) => ({ ...current, appointments: [...current.appointments, appointment] })); return { appointment };
    },
    updateAppointment: (id, patch) => setWorkspace((current) => ({ ...current, appointments: current.appointments.map((item) => item.id === id ? { ...item, ...patch } : item) })),
    rescheduleAppointment: (id, date, time) => {
      const current = workspace.appointments.find((appointment) => appointment.id === id); if (!current) return { error: "Appointment not found." };
      const start = minutes(time); const end = start + current.duration;
      const conflict = workspace.appointments.some((item) => item.id !== id && item.date === date && item.status !== "cancelled" && start < minutes(item.time) + item.duration && end > minutes(item.time));
      if (conflict) return { error: "That time is no longer available. Choose another time." };
      const appointment = { ...current, date, time, status: "confirmed" as const };
      setWorkspace((state) => ({ ...state, appointments: state.appointments.map((item) => item.id === id ? appointment : item) })); return { appointment };
    },
    addStaff: (input) => { const staff = { ...input, id: uid("staff") }; setWorkspace((current) => ({ ...current, staff: [...current.staff, staff] })); return staff; },
    addForm: (input) => { const form = { ...input, id: uid("form"), createdAt: new Date().toISOString(), submissions: 0 }; setWorkspace((current) => ({ ...current, forms: [...current.forms, form] })); return form; },
    updateForm: (id, patch) => setWorkspace((current) => ({ ...current, forms: current.forms.map((form) => form.id === id ? { ...form, ...patch } : form) })),
    submitForm: (formId, answers) => {
      const email = Object.entries(answers).find(([key]) => key.toLowerCase().includes("email"))?.[1];
      const name = Object.entries(answers).find(([key]) => key.toLowerCase().includes("name"))?.[1];
      const existing = typeof email === "string" ? workspace.customers.find((customer) => customer.email.toLowerCase() === email.toLowerCase()) : undefined;
      const customer = existing ?? (typeof email === "string" && typeof name === "string" ? { id: uid("cus"), name, email, phone: "", notes: "Created from form submission.", tags: ["Form lead"], createdAt: new Date().toISOString() } : undefined);
      const submission = { id: uid("submission"), formId, customerId: customer?.id, answers, submittedAt: new Date().toISOString() };
      setWorkspace((current) => ({ ...current, customers: customer && !existing ? [...current.customers, customer] : current.customers, formSubmissions: [...current.formSubmissions, submission], forms: current.forms.map((form) => form.id === formId ? { ...form, submissions: form.submissions + 1 } : form) }));
      return submission;
    },
    addWorkflow: (input) => { const workflow = { ...input, id: uid("flow"), runs: 0 }; setWorkspace((current) => ({ ...current, workflows: [...current.workflows, workflow] })); return workflow; },
    updateWorkflow: (id, patch) => setWorkspace((current) => ({ ...current, workflows: current.workflows.map((workflow) => workflow.id === id ? { ...workflow, ...patch } : workflow) })),
    addInvoice: (input) => { const invoice = { ...input, id: uid("inv"), number: `INV-${1000 + workspace.invoices.length + 1}`, createdAt: new Date().toISOString() }; setWorkspace((current) => ({ ...current, invoices: [...current.invoices, invoice] })); return invoice; },
    updateInvoice: (id, patch) => setWorkspace((current) => ({ ...current, invoices: current.invoices.map((invoice) => invoice.id === id ? { ...invoice, ...patch } : invoice) })),
    resetDemo: () => setWorkspace(seedWorkspace),
  }), [workspace]);
  return <AppStore.Provider value={store}>{children}</AppStore.Provider>;
}

export function useAppStore() { const value = useContext(AppStore); if (!value) throw new Error("useAppStore must be used inside AppStoreProvider"); return value; }

export function availableSlots(workspace: Workspace, serviceId: string, date: string, excludeAppointmentId?: string) {
  const service = workspace.services.find((item) => item.id === serviceId); if (!service) return [];
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const hours = workspace.business.hours[day]; if (!hours?.enabled) return [];
  const slots: string[] = [];
  for (let cursor = minutes(hours.open); cursor + service.duration <= minutes(hours.close); cursor += 30) {
    const conflict = workspace.appointments.some((item) => item.id !== excludeAppointmentId && item.date === date && item.status !== "cancelled" && cursor < minutes(item.time) + item.duration && cursor + service.duration > minutes(item.time));
    if (!conflict) slots.push(`${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`);
  }
  return slots;
}
