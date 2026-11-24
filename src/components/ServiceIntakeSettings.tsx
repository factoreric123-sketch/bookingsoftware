import { useEffect, useState } from "react";
import { invokeBackend } from "../integrations/supabase/backend";

type IntakeTiming = "required_before" | "optional_after";
type IntakeAssignment = {
  service_id: string;
  form_id: string;
  timing: IntakeTiming;
  row_version: number;
};

export function ServiceIntakeSettings({ businessId, services, forms }: {
  businessId: string;
  services: Array<{ id: string; name: string; active: boolean }>;
  forms: Array<{ id: string; name: string; active: boolean }>;
}) {
  const [assignments, setAssignments] = useState<IntakeAssignment[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [formId, setFormId] = useState("");
  const [timing, setTiming] = useState<IntakeTiming>("required_before");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let current = true;
    invokeBackend<IntakeAssignment[]>("get_service_intake_settings", { p_business_id: businessId })
      .then((data) => { if (current) setAssignments(data); })
      .catch((error) => { if (current) setError(error instanceof Error ? error.message : "Intake settings could not be loaded."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [businessId]);
  const chooseService = (id: string) => {
    const assignment = assignments.find((item) => item.service_id === id);
    setServiceId(id);
    setFormId(assignment?.form_id ?? "");
    setTiming(assignment?.timing ?? "required_before");
    setNotice("");
    setError("");
  };
  const save = async () => {
    if (!serviceId || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await invokeBackend<IntakeAssignment | null>("save_service_intake_settings", {
        p_business_id: businessId,
        p_service_id: serviceId,
        p_form_id: formId || null,
        p_timing: formId ? timing : null,
        p_expected_row_version: assignments.find((item) => item.service_id === serviceId)?.row_version ?? null,
      });
      setAssignments((items) => [...items.filter((item) => item.service_id !== serviceId), ...(data ? [data] : [])]);
      setNotice(formId ? "Intake settings saved." : "Intake form removed from this service.");
    } catch (error) { setError(error instanceof Error ? error.message : "Intake settings could not be saved."); }
    finally { setSaving(false); }
  };
  const availableForms = forms.filter((form) => form.active);
  const selectedFormIsPublished = !formId || availableForms.some((form) => form.id === formId);
  return <section className="panel settings-form service-intake-settings">
    <h2>Service intake</h2>
    <p>Choose which published form customers complete for each service.</p>
    {loading ? <p role="status">Loading intake settings…</p> : (
      <fieldset disabled={saving}>
        <label>Service<select value={serviceId} onChange={(event) => chooseService(event.target.value)}>
          <option value="">Choose a service</option>
          {services.filter((service) => service.active).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
        </select></label>
        {serviceId && <>
          <label>Intake form<select value={formId} onChange={(event) => { setFormId(event.target.value); setNotice(""); }}>
            <option value="">No intake form</option>
            {!selectedFormIsPublished && <option value={formId}>Current form unavailable</option>}
            {availableForms.map((form) => <option key={form.id} value={form.id}>{form.name}</option>)}
          </select></label>
          {formId && <label>When to collect it<select value={timing} onChange={(event) => setTiming(event.target.value as IntakeTiming)}>
            <option value="required_before">Required before booking</option>
            <option value="optional_after">Optional after booking</option>
          </select></label>}
          <button className="solid-action" disabled={!selectedFormIsPublished} onClick={() => void save()}>
            {saving ? "Saving…" : "Save intake settings"}
          </button>
        </>}
      </fieldset>
    )}
    {error && <p className="booking-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && <div className="intake-assignment-list">
      <div><b>Current service assignments</b><span>{assignments.length} configured</span></div>
      {assignments.length ? assignments.map((assignment) => {
        const service = services.find((item) => item.id === assignment.service_id);
        const form = forms.find((item) => item.id === assignment.form_id);
        return <button type="button" key={assignment.service_id} onClick={() => chooseService(assignment.service_id)}>
          <span><b>{service?.name ?? "Unavailable service"}</b><small>{form?.name ?? "Unavailable form"} · {assignment.timing === "required_before" ? "Required before booking" : "Optional after booking"}</small></span>
          <span>Edit</span>
        </button>;
      }) : <p>No services have an intake form attached.</p>}
    </div>}
  </section>;
}
