import {
  BookOpen,
  GraduationCap,
  Heart,
  LibraryBig,
  MessageSquare,
  ArrowRight
} from "lucide-react";

import FoundationHeader from "../components/FoundationHeader.jsx";
import SEO from "../components/SEO.jsx";

const SUPPORT_URL =
  "https://buy.stripe.com/fZudR897C0DL9II8wm6oo00";

const LIT_CHAIN_URL = "https://litchain.org";

export default function FoundationHome() {
  return (
    <div className="foundation-site">
      <SEO
        title="The Literature Foundation | Discover, Read, Learn"
        description="The Literature Foundation expands access to literature through preservation, reading tools, education, community, and projects such as Lit Chain."
        path="/"
      />

      <FoundationHeader />

      <section className="foundation-hero">
        <div className="foundation-hero-copy">
          <p className="foundation-eyebrow">
            Discover · Read · Learn
          </p>

          <h1>Literature belongs to everyone.</h1>

          <p className="foundation-lede">
            The Literature Foundation expands access to literature,
            supports preservation and education, and builds tools
            that help people discover, read, discuss, and learn from
            great books.
          </p>

          <div className="foundation-actions">
            <a
              className="foundation-button primary"
              href={LIT_CHAIN_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen size={19} />
              Open Lit Chain
            </a>

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
          <p className="foundation-eyebrow">Our mission</p>

          <h2>
            Preserve literature. Expand access. Deepen understanding.
          </h2>

          <p>
            We believe important literature should remain available
            across generations and should be easier to discover,
            read, discuss, and learn from.
          </p>

          <div className="foundation-feature-list">
            <div>
              <LibraryBig size={20} />
              <span>
                <strong>Preserve access</strong>{" "}
                Support durable access to important literary works
                and public-domain texts.
              </span>
            </div>

            <div>
              <BookOpen size={20} />
              <span>
                <strong>Make reading easier</strong>{" "}
                Build and support tools that reduce barriers between
                readers and books.
              </span>
            </div>

            <div>
              <MessageSquare size={20} />
              <span>
                <strong>Encourage discussion</strong>{" "}
                Create places where readers can exchange ideas,
                interpretations, notes, and questions.
              </span>
            </div>

            <div>
              <GraduationCap size={20} />
              <span>
                <strong>Advance learning</strong>{" "}
                Connect reading with education, comprehension,
                mentorship, and lifelong learning.
              </span>
            </div>
          </div>
        </div>

        <div className="foundation-product-card">
          <img
            src="/branding/tlf-logo-horizontal-web.png"
            alt="The Literature Foundation"
          />
        </div>
      </section>

      <section
        id="programs"
        className="foundation-section"
      >
        <div className="foundation-section-heading">
          <p className="foundation-eyebrow">
            What we support
          </p>

          <h2>Programs and projects</h2>
        </div>

        <div className="foundation-pillars">
          <article>
            <span>01</span>
            <LibraryBig />
            <h3>Access &amp; Preservation</h3>
            <p>
              Support long-term access to important literature,
              public-domain works, and literary resources.
            </p>
          </article>

          <article>
            <span>02</span>
            <BookOpen />
            <h3>Reading Tools</h3>
            <p>
              Develop reader-first technology that helps people
              discover books, read deeply, save progress, and reflect.
            </p>
          </article>

          <article>
            <span>03</span>
            <GraduationCap />
            <h3>Education &amp; Community</h3>
            <p>
              Build pathways from reading to discussion,
              comprehension, classrooms, mentorship, and learning.
            </p>
          </article>
        </div>
      </section>

      <section
        id="lit-chain"
        className="foundation-section foundation-random"
      >
        <div className="foundation-copy">
          <p className="foundation-eyebrow">A Foundation project</p>

          <h2>Lit Chain</h2>

          <p>
            Lit Chain is The Literature Foundation&apos;s social
            reading platform: a place to discover literature, read
            public-domain books, save notes and progress, participate
            in groups and classes, and connect ideas across readers.
          </p>

          <a
            className="foundation-text-link"
            href={LIT_CHAIN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit LitChain.org
            <ArrowRight size={17} />
          </a>
        </div>

        <div className="foundation-product-card">
          <img
            src="/branding/lit-chain-logo-horizontal.png"
            alt="Lit Chain"
          />

          <div className="mini-reader">
            <small>A PROJECT OF THE LITERATURE FOUNDATION</small>
            <h3>Read. Connect. Continue the chain.</h3>
            <p>
              Discover, read, discuss, and learn together.
            </p>
          </div>
        </div>
      </section>

      <section className="foundation-quote">
        <blockquote>
          A public library for the digital age should do more than
          store books. It should help people discover them, read
          them, discuss them, and grow through them.
        </blockquote>
      </section>

      <section
        id="about-foundation"
        className="foundation-section foundation-about"
      >
        <div>
          <p className="foundation-eyebrow">About</p>

          <h2>
            Building lasting access to literature.
          </h2>
        </div>

        <div>
          <p>
            The Literature Foundation is an organization focused on
            preserving access to literature and building tools that
            help people engage with books more deeply.
          </p>

          <p>
            Our work centers on access, preservation, reading,
            education, discussion, and technology that helps connect
            readers with literature across generations.
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
            Support preservation, free reading tools, public-domain
            access, educational development, and community projects.
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
            <span>
              Preserving access to literature and expanding the ways
              people discover, read, discuss, and learn from it.
            </span>
          </div>
        </div>

        <div className="foundation-footer-links">
          <a
            href={LIT_CHAIN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Lit Chain
          </a>

          <a href="#about-foundation">About</a>

          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Support
          </a>

          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>

          <a href="mailto:info@theliteraturefoundation.org">
            Contact
          </a>

          <span>
            © {new Date().getFullYear()} The Literature Foundation
          </span>
        </div>
      </footer>
    </div>
  );
}
