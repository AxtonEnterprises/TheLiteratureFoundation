import { Link } from "react-router-dom";

import SEO from "../components/SEO.jsx";
import FoundationHeader from "../components/FoundationHeader.jsx";

export default function Terms() {
  return (
    <main className="page-wrap">
      <SEO
        title="Terms of Use | The Literature Foundation"
        description="Terms governing use of The Literature Foundation and Random Reads."
        path="/terms"
      />
      <FoundationHeader />

      <div className="stack-lg">
        <section className="hero-card small">
          <p className="eyebrow">Legal</p>

          <h1>Terms of Use</h1>

          <p className="muted">
            Last updated: August 17, 2026
          </p>
        </section>

        <section className="panel legal-page">
          <div className="legal-content">
            <h2>Use of the service</h2>

            <p>
              The Literature Foundation and Random Reads provide
              tools for discovering, reading, saving, and reflecting
              on literature.
            </p>

            <p>
              You agree to use the service lawfully and not to
              interfere with its operation, security, or access by
              other users.
            </p>

            <h2>Accounts</h2>

            <p>
              Some Random Reads features require an account. You are
              responsible for maintaining the security of your
              account credentials and for activity performed through
              your account.
            </p>

            <h2>Reading materials</h2>

            <p>
              Random Reads primarily provides access to or links to
              public-domain literature supplied by third-party
              sources. Public-domain status may vary by jurisdiction,
              and users are responsible for complying with laws that
              apply in their location.
            </p>

            <h2>User content</h2>

            <p>
              You retain ownership of original journal entries,
              notes, and other content you create through the
              service.
            </p>

            <p>
              By storing content through the service, you grant us
              permission to process and store that content as needed
              to provide the features you request.
            </p>

            <h2>Availability</h2>

            <p>
              The service is provided on an available basis. We may
              modify, suspend, discontinue, or update features at any
              time.
            </p>

            <h2>No warranty</h2>

            <p>
              The service and its content are provided without a
              guarantee that they will always be accurate, complete,
              uninterrupted, or error-free.
            </p>

            <h2>Educational information</h2>

            <p>
              Reading, learning, and educational tools provided
              through the service are informational resources and
              are not a substitute for professional educational,
              legal, financial, or other professional advice.
            </p>

            <h2>Support payments</h2>

            <p>
              Financial support helps fund the development and
              operation of The Literature Foundation and its
              projects. The Literature Foundation does not currently
              represent contributions as tax-deductible charitable
              donations.
            </p>

            <h2>Changes to these terms</h2>

            <p>
              We may update these Terms as the service develops.
              Continued use of the service after changes take effect
              constitutes acceptance of the updated Terms.
            </p>

            <h2>Contact</h2>

            <p>
              Questions may be sent to{" "}
              <a href="mailto:info@theliteraturefoundation.org">
                info@theliteraturefoundation.org
              </a>.
            </p>

            <p>
              <Link to="/">Return to The Literature Foundation</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
