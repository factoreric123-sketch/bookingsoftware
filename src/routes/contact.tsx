import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicInfoPage } from "../components/PublicInfoPage";
import { pageHead } from "../lib/page-head";

export const Route = createFileRoute("/contact")({
  head: () => pageHead("Contact Avello", "Contact information and support status for Avello Software."),
  component: Contact,
});

function Contact() {
  return <PublicInfoPage title="Contact" description="We are preparing the public support channel for Avello.">
    <h2>Need help with your workspace?</h2>
    <p>Sign in to review your booking and business settings. A public support address will be published here when it is configured.</p>
    <Link to="/login" className="primary-btn">Sign in to Avello</Link>
  </PublicInfoPage>;
}
