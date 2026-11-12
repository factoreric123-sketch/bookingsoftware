import { Link } from "@tanstack/react-router";

export function PublicInfoPage({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="public-info-page">
    <header><Link to="/" className="brand"><span className="brand-mark"><i /><b /></span>Avello</Link><Link to="/login" className="login-btn">Sign in</Link></header>
    <main><p className="mini-label">AVELLO SOFTWARE</p><h1>{title}</h1><p className="public-info-intro">{description}</p><div className="public-info-card">{children}</div><Link to="/" className="text-btn">← Back to home</Link></main>
    <footer><Link to="/contact">Contact</Link><Link to="/privacy">Privacy status</Link><Link to="/terms">Terms status</Link></footer>
  </div>;
}
