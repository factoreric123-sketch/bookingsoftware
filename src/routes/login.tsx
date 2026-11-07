import { pageHead } from "../lib/page-head";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../lib/auth-context";

export const Route = createFileRoute("/login")({ head: () => pageHead("Avello \u2014 Sign in", "Sign in or create your Avello business account."), component: Login });

async function nextAuthenticatedRoute() {
  const { count } = await supabase
    .from("business_members")
    .select("id", { count: "exact", head: true })
    .eq("active", true);
  return count ? "/app" : "/onboarding";
}

function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  useEffect(() => {
    if (!authLoading && user) nextAuthenticatedRoute().then((to) => navigate({ to }));
  }, [authLoading, navigate, user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name } },
      });
      if (signUpError) setError(signUpError.message);
      else if (data.session) await navigate({ to: "/onboarding" });
      else setMessage("Account created. Verify your email, then sign in to finish setup.");
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInError) setError(signInError.message);
      else await navigate({ to: await nextAuthenticatedRoute() });
    }
    setLoading(false);
  };

  const requestPasswordReset = async () => {
    if (!form.email) { setError("Enter your email address first."); return; }
    setLoading(true); setError(""); setMessage("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: `${window.location.origin}/reset-password` });
    if (resetError) setError(resetError.message);
    else setMessage("If an account exists for that email, a password-reset link has been sent.");
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <section className="auth-brand">
        <Link to="/" className="auth-logo">
          <span>A</span>Avello
        </Link>
        <div>
          <i>ALL-IN-ONE BUSINESS OS</i>
          <h1>
            More bookings.
            <br />
            Less busywork.
          </h1>
          <p>
            Run appointments, customers, payments, texts, and your team from one calm workspace.
          </p>
          <ul>
            <li>
              <Check size={16} />
              Real-time scheduling
            </li>
            <li>
              <Check size={16} />
              Customer CRM
            </li>
            <li>
              <Check size={16} />
              Automated follow-ups
            </li>
          </ul>
        </div>
        <small>© 2026 Avello, Inc.</small>
      </section>
      <main className="auth-form-wrap">
        <div className="auth-form">
          <span className="mobile-auth-logo">A</span>
          <h2>{mode === "login" ? "Welcome back" : "Start your free workspace"}</h2>
          <p>
            {mode === "login"
              ? "Sign in to manage your business."
              : "No credit card required. Set up in minutes."}
          </p>
          <form onSubmit={submit}>
            {mode === "signup" && (
              <label>
                Full name
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Eric Thompson"
                />
              </label>
            )}
            <label>
              Email address
              <input
                required
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="you@business.com"
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  required
                  minLength={8}
                  type={show ? "text" : "password"}
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && <div className="auth-error">{error}</div>}
            {message && <div className="auth-success">{message}</div>}
            <button className="auth-submit" disabled={loading || authLoading}>
              {loading || authLoading ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <>
                  {mode === "login" ? "Sign in" : "Create account"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          {mode === "login" && <button className="auth-forgot" type="button" disabled={loading} onClick={requestPasswordReset}>Forgot your password?</button>}
          <div className="auth-switch">
            {mode === "login" ? "New to Avello?" : "Already have an account?"}
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
                setMessage("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
