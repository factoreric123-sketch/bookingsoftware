import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { invokeBackend } from "../integrations/supabase/backend";
import { useAuth } from "./auth-context";

export type Service = { id: string; name: string; description: string; duration: number; price: number; color: string; active: boolean };
export type Customer = { id: string; name: string; email: string; phone: string; notes: string; tags: string[]; createdAt: string };
export type AppointmentStatus = "confirmed" | "pending" | "completed" | "cancelled" | "no-show";
export type Appointment = { id: string; serviceId: string; customerId: string; staffId?: string; date: string; time: string; duration: number; status: AppointmentStatus; source: "dashboard" | "booking-page"; notes?: string; createdAt: string; manageToken: string };
export type Business = { id: string; name: string; slug: string; industry: string; email: string; phone: string; address: string; timezone: string; currency?: string; defaultLocationId?: string; accent: string; setupComplete: boolean; hours: Record<string, { open: string; close: string; enabled: boolean }> };
export type Integration = { id: string; name: string; description: string; status: "connected" | "not-configured" | "pending-approval"; category: string };
export type Staff = { id: string; name: string; email: string; role: "owner" | "manager" | "staff"; active: boolean; serviceIds: string[]; weeklyHours: number };
export type FormField = { id: string; label: string; type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox"; required: boolean; options?: string[]; customerMapping?: "full_name" | "email" | "phone_e164" | "address" | "company_name" };
export type BusinessForm = { id: string; name: string; description: string; active: boolean; fields: FormField[]; submissions: number; createdAt: string };
export type FormSubmission = { id: string; formId: string; customerId?: string; answers: Record<string, string | boolean>; submittedAt: string };
export type Workflow = { id: string; name: string; trigger: string; action: string; active: boolean; runs: number; lastRun?: string };
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";
export type Invoice = { id: string; customerId: string; number: string; amount: number; status: InvoiceStatus; dueDate: string; createdAt: string };
export type AiReceptionist = { name: string; greeting: string; transferPhone: string; voice: string; afterHours: "take-message" | "offer-callback"; recordingEnabled: boolean; disclosureEnabled: boolean };
export type CallLog = { id: string; caller: string; startedAt: string; durationSeconds: number; outcome: "booked" | "message" | "transferred"; summary: string; appointmentId?: string; sandbox: true };
export type BlockedTime = { id: string; staffId?: string; date: string; start: string; end: string; reason: string; createdAt: string };
export type Workspace = { business: Business; memberRole: "owner" | "manager" | "staff"; memberPermissions: Record<string, boolean>; services: Service[]; customers: Customer[]; appointments: Appointment[]; blockedTimes: BlockedTime[]; integrations: Integration[]; staff: Staff[]; forms: BusinessForm[]; formSubmissions: FormSubmission[]; workflows: Workflow[]; invoices: Invoice[]; aiReceptionist: AiReceptionist; callLogs: CallLog[] };

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const defaultHours = Object.fromEntries(days.map((day, index) => [day, { open: "09:00", close: "17:00", enabled: index < 5 }])) as Business["hours"];

export const seedWorkspace: Workspace = {
  memberRole: "owner",
  memberPermissions: {},
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
    { id: "apt_1", serviceId: "svc_strategy", customerId: "cus_maya", staffId: "staff_owner", date: "2026-11-03", time: "10:00", duration: 60, status: "confirmed", source: "booking-page", createdAt: "2026-10-30T12:00:00Z", manageToken: "manage_maya_2026" },
    { id: "apt_2", serviceId: "svc_consult", customerId: "cus_jordan", staffId: "staff_morgan", date: "2026-11-03", time: "13:30", duration: 30, status: "confirmed", source: "booking-page", createdAt: "2026-11-01T16:00:00Z", manageToken: "manage_jordan_2026" },
    { id: "apt_3", serviceId: "svc_review", customerId: "cus_avery", staffId: "staff_morgan", date: "2026-11-04", time: "11:00", duration: 90, status: "pending", source: "dashboard", createdAt: "2026-11-02T09:00:00Z", manageToken: "manage_avery_2026" },
  ],
  blockedTimes: [],
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
    { id: "form_intake", name: "New client intake", description: "Collect goals and project context before the first appointment.", active: true, submissions: 0, createdAt: "2026-10-12", fields: [{ id: "fld_name", label: "Full name", type: "text", required: true }, { id: "fld_email", label: "Email", type: "email", required: true }, { id: "fld_goals", label: "What would you like to accomplish?", type: "textarea", required: true }] },
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
  aiReceptionist: { name: "Ava", greeting: "Thanks for calling Northstar Studio. I’m Ava, the virtual receptionist. How can I help?", transferPhone: "", voice: "Warm and professional", afterHours: "take-message", recordingEnabled: false, disclosureEnabled: true },
  callLogs: [],
};

