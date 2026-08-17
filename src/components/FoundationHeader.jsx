import { Link } from "react-router-dom";

const SUPPORT_URL =
  "https://buy.stripe.com/fZudR897C0DL9II8wm6oo00";

export default function FoundationHeader() {
  return (
    <header className="foundation-header">
      <Link className="foundation-brand" to="/">
        <img
          className="foundation-header-logo"
          src="/branding/tlf-logo-horizontal-web.png"
          alt="The Literature Foundation"
        />
      </Link>

      <nav
        className="foundation-nav"
        aria-label="Foundation navigation"
      >
        <Link to="/#mission">Mission</Link>
        <Link to="/#programs">Programs</Link>
        <Link to="/#about-foundation">About</Link>

        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="foundation-support-link"
        >
          Support Us
        </a>
      </nav>
    </header>
  );
}
