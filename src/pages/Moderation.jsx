import {
  useEffect,
  useState
} from "react";

import {
  onAuthStateChanged
} from "firebase/auth";

import {
  Link
} from "react-router-dom";

import {
  ArrowLeft,
  Flag,
  History,
  KeyRound,
  ShieldCheck,
  UserX
} from "lucide-react";

import { auth } from "../firebase";

import {
  getMyPlatformRole
} from "../services/platformModeration.js";

import SEO from "../components/SEO.jsx";


function roleLabel(role) {
  if (role === "foundation_admin") {
    return "Foundation Admin";
  }

  if (role === "platform_admin") {
    return "Platform Admin";
  }

  if (role === "platform_moderator") {
    return "Platform Moderator";
  }

  return "User";
}


function DashboardCard({
  icon,
  eyebrow,
  title,
  children
}) {
  return (
    <section className="panel profile-panel">
      <div
        className="section-heading-row"
        style={{
          alignItems: "flex-start"
        }}
      >
        <div>
          <p className="eyebrow">
            {eyebrow}
          </p>

          <h2>
            {title}
          </h2>
        </div>

        {icon}
      </div>

      {children}
    </section>
  );
}


export default function Moderation() {
  const [authLoading, setAuthLoading] = useState(true);
  const [platformRole, setPlatformRole] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        if (!active) return;

        setError("");

        if (!firebaseUser) {
          setPlatformRole(null);
          setAuthLoading(false);
          return;
        }

        try {
          const loadedRole = await getMyPlatformRole();

          if (!active) return;

          setPlatformRole(loadedRole);
        } catch (loadError) {
          console.error(
            "Could not load platform moderation role:",
            loadError
          );

          if (!active) return;

          setPlatformRole(null);
          setError(
            loadError?.message ||
            "We couldn't verify your moderation access."
          );
        } finally {
          if (active) {
            setAuthLoading(false);
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);


  if (authLoading) {
    return (
      <main className="page-wrap">
        <SEO
          title="Moderation | Lit Chain"
          description="Lit Chain platform moderation."
          path="/read/moderation"
          noindex
        />

        <section className="hero-card small">
          <p className="eyebrow">
            Platform Moderation
          </p>

          <h1>
            Verifying access...
          </h1>
        </section>
      </main>
    );
  }


  if (!auth.currentUser) {
    return (
      <main className="page-wrap">
        <SEO
          title="Moderation | Lit Chain"
          description="Lit Chain platform moderation."
          path="/read/moderation"
          noindex
        />

        <section className="hero-card small">
          <p className="eyebrow">
            Platform Moderation
          </p>

          <h1>
            Log in to continue.
          </h1>

          <p>
            Platform moderation requires an authorized Lit Chain account.
          </p>

          <Link
            to="/read/login"
            className="button primary"
          >
            Log In
          </Link>
        </section>
      </main>
    );
  }


  if (
    error ||
    !platformRole?.isPlatformModerator
  ) {
    return (
      <main className="page-wrap">
        <SEO
          title="Moderation | Lit Chain"
          description="Lit Chain platform moderation."
          path="/read/moderation"
          noindex
        />

        <section className="hero-card small">
          <p className="eyebrow">
            Platform Moderation
          </p>

          <h1>
            Access denied.
          </h1>

          <p>
            {error ||
              "Your account does not have platform moderation access."}
          </p>

          <Link
            to="/read/profile"
            className="button secondary"
          >
            <ArrowLeft size={16} />
            Back to My Library
          </Link>
        </section>
      </main>
    );
  }


  return (
    <main className="page-wrap">
      <SEO
        title="Moderation | Lit Chain"
        description="Lit Chain platform moderation dashboard."
        path="/read/moderation"
        noindex
      />

      <div className="stack-lg">
        <section className="hero-card small">
          <p className="eyebrow">
            Platform Moderation
          </p>

          <h1>
            Moderation Dashboard
          </h1>

          <p>
            Review platform reports and moderation activity across Lit Chain.
            Group moderation remains managed within each group.
          </p>

          <div
            className="button-row"
            style={{
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap"
            }}
          >
            <span
              className="button secondary"
              style={{
                cursor: "default"
              }}
            >
              <ShieldCheck size={16} />
              {roleLabel(platformRole.role)}
            </span>

            <Link
              to="/read/profile"
              className="button secondary"
            >
              <ArrowLeft size={16} />
              My Library
            </Link>
          </div>
        </section>


        <DashboardCard
          eyebrow="Report Queue"
          title="Open Reports"
          icon={<Flag size={22} />}
        >
          <p className="muted">
            Global reports for public profiles, Chain entries, Chain replies,
            groups, forum posts, and forum replies will appear here.
          </p>

          <p className="muted">
            Report loading and resolution controls are the next Phase 4.3A step.
          </p>
        </DashboardCard>


        <DashboardCard
          eyebrow="Audit Log"
          title="Moderation History"
          icon={<History size={22} />}
        >
          <p className="muted">
            Append-only platform moderation actions will appear here.
          </p>
        </DashboardCard>


        <DashboardCard
          eyebrow="Account Controls"
          title="Enforcement"
          icon={<UserX size={22} />}
        >
          <p className="muted">
            Account warnings, suspensions, and platform bans will be connected
            during the enforcement phase. Canonical Lit Chain blocks remain
            immutable.
          </p>
        </DashboardCard>


        <DashboardCard
          eyebrow="Platform Access"
          title="Platform Roles"
          icon={<KeyRound size={22} />}
        >
          {platformRole.isFoundationAdmin ? (
            <p className="muted">
              Foundation administrators will manage platform moderator and
              platform administrator assignments here.
            </p>
          ) : (
            <p className="muted">
              Platform role management is restricted to Foundation administrators.
            </p>
          )}
        </DashboardCard>
      </div>
    </main>
  );
}
