import { pageHead } from "../lib/page-head";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({ head: () => pageHead("Avello \u2014 Complete sign in", "Complete secure authentication for your Avello account."), component: AuthCallback });

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { setError("The authentication link is missing its authorization code."); return; }
    supabase.auth.exchangeCodeForSession(code).then(async ({ error: exchangeError }) => {
      if (exchangeError) { setError(exchangeError.message); return; }
      const { data } = await supabase.from("business_members").select("role,all_locations").eq("active", true).order("created_at").limit(1);
      await navigate({ to: data?.[0]?.role === "staff" || (data?.[0]?.role === "manager" && !data[0].all_locations) ? "/staff" : data?.length ? "/app" : "/onboarding", replace: true });
    });
  }, [navigate]);
  return <div className="auth-page"><main className="auth-form-wrap"><div className="auth-form"><span className="mobile-auth-logo">A</span><h2>{error ? "Authentication failed" : "Finishing sign in"}</h2>{error ? <div className="auth-error">{error}</div> : <p><Loader2 className="spin" size={18}/> Verifying your secure link…</p>}</div></main></div>;
}
