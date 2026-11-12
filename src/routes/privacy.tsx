import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoPage } from "../components/PublicInfoPage";
import { pageHead } from "../lib/page-head";

export const Route = createFileRoute("/privacy")({
  head: () => pageHead("Avello privacy status", "Status of Avello Software's public privacy notice."),
  component: Privacy,
});

function Privacy() {
  return <PublicInfoPage title="Privacy notice" description="A public privacy notice is being prepared for review before launch.">
    <h2>Notice pending</h2>
    <p>This page is a status placeholder. It is not a privacy policy. The final notice must identify the data controller, processing purposes, retention periods, and customer rights before public launch.</p>
  </PublicInfoPage>;
}
