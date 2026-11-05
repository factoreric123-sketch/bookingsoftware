import { supabase } from "./client";

export type BackendAction =
  | "provision_business"
  | "get_public_booking_page"
  | "get_availability"
  | "create_booking_hold"
  | "confirm_booking"
  | "get_managed_appointment"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "create_blocked_time"
  | "release_blocked_time"
  | "submit_public_form"
  | "merge_customers"
  | "create_invoice"
  | "record_manual_payment"
  | "accept_member_invitation"
  | "create_member_invitation"
  | "get_business_analytics"
  | "complete_onboarding"
  | "get_workspace_snapshot"
  | "get_my_businesses"
  | "get_staff_schedule"
  | "mutate_workspace"
  | "get_public_form"
  | "create_dashboard_booking"
  | "reschedule_dashboard_booking"
  | "create_business_blocked_time"
  | "set_appointment_status"
  | "save_sandbox_call"
  | "save_form"
  | "save_customer_profile";

export class BackendError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number) {
    super(message);
    this.name = "BackendError";
  }
}

export async function invokeBackend<T>(action: BackendAction, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("backend-api", { body: { action, params } });
  const result = (data ?? {}) as { data?: T; error?: string; code?: string };
  if (error) {
    const response = error.context instanceof Response ? error.context : null;
    let body: { error?: string; code?: string } = result;
    if (response) {
      try { body = await response.json(); } catch { /* Preserve the transport error. */ }
    }
    throw new BackendError(body.error ?? error.message ?? "The request failed", body.code, response?.status);
  }
  if (result.error) throw new BackendError(result.error, result.code);
  return result.data as T;
}
