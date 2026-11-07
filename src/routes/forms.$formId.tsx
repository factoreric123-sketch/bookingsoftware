import { pageHead } from "../lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { invokeBackend } from "../integrations/supabase/backend";

export const Route = createFileRoute("/forms/$formId")({ head: () => pageHead("Avello \u2014 Customer form", "Submit your customer information securely through Avello."), component: PublicForm });

type Field = { id: string; field_key: string; label: string; field_type: string; required: boolean; placeholder: string; help_text: string; options: Array<{ value: string; label: string }>; validation: Record<string, unknown>; visibility_rule: { field_key: string; operator: string; value: string | boolean } | null };
type FormProjection = { form_id: string; version_id: string; name: string; description: string; slug: string; accent_color: string; business: { name: string; accent_color: string }; fields: Field[] };

function visible(field: Field, answers: Record<string, unknown>) {
  if (!field.visibility_rule) return true;
  const actual = answers[field.visibility_rule.field_key];
  const expected = field.visibility_rule.value;
  if (field.visibility_rule.operator === "equals") return actual === expected;
  if (field.visibility_rule.operator === "not_equals") return actual !== expected;
  if (field.visibility_rule.operator === "contains") return String(actual ?? "").includes(String(expected));
  if (field.visibility_rule.operator === "is_checked") return Boolean(actual) === Boolean(expected);
  return true;
}

function PublicForm() {
  const { formId } = Route.useParams();
  const [form, setForm] = useState<FormProjection | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [requestKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    invokeBackend<FormProjection>("get_public_form", { p_identifier: formId }).then(setForm).catch((caught) => setError(caught instanceof Error ? caught.message : "Form unavailable")).finally(() => setLoading(false));
  }, [formId]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setLoading(true); setError("");
    try {
      await invokeBackend("submit_public_form", { p_form_slug: form.slug, p_form_version_id: form.version_id, p_answers: answers, p_request_key: requestKey, p_honeypot: honeypot });
      setSubmitted(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your response could not be submitted."); }
    finally { setLoading(false); }
  };

  if (loading && !form) return <div className="public-form-page"><main className="public-form-card"><Loader2 className="spin"/> Loading secure form…</main></div>;
  if (!form) return <div className="public-form-page"><main className="public-form-card"><h1>Form unavailable</h1><p>{error || "This form is not published."}</p></main></div>;
  const accent = form.accent_color || form.business.accent_color;
  if (submitted) return <div className="public-form-page"><main className="public-form-card form-success"><span style={{ background: accent }}><Check size={28}/></span><h1>Response received</h1><p>Your information was submitted securely to {form.business.name}.</p></main></div>;

  return <div className="public-form-page">
    <header><span style={{ background: accent }}>{form.business.name.charAt(0)}</span><div><b>{form.business.name}</b><small>Secure customer form</small></div></header>
    <main className="public-form-card" style={{ "--form-accent": accent } as React.CSSProperties}><small>CLIENT FORM</small><h1>{form.name}</h1><p>{form.description}</p>
      <form onSubmit={send}>
        <label className="sr-only" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)}/></label>
        {form.fields.filter((field) => visible(field, answers)).map((field) => <FieldInput key={field.id} field={field} value={answers[field.field_key]} onChange={(value) => setAnswers({ ...answers, [field.field_key]: value })}/>)}
        {error && <div className="booking-error">{error}</div>}
        <button disabled={loading}>{loading ? <Loader2 className="spin" size={16}/> : <>Submit response <ArrowRight size={16}/></>}</button>
      </form>
      <div className="form-privacy"><ShieldCheck size={14}/>Encrypted in transit and protected by business access controls.</div>
    </main><footer>Powered by <b>Avello</b></footer>
  </div>;
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (value: unknown) => void }) {
  const common = { required: field.required, placeholder: field.placeholder, minLength: Number(field.validation["min_length"]) || undefined, maxLength: Number(field.validation["max_length"]) || undefined };
  const label = <>{field.label}{field.required && <em>Required</em>}{field.help_text && <small>{field.help_text}</small>}</>;
  if (field.field_type === "textarea" || field.field_type === "address") return <label>{label}<textarea {...common} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}/></label>;
  if (field.field_type === "select") return <label>{label}<select required={field.required} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}><option value="">Select an option</option>{field.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
  if (field.field_type === "radio") return <fieldset><legend>{label}</legend>{field.options.map((option) => <label key={option.value}><input type="radio" required={field.required} name={field.field_key} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)}/>{option.label}</label>)}</fieldset>;
  if (field.field_type === "checkbox" || field.field_type === "consent") return <label className="public-checkbox"><input type="checkbox" required={field.required} checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)}/>{field.label}</label>;
  const type = field.field_type === "email" ? "email" : field.field_type === "phone" ? "tel" : field.field_type === "date" || field.field_type === "time" ? field.field_type : "text";
  return <label>{label}<input {...common} type={type} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}/></label>;
}
