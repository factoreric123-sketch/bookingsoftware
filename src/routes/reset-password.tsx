import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else { setDone(true); window.setTimeout(() => navigate({ to: "/app", replace: true }), 1200); }
    setLoading(false);
  };
  return <div className="auth-page"><section className="auth-brand"><Link to="/" className="auth-logo"><span>A</span>Avello</Link><div><h1>Secure your account.</h1><p>Choose a new password for your Avello workspace.</p></div></section><main className="auth-form-wrap"><div className="auth-form"><h2>Reset password</h2>{done ? <div className="auth-success"><Check size={16}/>Password updated. Opening your workspace…</div> : <form onSubmit={submit}><label>New password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)}/></label><label>Confirm password<input required minLength={8} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)}/></label>{error && <div className="auth-error">{error}</div>}<button className="auth-submit" disabled={loading}>{loading ? <Loader2 className="spin" size={18}/> : "Update password"}</button></form>}</div></main></div>;
}
