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
  ShieldAlert,
  ShieldCheck,
  UserX,
  X
} from "lucide-react";

import { auth } from "../firebase";

import {
  getMyPlatformRole,
  applyPlatformEnforcement,
  clearPlatformEnforcement,
  getPlatformAppeals,
  getPlatformEnforcements,
  getPlatformEnforcementSummary,
  getPlatformModerationActions,
  getPlatformModerationReports,
  getPlatformRoleRecords,
  getPlatformRoleSummary,
  resolvePlatformModerationReport,
  reviewPlatformAppeal,
  searchPlatformRoleCandidates,
  setPlatformRole as updatePlatformRole
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


function moderationActionLabel(
  action
) {
  const labels = {
    report_dismissed: "Report Dismissed",
    report_resolved: "Report Resolved",
    platform_warning: "Platform Warning",
    platform_suspension: "Platform Suspension",
    platform_ban: "Platform Ban",
    platform_enforcement_cleared: "Enforcement Cleared",
    platform_appeal_approved: "Appeal Approved",
    platform_appeal_denied: "Appeal Denied",
    platform_role_assigned: "Platform Role Assigned",
    platform_role_changed: "Platform Role Changed",
    platform_role_removed: "Platform Role Removed"
  };

  return labels[action] || action || "Moderation Action";
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
    enforcements,
    setEnforcements
  ] = useState([]);

  const [
    enforcingId,
    setEnforcingId
  ] = useState(null);

  const [
    appeals,
    setAppeals
  ] = useState([]);

  const [
    reviewingAppealId,
    setReviewingAppealId
  ] = useState(null);

  const [
    roleSummary,
    setRoleSummary
  ] = useState({
    available: false,
    count: null
  });

  const [
    platformRoleRecords,
    setPlatformRoleRecords
  ] = useState([]);

  const [
    changingRoleId,
    setChangingRoleId
  ] = useState(null);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [roleSearchResults, setRoleSearchResults] = useState([]);
  const [roleSearchLoading, setRoleSearchLoading] = useState(false);
  const [selectedRoleCandidate, setSelectedRoleCandidate] = useState(null);
  const [selectedPlatformRole, setSelectedPlatformRole] = useState("platform_moderator");
  const [roleChangeReason, setRoleChangeReason] = useState("");

  const [actionDialog, setActionDialog] = useState(null);
  const [actionDialogBusy, setActionDialogBusy] = useState(false);



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
        loadedRoles,
        loadedEnforcementRecords,
        loadedAppeals,
        loadedRoleRecords
      ] =
        await Promise.all([
          getPlatformModerationReports(),
          getPlatformModerationActions(),
          getPlatformEnforcementSummary(),
          getPlatformRoleSummary(),
          platformRole?.isPlatformAdmin
            ? getPlatformEnforcements()
            : Promise.resolve([]),
          getPlatformAppeals(),
          platformRole?.isFoundationAdmin
            ? getPlatformRoleRecords()
            : Promise.resolve([])
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

      setEnforcements(
        loadedEnforcementRecords
      );

      setAppeals(
        loadedAppeals
      );

      setPlatformRoleRecords(
        loadedRoleRecords
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
                loadedRoles,
                loadedEnforcementRecords,
                loadedAppeals,
                loadedRoleRecords
              ] =
                await Promise.all([
                  getPlatformModerationReports(),
                  getPlatformModerationActions(),
                  getPlatformEnforcementSummary(),
                  getPlatformRoleSummary(),
                  loadedRole.isPlatformAdmin
                    ? getPlatformEnforcements()
                    : Promise.resolve([]),
                  getPlatformAppeals(),
                  loadedRole.isFoundationAdmin
                    ? getPlatformRoleRecords()
                    : Promise.resolve([])
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

              setEnforcements(
                loadedEnforcementRecords
              );

              setAppeals(
                loadedAppeals
              );

              setPlatformRoleRecords(
                loadedRoleRecords
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
    setActionDialog({
      type: "report_review",
      report,
      resolution,
      title:
        resolution === "dismissed"
          ? "Dismiss Report"
          : "Resolve Report",
      message:
        resolution === "dismissed"
          ? "Dismiss this report without platform enforcement?"
          : "Mark this report as resolved?",
      confirmLabel:
        resolution === "dismissed"
          ? "Dismiss Report"
          : "Resolve Report"
    });
  }



  async function handleEnforcement(
    report,
    status
  ) {
    if (!platformRole?.isPlatformAdmin) {
      setQueueStatus(
        "Platform Administrator access is required for enforcement."
      );
      return;
    }

    const labels = {
      warning: "Issue Warning",
      suspended: "Suspend Account",
      banned: "Ban Account"
    };

    setActionDialog({
      type: "enforcement",
      report,
      status,
      title: labels[status],
      message: `${labels[status]} for ${profileName(
        report.targetProfile,
        report.targetUserId
      )}?`,
      reason: report.reason || "",
      durationHours: status === "suspended" ? 168 : null,
      confirmLabel: labels[status]
    });
  }



  async function handleClearEnforcement(
    record
  ) {
    const statusLabel =
      record.status === "banned"
        ? "ban"
        : record.status === "suspended"
          ? "suspension"
          : "warning";

    setActionDialog({
      type: "clear_enforcement",
      record,
      title:
        record.status === "banned"
          ? "Unban Account"
          : record.status === "suspended"
            ? "Unsuspend Account"
            : "Clear Warning",
      message: `Remove the ${statusLabel} from ${profileName(
        record.targetProfile,
        record.userId || record.id
      )}?`,
      confirmLabel:
        record.status === "banned"
          ? "Unban"
          : record.status === "suspended"
            ? "Unsuspend"
            : "Clear Warning"
    });
  }



  async function handlePlatformRoleChange(
    targetUserId,
    currentRole = "user"
  ) {
    if (!platformRole?.isFoundationAdmin) {
      setQueueStatus(
        "Foundation Administrator access is required."
      );
      return;
    }

    setActionDialog({
      type: "role_change",
      targetUserId,
      currentRole,
      selectedRole: currentRole,
      reason: "",
      title: "Change Platform Role",
      message: `Change this account's platform access from ${roleLabel(
        currentRole
      )}.`,
      confirmLabel: "Save Role"
    });
  }



  function openPlatformRolePicker() {
    setRolePickerOpen(true);
    setRoleSearch("");
    setRoleSearchResults([]);
    setSelectedRoleCandidate(null);
    setSelectedPlatformRole("platform_moderator");
    setRoleChangeReason("");
    setQueueStatus("");
  }

  function closePlatformRolePicker() {
    if (changingRoleId) return;
    setRolePickerOpen(false);
  }

  async function handlePlatformUserSearch(event) {
    event.preventDefault();
    const term = String(roleSearch || "").trim();
    if (term.length < 2) {
      setQueueStatus("Enter at least two characters of a username or display name.");
      return;
    }

    try {
      setRoleSearchLoading(true);
      setQueueStatus("");
      const results = await searchPlatformRoleCandidates(term);
      setRoleSearchResults(results);
      if (!results.length) setQueueStatus("No matching public profiles were found.");
    } catch (error) {
      setQueueStatus(error?.message || "We couldn't search users.");
    } finally {
      setRoleSearchLoading(false);
    }
  }

  async function handleRolePickerSubmit(event) {
    event.preventDefault();
    if (!selectedRoleCandidate) {
      setQueueStatus("Select a user first.");
      return;
    }

    const reason = String(roleChangeReason || "").trim();
    if (!reason) {
      setQueueStatus("Enter a reason for the role assignment.");
      return;
    }

    const targetUserId = selectedRoleCandidate.userId || selectedRoleCandidate.id;

    try {
      setChangingRoleId(targetUserId);
      setQueueStatus("");
      await updatePlatformRole({
        targetUserId,
        role: selectedPlatformRole,
        reason
      });
      setRolePickerOpen(false);
      await loadDashboard();
      setQueueStatus(`Platform role changed to ${roleLabel(selectedPlatformRole)}.`);
    } catch (error) {
      setQueueStatus(error?.message || "We couldn't assign this platform role.");
    } finally {
      setChangingRoleId(null);
    }
  }


  async function handleAppealReview(
    appeal,
    decision
  ) {
    if (!platformRole?.isPlatformAdmin) {
      setQueueStatus(
        "Platform Administrator access is required to decide appeals."
      );
      return;
    }

    setActionDialog({
      type: "appeal_review",
      appeal,
      decision,
      reason: "",
      title:
        decision === "approved"
          ? "Approve Appeal"
          : "Deny Appeal",
      message:
        decision === "approved"
          ? "Approve this appeal and clear the active suspension or ban?"
          : "Deny this appeal and keep the current enforcement in place?",
      confirmLabel:
        decision === "approved"
          ? "Approve Appeal"
          : "Deny Appeal"
    });
  }



  function closeActionDialog() {
    if (actionDialogBusy) {
      return;
    }

    setActionDialog(null);
  }


  async function submitActionDialog(event) {
    event.preventDefault();

    if (!actionDialog || actionDialogBusy) {
      return;
    }

    const reason =
      String(
        actionDialog.reason || ""
      ).trim();

    if (
      ["enforcement", "appeal_review", "role_change"].includes(
        actionDialog.type
      ) &&
      !reason
    ) {
      setQueueStatus(
        "A reason is required."
      );
      return;
    }

    try {
      setActionDialogBusy(true);
      setQueueStatus("");

      if (actionDialog.type === "report_review") {
        const { report, resolution } = actionDialog;

        setReviewingId(report.id);

        await resolvePlatformModerationReport(
          report.id,
          resolution
        );

        setQueueStatus(
          resolution === "dismissed"
            ? "Report dismissed."
            : "Report resolved."
        );
      }

      if (actionDialog.type === "enforcement") {
        const { report, status } = actionDialog;

        setEnforcingId(report.id);

        await applyPlatformEnforcement({
          targetUserId: report.targetUserId,
          status,
          reason,
          details: report.details || "",
          durationHours:
            status === "suspended"
              ? Number(actionDialog.durationHours || 168)
              : null,
          reportId: report.id,
          targetType: report.targetType,
          targetId: report.targetId,
          bookId: report.bookId || null
        });

        setQueueStatus(
          status === "warning"
            ? "Warning recorded and report resolved."
            : status === "suspended"
              ? "Suspension recorded and report resolved."
              : "Account banned and report resolved."
        );
      }

      if (actionDialog.type === "clear_enforcement") {
        const { record } = actionDialog;

        setEnforcingId(record.id);

        await clearPlatformEnforcement(
          record.userId || record.id
        );

        setQueueStatus(
          record.status === "banned"
            ? "User unbanned."
            : record.status === "suspended"
              ? "User unsuspended."
              : "Warning cleared."
        );
      }

      if (actionDialog.type === "role_change") {
        const nextRole =
          actionDialog.selectedRole || "user";

        if (
          nextRole === actionDialog.currentRole
        ) {
          throw new Error(
            "Choose a different platform role."
          );
        }

        setChangingRoleId(
          actionDialog.targetUserId
        );

        await updatePlatformRole({
          targetUserId:
            actionDialog.targetUserId,
          role:
            nextRole,
          reason
        });

        setQueueStatus(
          `Platform role changed to ${roleLabel(nextRole)}.`
        );
      }

      if (actionDialog.type === "appeal_review") {
        const { appeal, decision } = actionDialog;

        setReviewingAppealId(
          appeal.id
        );

        await reviewPlatformAppeal({
          appealId:
            appeal.id,
          decision,
          reviewReason:
            reason
        });

        setQueueStatus(
          decision === "approved"
            ? "Appeal approved and enforcement cleared."
            : "Appeal denied. Enforcement remains active."
        );
      }

      setActionDialog(null);
      await loadDashboard();
    } catch (actionError) {
      console.error(
        "Could not complete moderation action:",
        actionError
      );

      setQueueStatus(
        actionError?.message ||
        "We couldn't complete this moderation action."
      );
    } finally {
      setActionDialogBusy(false);
      setReviewingId(null);
      setEnforcingId(null);
      setReviewingAppealId(null);
      setChangingRoleId(null);
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

            <SummaryCard
              label="Open Appeals"
              value={
                appeals.filter(
                  (appeal) =>
                    appeal.status === "open"
                ).length
              }
              href="#appeals"
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

                    {platformRole.isPlatformAdmin && (
                      <div
                        className="button-row"
                        style={{
                          marginTop: "0.5rem",
                          gap: "0.5rem",
                          flexWrap: "wrap"
                        }}
                      >
                        <button
                          type="button"
                          className="button secondary"
                          disabled={
                            enforcingId === report.id ||
                            reviewingId === report.id
                          }
                          onClick={() =>
                            handleEnforcement(report, "warning")
                          }
                        >
                          <ShieldAlert size={16} />
                          Warn
                        </button>

                        <button
                          type="button"
                          className="button secondary"
                          disabled={
                            enforcingId === report.id ||
                            reviewingId === report.id
                          }
                          onClick={() =>
                            handleEnforcement(report, "suspended")
                          }
                        >
                          <UserX size={16} />
                          Suspend
                        </button>

                        <button
                          type="button"
                          className="button secondary"
                          disabled={
                            enforcingId === report.id ||
                            reviewingId === report.id
                          }
                          onClick={() =>
                            handleEnforcement(report, "banned")
                          }
                        >
                          <X size={16} />
                          Ban
                        </button>
                      </div>
                    )}
                  </article>
                )
              )}
            </div>
          )}
        </DashboardCard>
        </div>



        <div id="appeals">
        <DashboardCard
          eyebrow="Account Appeals"
          title={`Appeals (${appeals.filter((appeal) => appeal.status === "open").length} open)`}
          icon={
            <ShieldCheck
              size={22}
            />
          }
        >
          {appeals.length === 0 ? (
            <p className="muted">
              No platform appeals have been submitted.
            </p>
          ) : (
            <div className="public-profile-entry-list">
              {appeals.map(
                (appeal) => (
                  <article
                    key={appeal.id}
                    className="public-profile-entry"
                  >
                    <div className="section-heading-row">
                      <div>
                        <p className="eyebrow">
                          {appeal.enforcementStatus === "banned"
                            ? "Ban Appeal"
                            : "Suspension Appeal"}
                        </p>

                        <strong className="public-entry-book-title">
                          {profileName(
                            appeal.appellantProfile,
                            appeal.appellantUserId
                          )}
                        </strong>
                      </div>

                      <span className="button secondary">
                        {appeal.status === "open"
                          ? "Open"
                          : appeal.status === "approved"
                            ? "Approved"
                            : "Denied"}
                      </span>
                    </div>

                    <p>
                      <strong>Appeal:</strong>{" "}
                      {appeal.explanation}
                    </p>

                    {appeal.enforcementReason && (
                      <p className="muted">
                        Original enforcement reason:{" "}
                        {appeal.enforcementReason}
                      </p>
                    )}

                    {appeal.createdAtISO && (
                      <small className="muted">
                        Submitted:{" "}
                        {formatDate(
                          appeal.createdAtISO
                        )}
                      </small>
                    )}

                    {appeal.status !== "open" &&
                      appeal.reviewReason && (
                        <p className="muted">
                          Review:{" "}
                          {appeal.reviewReason}
                        </p>
                      )}

                    <div
                      className="button-row"
                      style={{
                        marginTop: "0.75rem",
                        gap: "0.5rem",
                        flexWrap: "wrap"
                      }}
                    >
                      <Link
                        to={`/read/public/${appeal.appellantUserId}`}
                        className="button secondary"
                      >
                        <ExternalLink size={16} />
                        View Profile
                      </Link>

                      {appeal.status === "open" &&
                        platformRole.isPlatformAdmin && (
                          <>
                            <button
                              type="button"
                              className="button primary"
                              disabled={
                                reviewingAppealId === appeal.id
                              }
                              onClick={() =>
                                handleAppealReview(
                                  appeal,
                                  "approved"
                                )
                              }
                            >
                              <Check size={16} />
                              Approve
                            </button>

                            <button
                              type="button"
                              className="button secondary"
                              disabled={
                                reviewingAppealId === appeal.id
                              }
                              onClick={() =>
                                handleAppealReview(
                                  appeal,
                                  "denied"
                                )
                              }
                            >
                              <X size={16} />
                              Deny
                            </button>
                          </>
                        )}
                    </div>

                    {appeal.status === "open" &&
                      !platformRole.isPlatformAdmin && (
                        <p className="muted">
                          Platform Administrators review appeal decisions.
                        </p>
                      )}
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
              {Object.values(
                filteredActions.reduce(
                  (groups, action) => {
                    const userKey =
                      action.targetUserId ||
                      "unknown-target";

                    if (!groups[userKey]) {
                      groups[userKey] = {
                        userId:
                          action.targetUserId ||
                          null,
                        profile:
                          action.targetProfile ||
                          null,
                        actions: []
                      };
                    }

                    groups[userKey].actions.push(
                      action
                    );

                    if (
                      !groups[userKey].profile &&
                      action.targetProfile
                    ) {
                      groups[userKey].profile =
                        action.targetProfile;
                    }

                    return groups;
                  },
                  {}
                )
              )
                .sort(
                  (a, b) =>
                    String(
                      b.actions[0]?.createdAtISO ||
                      ""
                    ).localeCompare(
                      String(
                        a.actions[0]?.createdAtISO ||
                        ""
                      )
                    )
                )
                .map((group) => (
                  <details
                    key={
                      group.userId ||
                      "unknown-target"
                    }
                    className="public-profile-entry"
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        listStyle: "none"
                      }}
                    >
                      <div
                        className="section-heading-row"
                        style={{
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <p className="eyebrow">
                            Moderation History
                          </p>

                          <strong className="public-entry-book-title">
                            {profileName(
                              group.profile,
                              group.userId
                            )}
                          </strong>

                          {group.userId && (
                            <p
                              className="muted"
                              style={{
                                margin:
                                  "0.25rem 0 0"
                              }}
                            >
                              UID: {group.userId}
                            </p>
                          )}
                        </div>

                        <span className="button secondary">
                          {group.actions.length}{" "}
                          {group.actions.length === 1
                            ? "Action"
                            : "Actions"}
                        </span>
                      </div>
                    </summary>

                    <div
                      style={{
                        marginTop: "1rem"
                      }}
                    >
                      {group.actions.map(
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
                              style={{
                                padding:
                                  "1rem 0",
                                borderTop:
                                  "1px solid rgba(0, 0, 0, 0.1)"
                              }}
                            >
                              <div className="section-heading-row">
                                <div>
                                  <p className="eyebrow">
                                    {moderationActionLabel(
                                      action.action
                                    )}
                                  </p>

                                  <strong>
                                    {targetTypeLabel(
                                      action.targetType
                                    )}
                                  </strong>
                                </div>

                                {action.createdAtISO && (
                                  <small className="muted">
                                    {formatDate(
                                      action.createdAtISO
                                    )}
                                  </small>
                                )}
                              </div>

                              <p className="muted">
                                Moderator:{" "}
                                {profileName(
                                  action.moderatorProfile,
                                  action.moderatorUserId
                                )}
                              </p>

                              {action.reason && (
                                <p>
                                  <strong>
                                    Reason:
                                  </strong>{" "}
                                  {action.reason}
                                </p>
                              )}

                              {action.details && (
                                <p className="muted">
                                  {action.details}
                                </p>
                              )}

                              {action.reportId && (
                                <p className="muted">
                                  Report ID:{" "}
                                  {action.reportId}
                                </p>
                              )}

                              {action.targetId && (
                                <p className="muted">
                                  Target ID:{" "}
                                  {action.targetId}
                                </p>
                              )}

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
                            </article>
                          );
                        }
                      )}
                    </div>
                  </details>
                ))}
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
            enforcements.length === 0 ? (
              <p className="muted">
                No current platform enforcement records.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {enforcements.map((record) => (
                  <article
                    key={record.id}
                    className="public-profile-entry"
                  >
                    <p className="eyebrow">
                      {record.status === "warning"
                        ? "Warning"
                        : record.status === "suspended"
                          ? "Suspended"
                          : "Banned"}
                    </p>

                    <strong className="public-entry-book-title">
                      {profileName(
                        record.targetProfile,
                        record.userId || record.id
                      )}
                    </strong>

                    <p>
                      <strong>Reason:</strong>{" "}
                      {record.reason || "Not provided"}
                    </p>

                    {record.details && (
                      <p className="muted">
                        {record.details}
                      </p>
                    )}

                    {record.endsAtISO && (
                      <p className="muted">
                        Suspension ends:{" "}
                        {formatDate(record.endsAtISO)}
                      </p>
                    )}

                    <div
                      className="button-row"
                      style={{
                        marginTop: "0.75rem",
                        gap: "0.5rem",
                        flexWrap: "wrap"
                      }}
                    >
                      <Link
                        to={`/read/public/${record.userId || record.id}`}
                        className="button secondary"
                      >
                        <ExternalLink size={16} />
                        View Profile
                      </Link>

                      <button
                        type="button"
                        className="button secondary"
                        disabled={
                          enforcingId === record.id
                        }
                        onClick={() =>
                          handleClearEnforcement(record)
                        }
                      >
                        <Check size={16} />
                        {record.status === "banned"
                          ? "Unban"
                          : record.status === "suspended"
                            ? "Unsuspend"
                            : "Clear Warning"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            <p className="muted">
              Enforcement controls are restricted to Platform Administrators and
              Foundation Administrators.
            </p>
          )}

          <p className="muted">
            Canonical Lit Chain blocks remain immutable. Enforcement applies to
            accounts and platform participation, never to canonical block data.
          </p>
        </DashboardCard>
        </div>


        <div id="platform-roles">
        <DashboardCard
              eyebrow="Governance"
              title="Platform Roles"
              icon={<KeyRound size={22} />}
            >
              {!platformRole.isFoundationAdmin ? (
                <p className="muted">
                  Foundation Administrator access is required to manage platform roles.
                </p>
              ) : (
                <>
                  <div className="button-row" style={{ marginBottom: "1rem" }}>
                    <button
                      type="button"
                      className="button primary"
                      onClick={openPlatformRolePicker}
                    >
                      Assign Platform Role
                    </button>
                  </div>

                  {platformRoleRecords.length === 0 ? (
                    <p className="muted">No platform role records found.</p>
                  ) : (
                    <div className="public-profile-entry-list">
                      {platformRoleRecords.map((record) => (
                        <article key={record.id} className="public-profile-entry">
                          <strong>
                            {profileName(
                              record.profile,
                              record.userId || record.id
                            )}
                          </strong>
                          <p className="muted" style={{ margin: "0.25rem 0" }}>
                            {roleLabel(record.role)}
                          </p>
                          <small className="muted">
                            UID: {record.userId || record.id}
                          </small>

                          {record.role !== "foundation_admin" ? (
                            <div className="button-row" style={{ marginTop: "0.75rem" }}>
                              <button
                                type="button"
                                className="button secondary"
                                disabled={
                                  changingRoleId === (record.userId || record.id)
                                }
                                onClick={() =>
                                  handlePlatformRoleChange(
                                    record.userId || record.id,
                                    record.role
                                  )
                                }
                              >
                                Change Role
                              </button>
                            </div>
                          ) : (
                            <p className="muted">
                              Foundation Administrator is protected from client-side role changes.
                            </p>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </DashboardCard>
        </div>
      </div>

      {actionDialog && (
        <div
          role="presentation"
          onClick={closeActionDialog}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="moderation-action-title"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "min(100%, 560px)",
              maxHeight: "88vh",
              overflowY: "auto",
              background: "white",
              borderRadius: "1.5rem",
              padding: "1.25rem",
              boxShadow: "0 18px 60px rgba(0,0,0,0.25)"
            }}
          >
            <div
              className="section-heading-row"
              style={{
                alignItems: "flex-start",
                gap: "1rem"
              }}
            >
              <div>
                <p className="eyebrow">
                  Moderation Action
                </p>
                <h2
                  id="moderation-action-title"
                  style={{
                    marginTop: 0
                  }}
                >
                  {actionDialog.title}
                </h2>
              </div>

              <button
                type="button"
                className="button secondary"
                onClick={closeActionDialog}
                disabled={actionDialogBusy}
              >
                Close
              </button>
            </div>

            <p>
              {actionDialog.message}
            </p>

            {actionDialog.type === "report_review" &&
              actionDialog.report && (
                <div className="public-profile-entry">
                  <p className="eyebrow">
                    Report
                  </p>
                  <strong>
                    {targetTypeLabel(
                      actionDialog.report.targetType
                    )}
                  </strong>
                  <p className="muted">
                    Reason:{" "}
                    {actionDialog.report.reason ||
                      "other"}
                  </p>
                </div>
              )}

            <form
              onSubmit={submitActionDialog}
              style={{
                display: "grid",
                gap: "1rem",
                marginTop: "1rem"
              }}
            >
              {actionDialog.type === "enforcement" &&
                actionDialog.status === "suspended" && (
                  <label>
                    <strong>
                      Suspension length
                    </strong>
                    <select
                      value={
                        actionDialog.durationHours ||
                        168
                      }
                      onChange={(event) =>
                        setActionDialog(
                          (current) => ({
                            ...current,
                            durationHours:
                              Number(
                                event.target.value
                              )
                          })
                        )
                      }
                      style={{
                        width: "100%",
                        marginTop: "0.4rem"
                      }}
                    >
                      <option value={24}>
                        24 hours
                      </option>
                      <option value={168}>
                        7 days
                      </option>
                      <option value={720}>
                        30 days
                      </option>
                    </select>
                  </label>
                )}

              {actionDialog.type === "role_change" && (
                <label>
                  <strong>
                    Platform role
                  </strong>
                  <select
                    value={
                      actionDialog.selectedRole ||
                      "user"
                    }
                    onChange={(event) =>
                      setActionDialog(
                        (current) => ({
                          ...current,
                          selectedRole:
                            event.target.value
                        })
                      )
                    }
                    style={{
                      width: "100%",
                      marginTop: "0.4rem"
                    }}
                  >
                    <option value="user">
                      User — remove platform authority
                    </option>
                    <option value="platform_moderator">
                      Platform Moderator
                    </option>
                    <option value="platform_admin">
                      Platform Admin
                    </option>
                  </select>
                </label>
              )}

              {[
                "enforcement",
                "appeal_review",
                "role_change"
              ].includes(
                actionDialog.type
              ) && (
                <label>
                  <strong>
                    Reason
                  </strong>
                  <textarea
                    rows={4}
                    value={
                      actionDialog.reason ||
                      ""
                    }
                    onChange={(event) =>
                      setActionDialog(
                        (current) => ({
                          ...current,
                          reason:
                            event.target.value
                        })
                      )
                    }
                    placeholder="Enter the reason for this action."
                    style={{
                      width: "100%",
                      marginTop: "0.4rem"
                    }}
                  />
                </label>
              )}

              <div
                className="button-row"
                style={{
                  gap: "0.5rem",
                  flexWrap: "wrap"
                }}
              >
                <button
                  type="submit"
                  className="button primary"
                  disabled={actionDialogBusy}
                >
                  {actionDialogBusy
                    ? "Working..."
                    : actionDialog.confirmLabel}
                </button>

                <button
                  type="button"
                  className="button secondary"
                  onClick={closeActionDialog}
                  disabled={actionDialogBusy}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {rolePickerOpen && (
        <div
          onClick={closePlatformRolePicker}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem"
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(100%, 620px)",
              maxHeight: "85vh",
              overflowY: "auto",
              background: "white",
              borderRadius: "1.5rem",
              padding: "1.25rem"
            }}
          >
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">Governance</p>
                <h2 style={{ marginTop: 0 }}>Assign Platform Role</h2>
              </div>
              <button type="button" className="button secondary" onClick={closePlatformRolePicker}>
                Close
              </button>
            </div>

            {!selectedRoleCandidate ? (
              <>
                <form onSubmit={handlePlatformUserSearch}>
                  <label>
                    <strong>Search users</strong>
                    <input
                      type="search"
                      value={roleSearch}
                      onChange={(event) => setRoleSearch(event.target.value)}
                      placeholder="Username or display name"
                      autoFocus
                      style={{ width: "100%", marginTop: "0.4rem" }}
                    />
                  </label>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={roleSearchLoading}
                    style={{ marginTop: "0.75rem" }}
                  >
                    {roleSearchLoading ? "Searching..." : "Search"}
                  </button>
                </form>

                <div className="public-profile-entry-list" style={{ marginTop: "1rem" }}>
                  {roleSearchResults.map((profile) => {
                    const userId = profile.userId || profile.id;
                    return (
                      <button
                        key={userId}
                        type="button"
                        className="public-profile-entry"
                        onClick={() => {
                          setSelectedRoleCandidate(profile);
                          setSelectedPlatformRole(
                            profile.platformRole === "platform_admin"
                              ? "platform_admin"
                              : "platform_moderator"
                          );
                        }}
                        style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                      >
                        <strong>{profileName(profile, userId)}</strong>
                        {profile.username && (
                          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                            @{profile.username}
                          </p>
                        )}
                        {profile.platformRole !== "user" && (
                          <small className="muted">
                            Current role: {roleLabel(profile.platformRole)}
                          </small>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <form onSubmit={handleRolePickerSubmit}>
                <div className="public-profile-entry">
                  <p className="eyebrow">Selected User</p>
                  <strong>
                    {profileName(
                      selectedRoleCandidate,
                      selectedRoleCandidate.userId || selectedRoleCandidate.id
                    )}
                  </strong>
                  {selectedRoleCandidate.username && (
                    <p className="muted">@{selectedRoleCandidate.username}</p>
                  )}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setSelectedRoleCandidate(null)}
                  >
                    Choose Different User
                  </button>
                </div>

                <label style={{ display: "block", marginTop: "1rem" }}>
                  <strong>Platform role</strong>
                  <select
                    value={selectedPlatformRole}
                    onChange={(event) => setSelectedPlatformRole(event.target.value)}
                    style={{ width: "100%", marginTop: "0.4rem" }}
                  >
                    <option value="platform_moderator">Platform Moderator</option>
                    <option value="platform_admin">Platform Admin</option>
                  </select>
                </label>

                <label style={{ display: "block", marginTop: "1rem" }}>
                  <strong>Reason</strong>
                  <textarea
                    value={roleChangeReason}
                    onChange={(event) => setRoleChangeReason(event.target.value)}
                    rows={4}
                    placeholder="Why is this user being assigned this role?"
                    style={{ width: "100%", marginTop: "0.4rem" }}
                  />
                </label>

                <div className="button-row" style={{ marginTop: "1rem", gap: "0.5rem" }}>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={Boolean(changingRoleId)}
                  >
                    {changingRoleId ? "Assigning..." : "Confirm Assignment"}
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={closePlatformRolePicker}
                    disabled={Boolean(changingRoleId)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

    </main>
  );
}
