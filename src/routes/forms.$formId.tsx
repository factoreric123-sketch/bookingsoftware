import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, FileCheck2, ShieldCheck } from "lucide-react";
import { useAppStore } from "../lib/app-store";

export const Route = createFileRoute("/forms/$formId")({ component: PublicForm });

function PublicForm() {
  const { formId } = Route.useParams();
  const { workspace, submitForm } = useAppStore();
  const form = workspace.forms.find((item) => item.id === formId);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");

  if (!form || !form.active) return <div className="public-form-page"><div className="public-form-card unavailable"><FileCheck2 size={30}/><h1>Form unavailable</h1><p>This form does not exist or is not currently accepting responses.</p><Link to="/">Return to Avello</Link></div></div>;
  if (complete) return <div className="public-form-page"><div className="public-form-card form-complete" style={{"--form-accent":workspace.business.accent} as React.CSSProperties}><span><Check size={28}/></span><small>RESPONSE RECEIVED</small><h1>Thanks—we’ve got it.</h1><p>Your response was saved for {workspace.business.name}. If the form included an email and name, it was also associated with your customer record.</p></div></div>;

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const missing = form.fields.find((field) => field.required && !answers[field.id]);
    if (missing) { setError(`${missing.label} is required.`); return; }
    submitForm(form.id, answers); setComplete(true);
  };

  return <div className="public-form-page"><header><span style={{background:workspace.business.accent}}>{workspace.business.name.charAt(0)}</span><div><b>{workspace.business.name}</b><small>Secure customer form</small></div></header><main className="public-form-card" style={{"--form-accent":workspace.business.accent} as React.CSSProperties}><small>CLIENT FORM</small><h1>{form.name}</h1><p>{form.description}</p><form onSubmit={send}>{form.fields.map((field) => <label key={field.id}>{field.label}{field.required && <em>Required</em>}{field.type === "textarea" ? <textarea value={String(answers[field.id] ?? "")} onChange={(event) => setAnswers({...answers,[field.id]:event.target.value})}/> : field.type === "select" ? <select value={String(answers[field.id] ?? "")} onChange={(event) => setAnswers({...answers,[field.id]:event.target.value})}><option value="">Select an option</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select> : field.type === "checkbox" ? <span className="public-checkbox"><input type="checkbox" checked={Boolean(answers[field.id])} onChange={(event) => setAnswers({...answers,[field.id]:event.target.checked})}/>Yes</span> : <input type={field.type === "phone" ? "tel" : field.type} value={String(answers[field.id] ?? "")} onChange={(event) => setAnswers({...answers,[field.id]:event.target.value})}/>}</label>)}{error && <div className="booking-error">{error}</div>}<button>Submit response <ArrowRight size={16}/></button></form><div className="form-privacy"><ShieldCheck size={14}/>Saved to this business’s preview workspace only.</div></main><footer>Powered by <b>Avello</b></footer></div>;
}
