import { BookOpen, Home, Search } from "lucide-react";
import { Link } from "react-router-dom";

import SEO from "../components/SEO.jsx";

export default function NotFound() {
  return (
    <main className="page-wrap">
      <SEO
        title="Page Not Found | The Literature Foundation"
        description="The page you requested could not be found."
        path="/404"
        noindex
      />

      <section
        className="hero-card small"
        style={{
          maxWidth: "760px",
          margin: "3rem auto",
          textAlign: "center"
        }}
      >
        <p className="eyebrow">404 · Page Not Found</p>

        <h1>This page seems to have wandered off.</h1>

        <p className="muted">
          The page may have moved, or the link may be
          outdated. You can return to The Literature
          Foundation or continue exploring Random Reads.
        </p>

        <div
          className="button-row"
          style={{ justifyContent: "center" }}
        >
          <Link to="/" className="button primary large">
            <Home size={20} />
            Foundation Home
          </Link>

          <Link
            to="/read"
            className="button secondary large"
          >
            <BookOpen size={20} />
            Random Reads
          </Link>

          <Link
            to="/read/search"
            className="button secondary large"
          >
            <Search size={20} />
            Search Books
          </Link>
        </div>
      </section>
    </main>
  );
}