type Store = {
  workspace: Workspace;
  isPreview: boolean;
  isLoading: boolean;
  loadError: string;
  updateBusiness: (patch: Partial<Business>) => Promise<void>;
  addService: (service: Omit<Service, "id">) => Promise<Service>;
  updateService: (id: string, patch: Partial<Service>) => Promise<void>;
  addCustomer: (customer: Omit<Customer, "id" | "createdAt">) => Promise<Customer>;
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>;
  mergeCustomer: (sourceId: string, destinationId: string) => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, "id" | "createdAt" | "manageToken">) => Promise<{ appointment?: Appointment; error?: string }>;
  updateAppointment: (id: string, patch: Partial<Appointment>) => Promise<void>;
  addBlockedTime: (block: Omit<BlockedTime, "id" | "createdAt">) => Promise<{ block?: BlockedTime; error?: string }>;
  removeBlockedTime: (id: string) => Promise<void>;
  addStaff: (staff: Omit<Staff, "id">) => Promise<Staff>;
  addForm: (form: Omit<BusinessForm, "id" | "createdAt" | "submissions">) => Promise<BusinessForm>;
  updateForm: (id: string, patch: Partial<BusinessForm>) => Promise<void>;
  addWorkflow: (workflow: Omit<Workflow, "id" | "runs">) => Promise<Workflow>;
  addInvoice: (invoice: Omit<Invoice, "id" | "number" | "createdAt">) => Promise<Invoice>;
  recordManualPayment: (invoiceId: string, amount: number) => Promise<void>;
  updateAiReceptionist: (patch: Partial<AiReceptionist>) => Promise<void>;
  addCallLog: (log: Omit<CallLog, "id" | "startedAt" | "sandbox"> & { customerId?: string }) => Promise<CallLog>;
};

const AppStore = createContext<Store | null>(null);
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
const minutes = (time: string) => { const [h = 0, m = 0] = time.split(":").map(Number); return h * 60 + m; };

function emptyWorkspace(): Workspace {
  return {
    memberRole: "staff",
    memberPermissions: {},
    business: { id: "", name: "", slug: "", industry: "", email: "", phone: "", address: "", timezone: "America/New_York", accent: "#6d5dfc", setupComplete: false, hours: defaultHours },
    services: [], customers: [], appointments: [], blockedTimes: [], integrations: [], staff: [], forms: [], formSubmissions: [], workflows: [], invoices: [],
    aiReceptionist: { name: "Ava", greeting: "", transferPhone: "", voice: "Warm and professional", afterHours: "take-message", recordingEnabled: false, disclosureEnabled: true },
    callLogs: [],
  };
}

function zonedParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

