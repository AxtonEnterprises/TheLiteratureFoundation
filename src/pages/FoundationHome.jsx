import { Link } from "react-router-dom";
import {
  BookOpen,
  GraduationCap,
  Heart,
  LibraryBig,
  Shuffle,
  ArrowRight
} from "lucide-react";

const SUPPORT_URL =
  "https://buy.stripe.com/fZudR897C0DL9II8wm6oo00";

export default function FoundationHome() {
  return (
    <div className="foundation-site">
      <header className="foundation-header">
        <a className="foundation-brand" href="/">
          <img
            className="foundation-header-logo"
            src="/branding/tlf-logo-horizontal-web.png"
            alt="The Literature Foundation"
          />
        </a>

        <nav
          className="foundation-nav"
          aria-label="Foundation navigation"
        >
          <a href="#mission">Mission</a>
          <a href="#programs">Programs</a>
          <a href="#about-foundation">About</a>

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

      <section className="foundation-hero">
        <div className="foundation-hero-copy">
          <p className="foundation-eyebrow">
            Discover · Read · Learn
          </p>

          <h1>Literature belongs to everyone.</h1>

          <p className="foundation-lede">
            Free access to timeless books, tools that make reading
            easier, and new ways to turn reading into lifelong
            learning.
          </p>

          <div className="foundation-actions">
            <Link
              className="foundation-button primary"
              to="/read"
            >
              <BookOpen size={19} />
              Start Reading
            </Link>

            <a
              className="foundation-button secondary"
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Support the Foundation
            </a>
          </div>
        </div>

        <div className="foundation-logo-card">
          <img
            src="/branding/tlf-logo-stacked-web.png"
            alt="The Literature Foundation"
          />
        </div>
      </section>

      <section
        id="mission"
        className="foundation-section foundation-random"
      >
        <div className="foundation-copy">
          <p className="foundation-eyebrow">Random Reads</p>

          <h2>Find a book you weren’t looking for.</h2>

          <p>
            Random Reads turns the public-domain library into an
            invitation to discover. Find something unexpected,
            read in a focused interface, save your progress, and
            keep a reading journal.
          </p>

          <div className="foundation-feature-list">
            <div>
              <Shuffle size={20} />
              <span>
                <strong>Discover randomly</strong>
                {" "}Escape recommendation loops.
              </span>
            </div>

            <div>
              <BookOpen size={20} />
              <span>
                <strong>Read freely</strong>
                {" "}Classic literature without a subscription.
              </span>
            </div>

            <div>
              <GraduationCap size={20} />
              <span>
                <strong>Learn deeply</strong>
                {" "}Build toward comprehension and proof of
                learning.
              </span>
            </div>
          </div>

          <Link
            className="foundation-text-link"
            to="/read"
          >
            Open Random Reads
            <ArrowRight size={17} />
          </Link>
        </div>

        <div className="foundation-product-card">
          <img
            src="/branding/random-reads-logo.svg"
            alt="Random Reads"
          />

          <div className="mini-reader">
            <small>TODAY'S DISCOVERY</small>
            <h3>Pride and Prejudice</h3>
            <p>Jane Austen</p>
            <span>
              It is a truth universally acknowledged...
            </span>
          </div>
        </div>
      </section>

      <section
        id="programs"
        className="foundation-section"
      >
        <div className="foundation-section-heading">
          <p className="foundation-eyebrow">
            What we build
          </p>

          <h2>Discover. Read. Learn.</h2>
        </div>

        <div className="foundation-pillars">
          <article>
            <span>01</span>
            <LibraryBig />
            <h3>Discover</h3>
            <p>
              Make literature easier to encounter, browse, and
              explore without paywalls or gatekeeping.
            </p>
          </article>

          <article>
            <span>02</span>
            <BookOpen />
            <h3>Read</h3>
            <p>
              Build reader-first tools for focused reading,
              progress, journaling, and discovery.
            </p>
          </article>

          <article>
            <span>03</span>
            <GraduationCap />
            <h3>Learn</h3>
            <p>
              Create pathways from reading to comprehension,
              mentorship, and verifiable learning.
            </p>
          </article>
        </div>
      </section>

      <section className="foundation-quote">
        <blockquote>
          A public library for the digital age should do more than
          store books. It should help people discover them, read
          them, and grow through them.
        </blockquote>
      </section>

      <section
        id="about-foundation"
        className="foundation-section foundation-about"
      >
        <div>
          <p className="foundation-eyebrow">About</p>

          <h2>
            Preserving access. Expanding understanding.
          </h2>
        </div>

        <div>
          <p>
            The Literature Foundation is a nonprofit organization
            focused on increasing access to literature and
            building tools that help people engage with books
            more deeply.
          </p>

          <p>
            We believe great literature should be easy to
            discover, free to read when rights allow, and
            connected to opportunities for reflection,
            education, and community.
          </p>
        </div>
      </section>

      <section
        id="support"
        className="foundation-support"
      >
        <div>
          <p className="foundation-eyebrow">
            Support the mission
          </p>

          <h2>Help keep literature open.</h2>

          <p>
            Support free reading tools, public-domain access,
            preservation, and educational development.
          </p>
        </div>

        <a
          className="foundation-button gold"
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Heart size={19} />
          Support the Foundation
        </a>
      </section>

      <footer className="foundation-footer-new">
        <div className="foundation-footer-brand">
          <img
            src="/branding/tlf-icon-approved.png"
            alt=""
          />

          <div>
            <strong>The Literature Foundation</strong>
            <span>Discover · Read · Learn</span>
          </div>
        </div>

        <div className="foundation-footer-links">
          <Link to="/read">Random Reads</Link>

          <a href="mailto:info@theliteraturefoundation.org">
            Contact
          </a>

          <span>
            © {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
