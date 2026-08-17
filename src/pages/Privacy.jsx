import { Link } from "react-router-dom";

import SEO from "../components/SEO.jsx";

export default function Privacy() {
  return (
    <main className="page-wrap">
      <SEO
        title="Privacy Policy | The Literature Foundation"
        description="Privacy information for The Literature Foundation and Random Reads."
        path="/privacy"
      />

      <div className="stack-lg">
        <section className="hero-card small">
          <p className="eyebrow">Privacy</p>

          <h1>Privacy Policy</h1>

          <p className="muted">
            Last updated: August 17, 2026
          </p>
        </section>

        <section className="panel legal-page">
          <div className="legal-content">
            <h2>Information we collect</h2>

            <p>
              You may use portions of The Literature Foundation
              and Random Reads without creating an account.
              If you create or use a Random Reads account, we may
              process information associated with your account,
              including your email address and authentication
              information.
            </p>

            <p>
              Random Reads may also store information you choose
              to save, including saved books, reading progress,
              journal entries, and related reading activity.
            </p>

            <h2>Authentication</h2>

            <p>
              Random Reads uses Firebase Authentication to provide
              account services. Users may sign in using an email
              address and password or, where available, a Google
              account.
            </p>

            <p>
              Authentication providers may process information
              according to their own privacy policies.
            </p>

            <h2>How we use information</h2>

            <p>
              We use information to operate Random Reads, maintain
              user accounts, synchronize saved reading information,
              improve our services, protect the security of the
              service, and respond to support requests.
            </p>

            <h2>Data storage</h2>

            <p>
              Account and reading information may be stored using
              Google Firebase services. Some information may also
              be stored locally on your device to support app
              functionality and offline or persistent use.
            </p>

            <h2>Public-domain book services</h2>

            <p>
              Random Reads may retrieve public-domain book
              information and reading materials from third-party
              services such as Project Gutenberg and related
              public-domain book APIs.
            </p>

            <h2>Sharing of information</h2>

            <p>
              We do not sell your personal information. Information
              may be processed by service providers that are
              necessary to operate the website and Random Reads,
              such as hosting, authentication, database, and
              infrastructure providers.
            </p>

            <h2>Data choices</h2>

            <p>
              You may choose not to create an account. You may
              contact us regarding questions about your account or
              stored information.
            </p>

            <h2>Children</h2>

            <p>
              The service is intended to support reading and
              education. We do not knowingly use the service to
              solicit unnecessary personal information from
              children.
            </p>

            <h2>Changes to this policy</h2>

            <p>
              We may update this Privacy Policy as the service
              changes. The date at the top of this page indicates
              the most recent revision.
            </p>

            <h2>Contact</h2>

            <p>
              Questions about privacy may be sent to{" "}
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