function mapSnapshot(snapshot: any): Workspace {
  const business = snapshot.business ?? {};
  const location = snapshot.locations?.find((item: any) => item.id === business.default_location_id) ?? snapshot.locations?.[0] ?? {};
  const hourMap = Object.fromEntries(days.map((day, index) => {
    const row = snapshot.business_hours?.find((item: any) => item.location_id === location.id && item.iso_weekday === index + 1);
    return [day, { open: row?.opens_at?.slice(0, 5) ?? "09:00", close: row?.closes_at?.slice(0, 5) ?? "17:00", enabled: Boolean(row?.active) }];
  })) as Business["hours"];
  const services = (snapshot.services ?? []).map((item: any): Service => ({ id: item.id, name: item.name, description: item.description, duration: item.duration_minutes, price: Number(item.price_minor) / 100, color: item.color, active: item.active }));
  const staffServices = snapshot.staff_services ?? [];
  const staff = (snapshot.staff ?? []).map((item: any): Staff => ({ id: item.id, name: item.display_name, email: item.email ?? "", role: (snapshot.team_members ?? []).find((member: any) => member.user_id === item.user_id && item.user_id)?.role ?? "staff", active: item.active, serviceIds: staffServices.filter((link: any) => link.staff_id === item.id).map((link: any) => link.service_id), weeklyHours: Math.round((item.weekly_capacity_minutes ?? 2400) / 60) }));
  const customers = (snapshot.customers ?? []).filter((item: any) => item.status !== "merged").map((item: any): Customer => { const assignments = (snapshot.customer_tag_assignments ?? []).filter((assignment: any) => assignment.customer_id === item.id); return { id: item.id, name: item.full_name, email: item.email ?? "", phone: item.phone_e164 ?? "", notes: (snapshot.customer_notes ?? []).find((note: any) => note.customer_id === item.id)?.body ?? "", tags: assignments.map((assignment: any) => (snapshot.customer_tags ?? []).find((tag: any) => tag.id === assignment.tag_id)?.name).filter(Boolean), createdAt: item.created_at }; });
  const appointments: Appointment[] = [];
  for (const session of snapshot.sessions ?? []) {
    const parts = zonedParts(session.starts_at, business.timezone ?? "America/New_York");
    for (const item of session.appointments ?? []) appointments.push({ id: item.id, serviceId: session.primary_service_id, customerId: item.customer_id, staffId: session.staff_id ?? undefined, date: parts.date, time: parts.time, duration: Math.max(5, Math.round((new Date(session.ends_at).getTime() - new Date(session.starts_at).getTime()) / 60000)), status: item.status === "no_show" ? "no-show" : item.status, source: item.source === "booking_page" ? "booking-page" : "dashboard", notes: item.customer_notes ?? "", createdAt: item.created_at, manageToken: "" });
  }
  const blockedTimes = (snapshot.blocked_times ?? []).map((item: any): BlockedTime => { const start = zonedParts(item.starts_at, business.timezone ?? "America/New_York"); const end = zonedParts(item.ends_at, business.timezone ?? "America/New_York"); return { id: item.id, staffId: item.staff_id ?? undefined, date: start.date, start: start.time, end: end.time, reason: item.reason, createdAt: item.created_at }; });
  return {
    memberRole: snapshot.membership?.role ?? "staff",
    memberPermissions: Object.fromEntries(Object.entries(snapshot.membership ?? {}).filter(([key]) => key.startsWith("can_")).map(([key, value]) => [key, value === true])),
    business: { id: business.id, name: business.name, slug: business.slug, industry: business.industry, email: business.email ?? "", phone: business.phone_e164 ?? "", address: [location.address_line1, location.address_line2, location.city, location.region, location.postal_code].filter(Boolean).join(", "), timezone: business.timezone, currency: business.currency, defaultLocationId: location.id, accent: business.accent_color, setupComplete: Boolean(business.setup_completed_at), hours: hourMap },
    services, customers, appointments, blockedTimes, staff,
    integrations: (snapshot.integrations ?? []).map((item: any): Integration => ({ id: item.id, name: String(item.provider).replaceAll("_", " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase()), description: "Provider connection", status: item.status === "connected" ? "connected" : item.status === "pending_approval" ? "pending-approval" : "not-configured", category: "Integration" })),
    forms: (snapshot.forms ?? []).map((item: any): BusinessForm => ({ id: item.id, name: item.name, description: item.description, active: item.status === "published", fields: (snapshot.form_fields ?? []).filter((field: any) => field.form_version_id === item.active_version_id).map((field: any): FormField => ({ id: field.id, label: field.label, type: field.field_type === "name" ? "text" : field.field_type, required: field.required, options: (field.options ?? []).map((option: any) => option.label), customerMapping: field.customer_mapping ?? undefined })), submissions: (snapshot.form_submissions ?? []).filter((submission: any) => submission.form_id === item.id).length, createdAt: item.created_at })),
    formSubmissions: (snapshot.form_submissions ?? []).map((submission: any): FormSubmission => ({ id: submission.id, formId: submission.form_id, customerId: submission.customer_id ?? undefined, answers: Object.fromEntries((snapshot.form_submission_answers ?? []).filter((answer: any) => answer.submission_id === submission.id).map((answer: any) => [answer.form_field_id, answer.value])), submittedAt: submission.submitted_at })),
    workflows: (snapshot.workflows ?? []).map((item: any): Workflow => ({ id: item.id, name: item.name, trigger: item.trigger_type, action: (snapshot.workflow_steps ?? []).find((step: any) => step.workflow_id === item.id)?.action_type ?? "Unconfigured", active: item.active, runs: 0 })),
    invoices: (snapshot.invoices ?? []).map((item: any): Invoice => ({ id: item.id, customerId: item.customer_id, number: item.number, amount: Number(item.total_minor) / 100, status: item.status === "open" ? "sent" : item.status, dueDate: item.due_date ?? "", createdAt: item.created_at })),
    aiReceptionist: snapshot.ai_settings ? { name: snapshot.ai_settings.assistant_name, greeting: snapshot.ai_settings.greeting, transferPhone: snapshot.ai_settings.transfer_phone_e164 ?? "", voice: snapshot.ai_settings.voice, afterHours: snapshot.ai_settings.after_hours_behavior === "offer_callback" ? "offer-callback" : "take-message", recordingEnabled: snapshot.ai_settings.recording_enabled, disclosureEnabled: snapshot.ai_settings.disclosure_enabled } : emptyWorkspace().aiReceptionist,
    callLogs: (snapshot.calls ?? []).map((item: any): CallLog => ({ id: item.id, caller: item.caller_e164, startedAt: item.started_at, durationSeconds: item.duration_seconds ?? 0, outcome: item.outcome === "transferred" ? "transferred" : item.outcome === "booked" ? "booked" : "message", summary: item.summary ?? "", appointmentId: item.appointment_id ?? undefined, sandbox: true })),
  };
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace>(() => emptyWorkspace());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let active = true;
    if (!user) { setWorkspace(emptyWorkspace()); setLoadError(""); setIsLoading(false); return () => { active = false; }; }
    setIsLoading(true);
    setLoadError("");
    invokeBackend<Record<string, any>>("get_workspace_snapshot", {}).then((snapshot) => {
      if (active) setWorkspace(mapSnapshot(snapshot));
    }).catch((error) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Unable to load workspace.");
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [user]);

  const store = useMemo<Store>(() => ({
    workspace,
    isPreview: false,
    isLoading,
    loadError,
    updateBusiness: async (patch) => { await invokeBackend("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "business", p_operation: "update", p_id: workspace.business.id, p_values: { name: patch.name, industry: patch.industry, email: patch.email, phone_e164: patch.phone } }); setWorkspace((current) => ({ ...current, business: { ...current.business, ...patch } })); },
    addService: async (input) => { const service = { ...input, id: crypto.randomUUID() }; await invokeBackend("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "service", p_operation: "insert", p_id: service.id, p_values: { name: service.name, description: service.description, duration_minutes: service.duration, price_minor: Math.round(service.price * 100), currency: workspace.business.currency ?? "USD", color: service.color, active: service.active, location_id: workspace.business.defaultLocationId, staff_ids: workspace.staff.filter((member) => member.active).map((member) => member.id) } }); setWorkspace((current) => ({ ...current, services: [...current.services, service] })); return service; },
    updateService: async (id, patch) => { await invokeBackend("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "service", p_operation: "update", p_id: id, p_values: { name: patch.name, description: patch.description, duration_minutes: patch.duration, price_minor: patch.price === undefined ? undefined : Math.round(patch.price * 100), color: patch.color, active: patch.active } }); setWorkspace((current) => ({ ...current, services: current.services.map((service) => service.id === id ? { ...service, ...patch } : service) })); },
    addCustomer: async (input) => { const customer = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }; await invokeBackend("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "customer", p_operation: "insert", p_id: customer.id, p_values: { full_name: customer.name, email: customer.email || null, phone_e164: customer.phone || null, source: "dashboard" } }); setWorkspace((current) => ({ ...current, customers: [...current.customers, { ...customer, notes: "", tags: [] }] })); if (customer.notes || customer.tags.length) { try { await invokeBackend("save_customer_profile", { p_business_id: workspace.business.id, p_customer_id: customer.id, p_note: customer.notes, p_tags: customer.tags }); } catch (caught) { throw new Error(`Customer was created, but notes or tags could not be saved: ${caught instanceof Error ? caught.message : "Unknown error"}`); } } setWorkspace((current) => ({ ...current, customers: current.customers.map((item) => item.id === customer.id ? customer : item) })); return customer; },
    updateCustomer: async (id, patch) => { await invokeBackend("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "customer", p_operation: "update", p_id: id, p_values: { full_name: patch.name, email: patch.email, phone_e164: patch.phone } }); setWorkspace((current) => ({ ...current, customers: current.customers.map((customer) => customer.id === id ? { ...customer, name: patch.name ?? customer.name, email: patch.email ?? customer.email, phone: patch.phone ?? customer.phone } : customer) })); if (patch.notes !== undefined || patch.tags !== undefined) { const current = workspace.customers.find((customer) => customer.id === id); try { await invokeBackend("save_customer_profile", { p_business_id: workspace.business.id, p_customer_id: id, p_note: patch.notes ?? current?.notes ?? "", p_tags: patch.tags ?? current?.tags ?? [] }); } catch (caught) { throw new Error(`Contact details were saved, but notes or tags could not be saved: ${caught instanceof Error ? caught.message : "Unknown error"}`); } } setWorkspace((current) => ({ ...current, customers: current.customers.map((customer) => customer.id === id ? { ...customer, ...patch } : customer) })); },
    mergeCustomer: async (sourceId, destinationId) => { let mergeError: unknown; try { await invokeBackend("merge_customers", { p_source_customer_id: sourceId, p_destination_customer_id: destinationId, p_request_key: crypto.randomUUID() }); } catch (caught) { mergeError = caught; } let snapshot: Record<string, any>; try { snapshot = await invokeBackend<Record<string, any>>("get_workspace_snapshot", { p_business_id: workspace.business.id }); } catch { throw new Error("Merge outcome could not be confirmed. Reload the page before trying again."); } setWorkspace(mapSnapshot(snapshot)); const source = (snapshot["customers"] ?? []).find((item: any) => item.id === sourceId); if (source?.status === "merged" && source?.merged_into_customer_id === destinationId) return; if (mergeError) throw mergeError; },
    addAppointment: async (input) => {
      const start = minutes(input.time); const end = start + input.duration;
      const conflict = workspace.appointments.some((item) => item.date === input.date && item.status !== "cancelled" && (!input.staffId || !item.staffId || item.staffId === input.staffId) && start < minutes(item.time) + item.duration && end > minutes(item.time));
      if (conflict) return { error: "That time is no longer available. Choose another time." };
      const blocked = workspace.blockedTimes.some((item) => item.date === input.date && (!item.staffId || !input.staffId || item.staffId === input.staffId) && start < minutes(item.end) && end > minutes(item.start));
      if (blocked) return { error: "That team member is unavailable during the selected time." };
      try {
        const result = await invokeBackend<{ appointment_id: string }>("create_dashboard_booking", { p_business_id: workspace.business.id, p_service_id: input.serviceId, p_customer_id: input.customerId, p_staff_id: input.staffId ?? null, p_local_date: input.date, p_local_time: input.time, p_notes: input.notes ?? "", p_request_key: crypto.randomUUID() });
        const appointment = { ...input, id: result.appointment_id, createdAt: new Date().toISOString(), manageToken: "" };
        setWorkspace((current) => ({ ...current, appointments: [...current.appointments, appointment] })); return { appointment };
      } catch (caught) { return { error: caught instanceof Error ? caught.message : "The appointment could not be created." }; }
    },
    updateAppointment: async (id, patch) => { if (patch.status) await invokeBackend("set_appointment_status", { p_business_id: workspace.business.id, p_appointment_id: id, p_status: patch.status }); setWorkspace((current) => ({ ...current, appointments: current.appointments.map((item) => item.id === id ? { ...item, ...patch } : item) })); },
    addBlockedTime: async (input) => { const start = minutes(input.start); const end = minutes(input.end); if (end <= start) return { error: "End time must be after start time." }; try { const result = await invokeBackend<{ blocked_time_id: string }>("create_business_blocked_time", { p_business_id: workspace.business.id, p_location_id: workspace.business.defaultLocationId, p_staff_id: input.staffId || null, p_local_date: input.date, p_local_start: input.start, p_local_end: input.end, p_reason: input.reason }); const block: BlockedTime = { ...input, id: result.blocked_time_id, createdAt: new Date().toISOString() }; setWorkspace((current) => ({ ...current, blockedTimes: [...current.blockedTimes, block] })); return { block }; } catch (caught) { return { error: caught instanceof Error ? caught.message : "The time could not be blocked." }; } },
    removeBlockedTime: async (id) => { await invokeBackend("release_blocked_time", { p_blocked_time_id: id }); setWorkspace((current) => ({ ...current, blockedTimes: current.blockedTimes.filter((item) => item.id !== id) })); },
    addStaff: async (input) => { const staff = { ...input, id: crypto.randomUUID() }; await invokeBackend("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "staff_profile", p_operation: "insert", p_id: staff.id, p_values: { display_name: staff.name, email: staff.email || null, active: staff.active, bookable: true, weekly_capacity_minutes: staff.weeklyHours * 60, location_id: workspace.business.defaultLocationId, service_ids: staff.serviceIds } }); setWorkspace((current) => ({ ...current, staff: [...current.staff, staff] })); return staff; },
    addForm: async (input) => { const form = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString(), submissions: 0 }; await invokeBackend("save_form", { p_business_id: workspace.business.id, p_form_id: form.id, p_name: form.name, p_description: form.description, p_active: form.active, p_fields: form.fields.map((field, index) => ({ field_key: `field_${index + 1}`, label: field.label, field_type: field.type, required: field.required, options: (field.options ?? []).map((option) => ({ value: option, label: option })), customer_mapping: field.customerMapping ?? null })) }); setWorkspace((current) => ({ ...current, forms: [...current.forms, form] })); return form; },
    updateForm: async (id, patch) => { const current = workspace.forms.find((form) => form.id === id); if (!current) return; const next = { ...current, ...patch }; await invokeBackend("save_form", { p_business_id: workspace.business.id, p_form_id: id, p_name: next.name, p_description: next.description, p_active: next.active, ...(patch.fields ? { p_fields: next.fields.map((field, index) => ({ field_key: `field_${index + 1}`, label: field.label, field_type: field.type, required: field.required, options: (field.options ?? []).map((option) => ({ value: option, label: option })), customer_mapping: field.customerMapping ?? null })) } : {}) }); setWorkspace((state) => ({ ...state, forms: state.forms.map((form) => form.id === id ? next : form) })); },
    addWorkflow: async (input) => { const workflow = { ...input, id: crypto.randomUUID(), runs: 0 }; await invokeBackend("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "workflow", p_operation: "insert", p_id: workflow.id, p_values: { name: workflow.name, trigger_type: workflow.trigger, action_type: "create_task", task_title: `Follow up: ${workflow.name}`, conditions: [], active: false } }); setWorkspace((current) => ({ ...current, workflows: [...current.workflows, { ...workflow, active: false }] })); return { ...workflow, active: false }; },
    addInvoice: async (input) => { const result = await invokeBackend<{ invoice_id: string; invoice_number: string; total_minor: number }>("create_invoice", { p_business_id: workspace.business.id, p_customer_id: input.customerId, p_appointment_id: null, p_items: [{ description: "Services", quantity: 1, unit_price_minor: Math.round(input.amount * 100), discount_minor: 0, tax_rate_bps: 0 }], p_due_date: input.dueDate, p_notes: "", p_request_key: crypto.randomUUID() }); const invoice: Invoice = { ...input, id: result.invoice_id, number: result.invoice_number, amount: result.total_minor / 100, status: "draft", createdAt: new Date().toISOString() }; setWorkspace((current) => ({ ...current, invoices: [invoice, ...current.invoices] })); return invoice; },
    recordManualPayment: async (invoiceId, amount) => { await invokeBackend("record_manual_payment", { p_invoice_id: invoiceId, p_amount_minor: Math.round(amount * 100), p_method: "manual", p_request_key: crypto.randomUUID() }); setWorkspace((current) => ({ ...current, invoices: current.invoices.map((invoice) => invoice.id === invoiceId ? { ...invoice, status: "paid" } : invoice) })); },
    updateAiReceptionist: async (patch) => { const next = { ...workspace.aiReceptionist, ...patch }; await invokeBackend("mutate_workspace", { p_business_id: workspace.business.id, p_entity: "ai_settings", p_operation: "update", p_values: { assistant_name: next.name, greeting: next.greeting, transfer_phone_e164: next.transferPhone || null, voice: next.voice, after_hours_behavior: next.afterHours === "offer-callback" ? "offer_callback" : "take_message", recording_enabled: next.recordingEnabled, disclosure_enabled: next.disclosureEnabled, voice_enabled: false, sms_enabled: false, sandbox_enabled: true } }); setWorkspace((current) => ({ ...current, aiReceptionist: next })); },
    addCallLog: async (input) => { const saved = await invokeBackend<any>("save_sandbox_call", { p_business_id: workspace.business.id, p_customer_id: input.customerId ?? null, p_caller_e164: input.caller, p_duration_seconds: input.durationSeconds, p_outcome: input.outcome, p_summary: input.summary }); const log: CallLog = { ...input, id: saved.id, startedAt: saved.started_at, sandbox: true }; setWorkspace((current) => ({ ...current, callLogs: [log, ...current.callLogs] })); return log; },
  }), [isLoading, loadError, workspace]);
  return <AppStore.Provider value={store}>{children}</AppStore.Provider>;
}

export function useAppStore() { const value = useContext(AppStore); if (!value) throw new Error("useAppStore must be used inside AppStoreProvider"); return value; }

export function availableSlots(workspace: Workspace, serviceId: string, date: string, excludeAppointmentId?: string, staffId?: string) {
  const service = workspace.services.find((item) => item.id === serviceId); if (!service) return [];
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
  const hours = workspace.business.hours[day]; if (!hours?.enabled) return [];
  const slots: string[] = [];
  for (let cursor = minutes(hours.open); cursor + service.duration <= minutes(hours.close); cursor += 30) {
    const conflict = workspace.appointments.some((item) => item.id !== excludeAppointmentId && item.date === date && item.status !== "cancelled" && (!staffId || !item.staffId || item.staffId === staffId) && cursor < minutes(item.time) + item.duration && cursor + service.duration > minutes(item.time));
    const blocked = workspace.blockedTimes.some((item) => item.date === date && (!item.staffId || !staffId || item.staffId === staffId) && cursor < minutes(item.end) && cursor + service.duration > minutes(item.start));
    if (!conflict && !blocked) slots.push(`${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`);
  }
  return slots;
}
