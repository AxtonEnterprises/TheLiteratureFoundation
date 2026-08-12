import {
  BookOpen,
  Heart,
  Library,
  ShieldCheck,
  Sparkles,
  ExternalLink
} from "lucide-react";

export default function About() {
  return (
    <main className="page-wrap">
      <div className="stack-lg">

        <section className="hero-card about-hero">
          <p className="eyebrow">
            A Project of The Literature Foundation
          </p>

          <h1>
            Great books should be easy to discover,
            read, and remember.
          </h1>

          <p className="about-lead">
            Random Reads is a free reading platform built by
            The Literature Foundation to make classic literature
            more accessible and encourage lifelong reading.
          </p>

          <div className="button-row">
            <a
              href="https://theliteraturefoundation.org"
              target="_blank"
              rel="noopener noreferrer"
              className="button primary large"
            >
              Visit The Literature Foundation
              <ExternalLink size={18} />
            </a>
          </div>
        </section>

        <section className="about-section">
          <div className="about-section-heading">
            <p className="eyebrow">Our Mission</p>
            <h2>
              Literature belongs to everyone.
            </h2>
          </div>

          <div className="about-copy">
            <p>
              The Literature Foundation exists to expand access
              to literature, encourage meaningful reading, and
              build tools that help people engage more deeply
              with the written word.
            </p>

            <p>
              Random Reads is the Foundation&apos;s discovery
              and reading platform: a simple way to encounter
              books you may never have otherwise found, begin
              reading immediately, and build a personal reading
              history over time.
            </p>
          </div>
        </section>

        <section className="about-feature-grid">

          <article className="about-feature">
            <div className="about-icon">
              <Sparkles size={24} />
            </div>

            <h3>Discover</h3>

            <p>
              Find something unexpected through random
              recommendations or search a growing library of
              public-domain literature.
            </p>
          </article>

          <article className="about-feature">
            <div className="about-icon">
              <BookOpen size={24} />
            </div>

            <h3>Read</h3>

            <p>
              Open books directly in the Random Reads reader
              without subscriptions, paywalls, or unnecessary
              distractions.
            </p>
          </article>

          <article className="about-feature">
            <div className="about-icon">
              <Library size={24} />
            </div>

            <h3>Remember</h3>

            <p>
              Save your reading progress and journal your
              thoughts so books become part of an ongoing
              personal library rather than a forgotten list.
            </p>
          </article>

        </section>

        <section className="about-vision">
          <div className="about-vision-content">
            <p className="eyebrow">
              The Bigger Vision
            </p>

            <h2>
              Reading is only the beginning.
            </h2>

            <p>
              The Literature Foundation is building toward a
              broader ecosystem for reading, learning, and
              demonstrating knowledge.
            </p>

            <p>
              Future Random Reads features are intended to
              connect reading journals, reading history,
              community participation, and Proof of Reading
              into a meaningful record of literary engagement.
            </p>
          </div>

          <div className="about-vision-card">
            <ShieldCheck size={34} />

            <strong>
              Proof of Reading
            </strong>

            <p>
              A developing system designed to move beyond
              simply tracking whether a page was opened and
              toward demonstrating genuine engagement with a
              work.
            </p>
          </div>
        </section>

        <section className="about-support">
          <div className="about-support-icon">
            <Heart size={28} />
          </div>

          <div>
            <p className="eyebrow">
              Support the Mission
            </p>

            <h2>
              Help keep literature accessible.
            </h2>

            <p>
              Random Reads is built as part of The Literature
              Foundation&apos;s mission to make literature and
              learning more accessible.
            </p>
          </div>

          <a
            href="https://theliteraturefoundation.org"
            target="_blank"
            rel="noopener noreferrer"
            className="button secondary large"
          >
            Learn More
            <ExternalLink size={18} />
          </a>
        </section>

        <footer className="foundation-footer">
          <p>
            Random Reads is a project of{" "}
            <strong>The Literature Foundation.</strong>
          </p>

          <a
            href="https://theliteraturefoundation.org"
            target="_blank"
            rel="noopener noreferrer"
            className="foundation-link"
          >
            theliteraturefoundation.org
            <ExternalLink size={15} />
          </a>
        </footer>

      </div>
    </main>
  );
}
