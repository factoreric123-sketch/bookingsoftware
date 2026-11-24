import { useEffect, useState } from "react";
import { invokeBackend } from "../integrations/supabase/backend";

export type PageDraft = {
  title: string;
  description: string;
  staff_selection_enabled: boolean;
  service_ids: string[];
  row_version: number;
  published: boolean;
  live_service_ids?: string[];
  slug?: string;
};

export function BookingPageEditor({ businessId, services, onPublishedState }: {
  businessId: string;
  services: Array<{ id: string; name: string; active: boolean }>;
  onPublishedState: (state: PageDraft) => void;
}) {
  const [draft, setDraft] = useState<PageDraft | null>(null);
  const [saved, setSaved] = useState<PageDraft | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    setNotice("");
    setDraft(null);
    setSaved(null);
    invokeBackend<PageDraft>("get_booking_page_draft", { p_business_id: businessId })
      .then((data) => {
        if (current) { setDraft(data); setSaved(data); onPublishedState(data); }
      })
      .catch((error) => {
        if (current) setError(error instanceof Error ? error.message : "Booking page draft could not be loaded.");
      });
    return () => { current = false; };
  }, [businessId, reload, onPublishedState]);

  const save = async (publish?: boolean) => {
    if (!draft || !saved || saving) return;
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const next = publish === undefined
        ? await invokeBackend<PageDraft>("save_booking_page_draft", {
            p_business_id: businessId,
            p_expected_row_version: saved.row_version,
            p_title: draft.title.trim(),
            p_description: draft.description.trim(),
            p_staff_selection_enabled: draft.staff_selection_enabled,
            p_service_ids: draft.service_ids,
          })
        : await invokeBackend<PageDraft>("set_booking_page_publication", {
            p_business_id: businessId,
            p_expected_row_version: saved.row_version,
            p_published: publish,
          });
      if (publish === false) setDraft((current) => current ? { ...current, published: next.published, row_version: next.row_version } : next);
      else setDraft(next);
      setSaved(next);
      onPublishedState(next);
      setNotice(publish === undefined ? "Draft saved." : publish ? "Booking page published." : "Booking page unpublished.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The booking page could not be updated.");
    } finally { setSaving(false); }
  };

  if (!draft || !saved) return <section className="panel settings-form">
    <h2>Edit booking page</h2>
    {error ? <>
      <p role="alert">{error}</p>
      <button className="secondary-action" onClick={() => setReload((value) => value + 1)}>Retry</button>
    </> : <p role="status">Loading draft…</p>}
  </section>;

  const changed = draft.title !== saved.title || draft.description !== saved.description
    || draft.staff_selection_enabled !== saved.staff_selection_enabled
    || draft.service_ids.length !== saved.service_ids.length
    || draft.service_ids.some((id) => !saved.service_ids.includes(id));
  return <section className="panel settings-form booking-page-editor">
    <h2>Edit booking page</h2>
    <p>{saved.published ? "Published. Draft edits appear on the public page when you publish them." : "Unpublished. Save your draft, then publish to accept bookings."}</p>
    <fieldset disabled={saving}>
      <label>Page title<input maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>Introduction<textarea maxLength={10000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      <label className="editor-checkbox">
        <input type="checkbox" checked={draft.staff_selection_enabled} onChange={(event) => setDraft({ ...draft, staff_selection_enabled: event.target.checked })} />
        Let customers choose a team member
      </label>
      <fieldset>
        <legend>Services customers can book</legend>
        {services.filter((service) => service.active).map((service) => (
          <label key={service.id} className="editor-checkbox">
            <input type="checkbox" checked={draft.service_ids.includes(service.id)} onChange={(event) => {
              const serviceIds = event.target.checked
                ? [...draft.service_ids, service.id]
                : draft.service_ids.filter((id) => id !== service.id);
              setDraft({ ...draft, service_ids: serviceIds });
            }} />
            {service.name}
          </label>
        ))}
      </fieldset>
      <div className="approval-actions">
        <button className="secondary-action" onClick={() => setPreviewOpen(!previewOpen)} aria-expanded={previewOpen}>
          {previewOpen ? "Hide draft preview" : "Preview draft"}
        </button>
        <button className="secondary-action" disabled={!changed || !draft.title.trim()} onClick={() => void save()}>Save draft</button>
        <button className="solid-action" disabled={changed || !draft.title.trim()} onClick={() => {
          if (draft.service_ids.length || window.confirm("Publish this page without any bookable services?")) void save(true);
        }}>Publish</button>
        {saved.published && <button className="secondary-action" onClick={() => {
          if (window.confirm("Unpublish the booking page and stop accepting new online bookings?")) void save(false);
        }}>Unpublish</button>}
      </div>
    </fieldset>
    {previewOpen && <section className="panel" aria-label="Draft preview">
      <h3>{draft.title || "Booking page"}</h3>
      {draft.description && <p>{draft.description}</p>}
      <ul>{services.filter((service) => service.active && draft.service_ids.includes(service.id)).map((service) => <li key={service.id}>{service.name}</li>)}</ul>
      {draft.staff_selection_enabled && <p>Customers can choose a team member.</p>}
    </section>}
    {notice && <p role="status">{notice}</p>}
    {error && <p className="booking-error" role="alert">{error}</p>}
  </section>;
}
