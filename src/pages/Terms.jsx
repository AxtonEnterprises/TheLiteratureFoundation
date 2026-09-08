import { Link } from "react-router-dom";

import SEO from "../components/SEO.jsx";
import FoundationHeader from "../components/FoundationHeader.jsx";

export default function Terms() {
  return (
    <main className="page-wrap">
      <SEO
        title="Terms of Use | The Literature Foundation"
        description="Terms governing use of The Literature Foundation website."
        path="/terms"
      />

      <FoundationHeader />

      <div className="stack-lg">
        <section className="hero-card small">
          <p className="eyebrow">Legal</p>
          <h1>Terms of Use</h1>
          <p className="muted">Last updated: September 7, 2026</p>
        </section>

        <section className="panel legal-page">
          <div className="legal-content">
            <h2>Use of this website</h2>
            <p>
              The Literature Foundation website provides information about the
              Foundation, its mission, programs, projects, and ways to support
              its work.
            </p>
            <p>
              You agree to use the website lawfully and not to interfere with
              its operation, security, or availability.
            </p>

            <h2>Foundation projects</h2>
            <p>
              The Foundation may develop or support independent projects,
              including Lit Chain. Those projects may operate on separate
              websites and may have their own terms, privacy policies, and
              account requirements.
            </p>
            <p>
              Lit Chain is available at{" "}
              <a href="https://litchain.org" target="_blank" rel="noopener noreferrer">
                LitChain.org
              </a>.
            </p>

            <h2>Website content</h2>
            <p>
              Foundation website content is provided for informational
              purposes. We may update, remove, or revise website content and
              program information at any time.
            </p>

            <h2>Third-party links</h2>
            <p>
              The website may link to third-party services or resources. We are
              not responsible for the content, availability, or practices of
              third-party websites.
            </p>

            <h2>Support payments</h2>
            <p>
              Financial support helps fund the development and operation of The
              Literature Foundation and its projects.
            </p>
            <p>
              Unless and until the Foundation expressly states otherwise,
              contributions should not be assumed to be tax-deductible
              charitable donations.
            </p>

            <h2>Availability</h2>
            <p>
              The website is provided on an available basis. We may modify,
              suspend, discontinue, or update features or content at any time.
            </p>

            <h2>No warranty</h2>
            <p>
              The website and its content are provided without a guarantee that
              they will always be accurate, complete, uninterrupted, or
              error-free.
            </p>

            <h2>Changes to these terms</h2>
            <p>
              We may update these Terms as the Foundation website or its
              activities develop. Continued use of the website after changes
              take effect constitutes acceptance of the updated Terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions may be sent to{" "}
              <a href="mailto:info@theliteraturefoundation.org">
                info@theliteraturefoundation.org
              </a>.
            </p>
            <p><Link to="/">Return to The Literature Foundation</Link></p>
          </div>
        </section>
      </div>
    </main>
  );
}
