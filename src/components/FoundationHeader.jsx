import { Link } from "react-router-dom";

const LIT_CHAIN_URL = "https://litchain.org";

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
        <a href="/#mission">Mission</a>
        <a href="/#programs">Programs</a>
        <a href="/#about-foundation">About</a>

        <a
          href={LIT_CHAIN_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Lit Chain
        </a>

        <Link
          to="/support"
          className="foundation-support-link"
        >
          Support Us
        </Link>
      </nav>
    </header>
  );
}
