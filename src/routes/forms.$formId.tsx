import { pageHead } from "../lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { invokeBackend } from "../integrations/supabase/backend";
import { CustomerFormFields, type Field } from "../components/CustomerFormFields";

export const Route = createFileRoute("/forms/$formId")({ head: () => pageHead("Avello \u2014 Customer form", "Submit your customer information securely through Avello."), component: PublicForm });

type FormProjection = { form_id: string; version_id: string; name: string; description: string; slug: string; accent_color: string; business: { name: string; accent_color: string }; fields: Field[] };

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
        <CustomerFormFields fields={form.fields} answers={answers} onChange={(key, value) => setAnswers({ ...answers, [key]: value })} />
        {error && <div className="booking-error">{error}</div>}
        <button disabled={loading}>{loading ? <Loader2 className="spin" size={16}/> : <>Submit response <ArrowRight size={16}/></>}</button>
      </form>
      <div className="form-privacy"><ShieldCheck size={14}/>Encrypted in transit and protected by business access controls.</div>
    </main><footer>Powered by <b>Avello</b></footer>
  </div>;
}
