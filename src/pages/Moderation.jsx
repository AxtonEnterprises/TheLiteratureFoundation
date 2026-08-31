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
  Check,
  History,
  KeyRound,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  UserX,
  X
} from "lucide-react";

import { auth } from "../firebase";

import {
  getMyPlatformRole,
  getPlatformEnforcementSummary,
  getPlatformModerationActions,
  getPlatformModerationReports,
  getPlatformRoleSummary,
  resolvePlatformModerationReport
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


function targetTypeLabel(
  targetType
) {
  const labels = {
    profile:
      "Reader Profile",
    chain_entry:
      "Chain Entry",
    chain_reply:
      "Chain Reply",
    group:
      "Group",
    group_forum_post:
      "Forum Post",
    group_forum_reply:
      "Forum Reply"
  };

  return (
    labels[targetType] ||
    targetType ||
    "Content"
  );
}


function formatDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleString();
}


function profileName(
  profile,
  fallback = "Reader"
) {
  return (
    profile?.displayName ||
    (
      profile?.username
        ? `@${profile.username}`
        : fallback
    )
  );
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


function SummaryCard({
  label,
  value,
  href,
  muted = false
}) {
  return (
    <a
      href={href}
      className="panel profile-panel"
      style={{
        display:
          "block",
        textDecoration:
          "none",
        minWidth:
          0
      }}
    >
      <p className="eyebrow">
        {label}
      </p>

      <strong
        style={{
          display:
            "block",
          fontSize:
            "1.75rem",
          lineHeight:
            1.1,
          marginTop:
            "0.25rem"
        }}
      >
        {value}
      </strong>

      {muted && (
        <small className="muted">
          Available in the next phase
        </small>
      )}
    </a>
  );
}


export default function Moderation() {
  const [
    authLoading,
    setAuthLoading
  ] = useState(true);

  const [
    platformRole,
    setPlatformRole
  ] = useState(null);

  const [
    error,
    setError
  ] = useState("");

  const [
    reports,
    setReports
  ] = useState([]);

  const [
    actions,
    setActions
  ] = useState([]);

  const [
    enforcementSummary,
    setEnforcementSummary
  ] = useState({
    available: false,
    count: null
  });

  const [
    roleSummary,
    setRoleSummary
  ] = useState({
    available: false,
    count: null
  });

  const [
    queueLoading,
    setQueueLoading
  ] = useState(false);

  const [
    queueStatus,
    setQueueStatus
  ] = useState("");

  const [
    reviewingId,
    setReviewingId
  ] = useState(null);


  const [
    reportFilter,
    setReportFilter
  ] = useState("all");

  const [
    historyFilter,
    setHistoryFilter
  ] = useState("all");


  const filteredReports =
    reports.filter(
      (report) => {
        if (
          reportFilter ===
          "profiles"
        ) {
          return (
            report.targetType ===
            "profile"
          );
        }

        if (
          reportFilter ===
          "chain"
        ) {
          return [
            "chain_entry",
            "chain_reply"
          ].includes(
            report.targetType
          );
        }

        return true;
      }
    );


  const filteredActions =
    actions.filter(
      (action) => {
        if (
          historyFilter ===
          "resolved"
        ) {
          return (
            action.action ===
            "report_resolved"
          );
        }

        if (
          historyFilter ===
          "dismissed"
        ) {
          return (
            action.action ===
            "report_dismissed"
          );
        }

        return true;
      }
    );


  async function loadDashboard() {
    try {
      setQueueLoading(true);
      setQueueStatus("");

      const [
        loadedReports,
        loadedActions,
        loadedEnforcement,
        loadedRoles
      ] =
        await Promise.all([
          getPlatformModerationReports(),
          getPlatformModerationActions(),
          getPlatformEnforcementSummary(),
          getPlatformRoleSummary()
        ]);

      setReports(
        loadedReports
      );

      setActions(
        loadedActions
      );

      setEnforcementSummary(
        loadedEnforcement
      );

      setRoleSummary(
        loadedRoles
      );
    } catch (loadError) {
      console.error(
        "Could not load platform moderation dashboard:",
        loadError
      );

      setQueueStatus(
        loadError?.message ||
        "We couldn't load the moderation queue."
      );
    } finally {
      setQueueLoading(false);
    }
  }


  useEffect(() => {
    let active = true;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          if (!active) {
            return;
          }

          setError("");

          if (
            !firebaseUser
          ) {
            setPlatformRole(
              null
            );

            setAuthLoading(
              false
            );

            return;
          }

          try {
            const loadedRole =
              await getMyPlatformRole();

            if (!active) {
              return;
            }

            setPlatformRole(
              loadedRole
            );

            if (
              loadedRole
                ?.isPlatformModerator
            ) {
              const [
                loadedReports,
                loadedActions,
                loadedEnforcement,
                loadedRoles
              ] =
                await Promise.all([
                  getPlatformModerationReports(),
                  getPlatformModerationActions(),
                  getPlatformEnforcementSummary(),
                  getPlatformRoleSummary()
                ]);

              if (!active) {
                return;
              }

              setReports(
                loadedReports
              );

              setActions(
                loadedActions
              );

              setEnforcementSummary(
                loadedEnforcement
              );

              setRoleSummary(
                loadedRoles
              );
            }
          } catch (
            loadError
          ) {
            console.error(
              "Could not load platform moderation role:",
              loadError
            );

            if (!active) {
              return;
            }

            setPlatformRole(
              null
            );

            setError(
              loadError?.message ||
              "We couldn't verify your moderation access."
            );
          } finally {
            if (active) {
              setAuthLoading(
                false
              );
            }
          }
        }
      );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);


  async function handleReview(
    report,
    resolution
  ) {
    const verb =
      resolution ===
      "dismissed"
        ? "dismiss"
        : "resolve";

    const confirmed =
      window.confirm(
        `Are you sure you want to ${verb} this ${targetTypeLabel(
          report.targetType
        ).toLowerCase()} report?\n\nReason: ${report.reason || "other"}`
      );

    if (!confirmed) {
      return;
    }

    try {
      setReviewingId(
        report.id
      );

      setQueueStatus("");

      await resolvePlatformModerationReport(
        report.id,
        resolution
      );

      await loadDashboard();

      setQueueStatus(
        resolution ===
        "dismissed"
          ? "Report dismissed."
          : "Report resolved."
      );
    } catch (
      reviewError
    ) {
      console.error(
        "Could not review platform report:",
        reviewError
      );

      setQueueStatus(
        reviewError?.message ||
        "We couldn't update this report."
      );
    } finally {
      setReviewingId(
        null
      );
    }
  }


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
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap:
                "0.75rem",
              flexWrap:
                "wrap"
            }}
          >
            <span
              className="button secondary"
              style={{
                cursor:
                  "default"
              }}
            >
              <ShieldCheck
                size={16}
              />
              {roleLabel(
                platformRole.role
              )}
            </span>

            <Link
              to="/read/profile"
              className="button secondary"
            >
              <ArrowLeft
                size={16}
              />
              My Library
            </Link>
          </div>
        </section>


        <section
          aria-label="Moderation dashboard summary"
        >
          <div
            style={{
              display:
                "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(145px, 1fr))",
              gap:
                "0.75rem"
            }}
          >
            <SummaryCard
              label="Open Reports"
              value={
                reports.length
              }
              href="#open-reports"
            />

            <SummaryCard
              label="History"
              value={
                actions.length
              }
              href="#moderation-history"
            />

            {platformRole.isPlatformAdmin && (
              <SummaryCard
                label="Enforcement"
                value={
                  enforcementSummary.available
                    ? enforcementSummary.count
                    : "—"
                }
                href="#enforcement"
                muted={
                  !enforcementSummary.available
                }
              />
            )}

            {platformRole.isFoundationAdmin && (
              <SummaryCard
                label="Platform Roles"
                value={
                  roleSummary.available
                    ? roleSummary.count
                    : "—"
                }
                href="#platform-roles"
                muted={
                  !roleSummary.available
                }
              />
            )}
          </div>
        </section>


        {queueStatus && (
          <p className="status">
            {queueStatus}
          </p>
        )}


        <div id="open-reports">
        <DashboardCard
          eyebrow="Report Queue"
          title={`Open Reports (${reports.length})`}
        >
          <div
            className="button-row"
            style={{
              marginBottom:
                "1rem",
              gap:
                "0.5rem",
              flexWrap:
                "wrap"
            }}
          >
            {[
              ["all", "All"],
              ["profiles", "Profiles"],
              ["chain", "Chain"]
            ].map(
              ([
                value,
                label
              ]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    reportFilter === value
                      ? "button primary"
                      : "button secondary"
                  }
                  onClick={() =>
                    setReportFilter(
                      value
                    )
                  }
                >
                  {label}
                </button>
              )
            )}

            <button
              type="button"
              className="button secondary"
              disabled={
                queueLoading
              }
              onClick={
                loadDashboard
              }
            >
              <RefreshCw
                size={16}
              />
              Refresh
            </button>
          </div>

          {queueLoading ? (
            <p className="muted">
              Loading reports...
            </p>
          ) : reports.length ===
            0 ? (
            <p className="muted">
              There are no open platform reports.
            </p>
          ) : filteredReports.length ===
            0 ? (
            <p className="muted">
              No open reports match this filter.
            </p>
          ) : (
            <div className="public-profile-entry-list">
              {filteredReports.map(
                (report) => (
                  <article
                    key={
                      report.id
                    }
                    className="public-profile-entry"
                  >
                    <div className="section-heading-row">
                      <div>
                        <p className="eyebrow">
                          {targetTypeLabel(
                            report.targetType
                          )}
                        </p>

                        <strong className="public-entry-book-title">
                          {report.title ||
                            profileName(
                              report.targetProfile,
                              "Reported content"
                            )}
                        </strong>
                      </div>

                      <span className="button secondary">
                        Open
                      </span>
                    </div>

                    <p>
                      <strong>
                        Reason:
                      </strong>{" "}
                      {report.reason}
                    </p>

                    {report.details && (
                      <p className="muted">
                        {report.details}
                      </p>
                    )}

                    {(report.body ||
                      report.targetPreview?.note ||
                      report.targetPreview?.about) && (
                      <div className="public-entry-quote">
                        <p>
                          {report.body ||
                            report.targetPreview?.note ||
                            report.targetPreview?.about}
                        </p>
                      </div>
                    )}

                    {report.targetExists === false && (
                      <p className="status">
                        This reported content is no longer available.
                      </p>
                    )}

                    {(report.targetPath ||
                      report.targetProfilePath) && (
                      <div
                        className="button-row"
                        style={{
                          marginBottom:
                            "0.75rem",
                          gap:
                            "0.5rem",
                          flexWrap:
                            "wrap"
                        }}
                      >
                        {report.targetProfilePath && (
                          <Link
                            to={
                              report.targetProfilePath
                            }
                            className="button secondary"
                          >
                            <ExternalLink
                              size={16}
                            />
                            View Profile
                          </Link>
                        )}

                        {report.targetPath &&
                          report.targetPath !==
                            report.targetProfilePath && (
                          <Link
                            to={
                              report.targetPath
                            }
                            className="button secondary"
                          >
                            <ExternalLink
                              size={16}
                            />
                            View Chain Content
                          </Link>
                        )}
                      </div>
                    )}

                    <p className="muted">
                      Reported user:{" "}
                      {profileName(
                        report.targetProfile,
                        report.targetUserId
                      )}
                    </p>

                    <p className="muted">
                      Reported by:{" "}
                      {profileName(
                        report.reporterProfile,
                        report.reporterUserId
                      )}
                    </p>

                    {report.createdAtISO && (
                      <small className="muted">
                        {formatDate(
                          report.createdAtISO
                        )}
                      </small>
                    )}

                    <div
                      className="button-row"
                      style={{
                        marginTop:
                          "1rem"
                      }}
                    >
                      <button
                        type="button"
                        className="button primary"
                        disabled={
                          reviewingId ===
                          report.id
                        }
                        onClick={() =>
                          handleReview(
                            report,
                            "resolved"
                          )
                        }
                      >
                        <Check
                          size={16}
                        />
                        Resolve
                      </button>

                      <button
                        type="button"
                        className="button secondary"
                        disabled={
                          reviewingId ===
                          report.id
                        }
                        onClick={() =>
                          handleReview(
                            report,
                            "dismissed"
                          )
                        }
                      >
                        <X
                          size={16}
                        />
                        Dismiss
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </DashboardCard>
        </div>


        <div id="moderation-history">
        <DashboardCard
          eyebrow="Audit Log"
          title={`Moderation History (${actions.length})`}
          icon={
            <History
              size={22}
            />
          }
        >
          <div
            className="button-row"
            style={{
              marginBottom:
                "1rem",
              gap:
                "0.5rem",
              flexWrap:
                "wrap"
            }}
          >
            {[
              ["all", "All"],
              ["resolved", "Resolved"],
              ["dismissed", "Dismissed"]
            ].map(
              ([
                value,
                label
              ]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    historyFilter === value
                      ? "button primary"
                      : "button secondary"
                  }
                  onClick={() =>
                    setHistoryFilter(
                      value
                    )
                  }
                >
                  {label}
                </button>
              )
            )}
          </div>

          {actions.length ===
          0 ? (
            <p className="muted">
              No platform moderation actions have been recorded yet.
            </p>
          ) : filteredActions.length ===
            0 ? (
            <p className="muted">
              No moderation actions match this filter.
            </p>
          ) : (
            <div className="public-profile-entry-list">
              {filteredActions.map(
                (action) => {
                  const profilePath =
                    action.targetUserId
                      ? `/read/public/${action.targetUserId}`
                      : null;

                  const chainPath =
                    [
                      "chain_entry",
                      "chain_reply"
                    ].includes(
                      action.targetType
                    ) &&
                    action.bookId
                      ? `/read/reader/${action.bookId}`
                      : null;

                  return (
                    <article
                      key={
                        action.id
                      }
                      className="public-profile-entry"
                    >
                      <div className="section-heading-row">
                        <div>
                          <p className="eyebrow">
                            {action.action ===
                            "report_dismissed"
                              ? "Report Dismissed"
                              : "Report Resolved"}
                          </p>

                          <strong className="public-entry-book-title">
                            {targetTypeLabel(
                              action.targetType
                            )}
                          </strong>
                        </div>

                        <span className="button secondary">
                          Reviewed
                        </span>
                      </div>

                      <p className="muted">
                        Moderator:{" "}
                        {profileName(
                          action.moderatorProfile,
                          action.moderatorUserId
                        )}
                      </p>

                      <p className="muted">
                        Target:{" "}
                        {profileName(
                          action.targetProfile,
                          action.targetUserId
                        )}
                      </p>

                      {action.reason && (
                        <p>
                          <strong>
                            Original reason:
                          </strong>{" "}
                          {action.reason}
                        </p>
                      )}

                      {action.details && (
                        <p className="muted">
                          {action.details}
                        </p>
                      )}

                      <p className="muted">
                        Report ID:{" "}
                        {action.reportId ||
                          "Unavailable"}
                      </p>

                      <p className="muted">
                        Target ID:{" "}
                        {action.targetId ||
                          "Unavailable"}
                      </p>

                      {(profilePath ||
                        chainPath) && (
                        <div
                          className="button-row"
                          style={{
                            marginTop:
                              "0.75rem",
                            gap:
                              "0.5rem",
                            flexWrap:
                              "wrap"
                          }}
                        >
                          {profilePath && (
                            <Link
                              to={
                                profilePath
                              }
                              className="button secondary"
                            >
                              <ExternalLink
                                size={16}
                              />
                              View Profile
                            </Link>
                          )}

                          {chainPath && (
                            <Link
                              to={
                                chainPath
                              }
                              className="button secondary"
                            >
                              <ExternalLink
                                size={16}
                              />
                              View Chain Content
                            </Link>
                          )}
                        </div>
                      )}

                      {action.createdAtISO && (
                        <small className="muted">
                          {formatDate(
                            action.createdAtISO
                          )}
                        </small>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </DashboardCard>
        </div>


        <div id="enforcement">
        <DashboardCard
          eyebrow="Account Controls"
          title="Enforcement"
          icon={
            <UserX
              size={22}
            />
          }
        >
          {platformRole.isPlatformAdmin ? (
            <p className="muted">
              Account warnings, suspensions, and platform bans will be connected
              during the enforcement phase. Canonical Lit Chain blocks remain
              immutable.
            </p>
          ) : (
            <p className="muted">
              Enforcement controls are restricted to Platform Administrators and
              Foundation Administrators.
            </p>
          )}
        </DashboardCard>
        </div>


        <div id="platform-roles">
        <DashboardCard
          eyebrow="Platform Access"
          title="Platform Roles"
          icon={
            <KeyRound
              size={22}
            />
          }
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
      </div>
    </main>
  );
}
