import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { setError("The authentication link is missing its authorization code."); return; }
    supabase.auth.exchangeCodeForSession(code).then(async ({ error: exchangeError }) => {
      if (exchangeError) { setError(exchangeError.message); return; }
      const { count } = await supabase.from("business_members").select("id", { count: "exact", head: true }).eq("active", true);
      await navigate({ to: count ? "/app" : "/onboarding", replace: true });
    });
  }, [navigate]);
  return <div className="auth-page"><main className="auth-form-wrap"><div className="auth-form"><span className="mobile-auth-logo">A</span><h2>{error ? "Authentication failed" : "Finishing sign in"}</h2>{error ? <div className="auth-error">{error}</div> : <p><Loader2 className="spin" size={18}/> Verifying your secure link…</p>}</div></main></div>;
}
