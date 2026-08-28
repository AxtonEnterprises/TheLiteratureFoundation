import {
  BookOpen,
  Heart,
  Library,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  ExternalLink
} from "lucide-react";
import SEO from "../components/SEO.jsx";

export default function About() {
  return (
    <main className="page-wrap">
      <SEO
        title="About Lit Chain | The Literature Foundation"
        description="Learn how Lit Chain helps people discover, read, save, discuss, and engage with classic public-domain literature."
        path="/read/about"
        image="https://theliteraturefoundation.org/branding/lit-chain-icon.png"
      />

      <div className="stack-lg">
        <section className="hero-card about-hero">
          <p className="eyebrow">
            A Project of The Literature Foundation
          </p>

          <h1>
            Great literature should be easy to discover,
            read, preserve, and discuss.
          </h1>

          <p className="about-lead">
            Lit Chain is a free literary platform built by
            The Literature Foundation for reading, discovery,
            reflection, and community around the written word.
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
              Lit Chain brings those goals together in one
              platform: discover books, read them directly,
              preserve your reading history and notes, and
              participate in a community built around literature.
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
              Open books directly in the Lit Chain reader
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
              Save your reading progress, notes, and journal
              entries so books become part of an ongoing
              personal library.
            </p>
          </article>

          <article className="about-feature">
            <div className="about-icon">
              <MessageSquare size={24} />
            </div>

            <h3>Connect</h3>

            <p>
              Share ideas through the Chain, participate in
              groups, and engage with other readers around
              books and passages.
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
              Lit Chain is part of a broader effort to preserve
              literature, deepen literary engagement, and build
              an enduring record of reading and learning.
            </p>

            <p>
              Reading history, notes, groups, community
              participation, and future Proof of Reading tools
              are designed to work together as a meaningful
              record of literary engagement.
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
              Lit Chain is built as part of The Literature
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
            Lit Chain is a project of{" "}
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
