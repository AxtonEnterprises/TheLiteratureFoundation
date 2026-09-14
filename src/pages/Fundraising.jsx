import {
  ArrowRight,
  BookOpen,
  Building2,
  Heart,
  Landmark,
  ShieldCheck,
  Sparkles
} from "lucide-react";

import FoundationHeader from "../components/FoundationHeader.jsx";
import SEO from "../components/SEO.jsx";
import "./Fundraising.css";

const SUPPORT_URL =
  "https://buy.stripe.com/fZudR897C0DL9II8wm6oo00";

const GOAL = 5000;
const RAISED = 0;
const FIRST_MILESTONE = 1500;
const FOUNDING_50_FILLED = 0;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

export default function Fundraising() {
  const percent = Math.min(100, Math.round((RAISED / GOAL) * 100));
  const spotsRemaining = Math.max(0, 50 - FOUNDING_50_FILLED);

  return (
    <div className="foundation-site fundraising-page">
      <SEO
        title="Founding 50 | Support The Literature Foundation"
        description="Help launch The Literature Foundation and support free reading tools, literary preservation, education, and Lit Chain."
        path="/support"
      />

      <FoundationHeader />

      <section className="fundraising-hero">
        <div className="fundraising-hero-copy">
          <p className="foundation-eyebrow">The Founding 50</p>

          <h1>Help build something that outlives us.</h1>

          <p className="fundraising-lede">
            Great books have survived for centuries. We want to help them survive
            centuries more. The Literature Foundation is building free tools to
            preserve, read, study, and discuss the world&apos;s great literature.
            We&apos;re raising our first {money.format(GOAL)} to help turn that
            work into a lasting institution.
          </p>

          <div className="fundraising-hero-actions">
            <a
              className="foundation-button primary"
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Heart size={19} />
              Become a founding supporter
            </a>

            <a className="fundraising-text-link" href="#founding-50">
              See the Founding 50 <ArrowRight size={17} />
            </a>
          </div>
        </div>

        <aside
          className="fundraising-goal-card"
          aria-label="Fundraising progress"
        >
          <div className="fundraising-goal-topline">
            <span>Launch goal</span>
            <strong>{percent}%</strong>
          </div>

          <div className="fundraising-amount">
            {money.format(RAISED)}{" "}
            <span>of {money.format(GOAL)}</span>
          </div>

          <div
            className="fundraising-progress"
            role="progressbar"
            aria-valuenow={RAISED}
            aria-valuemin="0"
            aria-valuemax={GOAL}
            aria-label={`${money.format(RAISED)} raised of ${money.format(GOAL)}`}
          >
            <span style={{ width: `${percent}%` }} />
          </div>

          <div className="fundraising-milestone">
            <Sparkles size={18} />
            <div>
              <strong>
                First milestone: {money.format(FIRST_MILESTONE)}
              </strong>
              <span>
                Nonprofit filings, launch expenses, and initial protection.
              </span>
            </div>
          </div>

          <div className="fundraising-spots">
            <strong>{spotsRemaining}</strong>
            <span>Founding 50 spots remaining</span>
          </div>
        </aside>
      </section>

      <section
        id="founding-50"
        className="fundraising-section fundraising-founders"
      >
        <div className="fundraising-section-heading">
          <p className="foundation-eyebrow">Be there at the beginning</p>
          <h2>Join the Founding 50.</h2>
          <p>
            We&apos;re looking for 50 people willing to contribute $100 to help
            launch The Literature Foundation. Founding 50 supporters will have
            the opportunity to be permanently recognized on our website as part
            of the group that helped build the Foundation at the beginning.
          </p>
        </div>

        <div className="fundraising-tier-grid">
          <Tier
            amount="$25"
            title="Founding Reader"
            text="Help put another brick in the foundation."
          />
          <Tier
            amount="$50"
            title="Founding Supporter"
            text="Support free literature and educational tools."
          />
          <Tier
            featured
            amount="$100"
            title="Founding 50"
            text="Become one of the first 50 people to help officially launch the Foundation."
          />
          <Tier
            amount="$250"
            title="Founding Patron"
            text="Provide substantial support toward our launch and technology."
          />
          <Tier
            amount="$500"
            title="Founding Sponsor"
            text="For individuals, families, and businesses making a major early contribution."
          />
        </div>

        <div className="fundraising-center-action">
          <a
            className="foundation-button gold"
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Support the Foundation <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section className="fundraising-section fundraising-purpose">
        <div className="fundraising-section-heading">
          <p className="foundation-eyebrow">What your support builds</p>
          <h2>A public library for the digital age.</h2>
        </div>

        <div className="fundraising-purpose-grid">
          <Purpose
            icon={<BookOpen />}
            title="Reading"
            text="Free reader-first tools that help people discover books, save progress, take notes, and read deeply."
          />
          <Purpose
            icon={<Landmark />}
            title="Preservation"
            text="Durable access to important public-domain literature and the long-term development of Lit Chain."
          />
          <Purpose
            icon={<Sparkles />}
            title="Learning"
            text="Classrooms, assignments, discussions, annotations, and communities built around literature."
          />
        </div>
      </section>

      <section className="fundraising-section fundraising-budget-section">
        <div className="fundraising-section-heading">
          <p className="foundation-eyebrow">The first $5,000</p>
          <h2>Where the money goes.</h2>
          <p>
            Early contributions are focused on the basic legal, technical, and
            operational foundation needed to launch responsibly.
          </p>
        </div>

        <div className="fundraising-budget">
          <BudgetRow
            label="Nonprofit filings & compliance"
            amount="$500"
          />
          <BudgetRow
            label="Trademark & intellectual-property protection"
            amount="$700"
          />
          <BudgetRow
            label="Hosting, domains, storage & infrastructure"
            amount="$1,000"
          />
          <BudgetRow
            label="Lit Chain development"
            amount="$1,500"
          />
          <BudgetRow
            label="Reader & educational tools"
            amount="$800"
          />
          <BudgetRow
            label="Initial operating reserve"
            amount="$500"
          />

          <div className="fundraising-budget-total">
            <strong>Total</strong>
            <strong>$5,000</strong>
          </div>
        </div>
      </section>

      <section className="fundraising-section fundraising-proof">
        <div>
          <p className="foundation-eyebrow">Already in motion</p>
          <h2>This is not a pitch deck.</h2>
        </div>

        <div>
          <p>
            The Literature Foundation is already developing a digital reader,
            paragraph-level notes and annotations, reading groups, classroom
            tools, progress tracking, social reading features, and Lit Chain
            preservation technology.
          </p>
          <p>
            Your contribution helps give work that already exists the
            organizational foundation it needs to survive and grow.
          </p>
        </div>
      </section>

      <section className="fundraising-section fundraising-business">
        <div className="fundraising-business-card">
          <Building2 size={34} />
          <div>
            <p className="foundation-eyebrow">For businesses</p>
            <h2>Become a Founding Sponsor.</h2>
            <p>
              Businesses and organizations can become Founding Sponsors with a
              contribution of $500 or more and may be permanently recognized as
              organizations that supported The Literature Foundation at its
              beginning.
            </p>
          </div>

          <a
            className="foundation-button secondary"
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Sponsor the Foundation
          </a>
        </div>
      </section>

      <section className="fundraising-section fundraising-transparency">
        <ShieldCheck size={30} />
        <div>
          <p className="foundation-eyebrow">Transparency</p>
          <h2>Where we are today.</h2>
          <p>
            The Literature Foundation is a Nevada nonprofit corporation
            currently completing its organizational filings and preparing to
            seek federal recognition as a tax-exempt organization under Section
            501(c)(3).
          </p>
          <p className="fundraising-disclaimer">
            We are not currently representing contributions as tax-deductible.
            This page will be updated as the Foundation&apos;s status changes.
          </p>
        </div>
      </section>

      <section className="fundraising-final-cta">
        <p className="foundation-eyebrow">Become part of the beginning</p>
        <h2>Literature lasts because people choose to carry it forward.</h2>
        <p>
          Help us build the institution and technology to carry it forward for
          generations to come.
        </p>

        <a
          className="foundation-button gold"
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Heart size={19} />
          Become a founding supporter
        </a>
      </section>

      <footer className="foundation-footer-new fundraising-footer">
        <div className="foundation-footer-brand">
          <img src="/branding/tlf-icon-approved.png" alt="" />
          <div>
            <strong>The Literature Foundation</strong>
            <span>
              Preserving access to literature and expanding the ways people
              discover, read, discuss, and learn from it.
            </span>
          </div>
        </div>

        <div className="foundation-footer-links">
          <a href="/">Home</a>
          <a
            href="https://litchain.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            Lit Chain
          </a>
          <a href="mailto:info@theliteraturefoundation.org">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <span>
            © {new Date().getFullYear()} The Literature Foundation
          </span>
        </div>
      </footer>
    </div>
  );
}

function Tier({ amount, title, text, featured = false }) {
  return (
    <article className={`fundraising-tier ${featured ? "featured" : ""}`}>
      {featured && (
        <span className="fundraising-tier-badge">The Founding 50</span>
      )}
      <div className="fundraising-tier-amount">{amount}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Purpose({ icon, title, text }) {
  return (
    <article className="fundraising-purpose-card">
      <div className="fundraising-purpose-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function BudgetRow({ label, amount }) {
  return (
    <div className="fundraising-budget-row">
      <span>{label}</span>
      <strong>{amount}</strong>
    </div>
  );
}
