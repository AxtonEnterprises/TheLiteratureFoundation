import { Link } from "react-router-dom";

import FoundationHeader from "../components/FoundationHeader.jsx";
import SEO from "../components/SEO.jsx";

export default function Privacy() {
  return (
    <main className="page-wrap">
      <SEO
        title="Privacy Policy | The Literature Foundation"
        description="Privacy information for The Literature Foundation website."
        path="/privacy"
      />

      <FoundationHeader />

      <div className="stack-lg">
        <section className="hero-card small">
          <p className="eyebrow">Privacy</p>
          <h1>Privacy Policy</h1>
          <p className="muted">Last updated: September 7, 2026</p>
        </section>

        <section className="panel legal-page">
          <div className="legal-content">
            <h2>About this policy</h2>
            <p>
              This Privacy Policy applies to The Literature Foundation website at
              TheLiteratureFoundation.org. Lit Chain is a separate project with
              its own website and privacy policy.
            </p>

            <h2>Information we collect</h2>
            <p>
              The Foundation website may receive information you voluntarily
              provide, such as information included in emails, support requests,
              or other direct communications.
            </p>
            <p>
              Basic technical information may also be processed by our hosting
              and infrastructure providers as necessary to deliver and secure
              the website.
            </p>

            <h2>How we use information</h2>
            <p>
              We use information to operate the Foundation website, respond to
              communications, improve our programs and projects, maintain
              security, and support the Foundation&apos;s mission.
            </p>

            <h2>Payments and support</h2>
            <p>
              If you choose to financially support the Foundation, payment
              information is processed by our payment provider. The Foundation
              does not receive or store your full payment-card details.
            </p>

            <h2>Third-party services</h2>
            <p>
              The Foundation may use third-party services for hosting,
              infrastructure, analytics, communications, or payments. Those
              providers may process information according to their own policies
              as necessary to provide their services.
            </p>

            <h2>Lit Chain</h2>
            <p>
              Lit Chain operates at{" "}
              <a href="https://litchain.org" target="_blank" rel="noopener noreferrer">
                LitChain.org
              </a>{" "}
              and has its own account, authentication, community, reading, and
              data practices.
            </p>
            <p>
              You can review the Lit Chain Privacy Policy at{" "}
              <a href="https://litchain.org/privacy" target="_blank" rel="noopener noreferrer">
                litchain.org/privacy
              </a>.
            </p>

            <h2>Sharing of information</h2>
            <p>
              We do not sell personal information. Information may be processed
              by service providers that are necessary to operate the website or
              fulfill services you request.
            </p>

            <h2>Children</h2>
            <p>
              The Foundation supports literacy and education but does not use
              this website to intentionally solicit unnecessary personal
              information from children.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              We may update this Privacy Policy as the Foundation website,
              programs, or services change. The date above indicates the most
              recent revision.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about privacy may be sent to{" "}
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
