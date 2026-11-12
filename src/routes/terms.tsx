import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoPage } from "../components/PublicInfoPage";
import { pageHead } from "../lib/page-head";

export const Route = createFileRoute("/terms")({
  head: () => pageHead("Avello terms status", "Status of Avello Software's public service terms."),
  component: Terms,
});

function Terms() {
  return <PublicInfoPage title="Terms of service" description="Public service terms are being prepared for review before launch.">
    <h2>Terms pending</h2>
    <p>This page is a status placeholder. It is not an agreement. Pricing, trial rules, payment terms, and service responsibilities require approval before public launch.</p>
  </PublicInfoPage>;
}
