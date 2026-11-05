import { pageHead } from "../lib/page-head";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { invokeBackend } from "../integrations/supabase/backend";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/invite/$token")({ head: () => pageHead("Avello — Team invitation", "Accept an invitation to join an Avello business."), component: Invitation });

function Invitation() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const authenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (authError) throw authError;
        if (!data.session) setMessage("Verify your email, then return to this invitation link and sign in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally { setBusy(false); }
  };

  const accept = async () => {
    setBusy(true); setError("");
    try {
      await invokeBackend("accept_member_invitation", { p_token: token });
      await navigate({ to: "/app" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation could not be accepted.");
    } finally { setBusy(false); }
  };

  return <main className="auth-page"><section className="auth-form-wrap"><div className="auth-form">
    <Link to="/" className="auth-logo"><span>A</span>Avello</Link>
    <h1>Team invitation</h1>
    {authLoading ? <p>Checking your account…</p> : user ? <>
      <p>Signed in as {user.email}. Accept this invitation to join the business.</p>
      <button className="solid-action" onClick={accept} disabled={busy}>{busy ? "Joining…" : "Accept invitation"}</button>
    </> : <>
      <p>Sign in or create an account using the email address that received this invitation.</p>
      <form onSubmit={authenticate}>
        {mode === "signup" && <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="solid-action" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "I already have an account"}</button>
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </div></section></main>;
}
