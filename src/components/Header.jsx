import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Ban,
  BookOpen,
  Compass,
  Library,
  LogIn,
  Users
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";
import { subscribeToUnreadNotifications } from "../services/notifications.js";
import {
  submitPlatformAppeal,
  subscribeToMyPlatformEnforcement
} from "../services/platformModeration.js";

function formatEnforcementDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString();
}

export default function Header() {
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [enforcement, setEnforcement] = useState(null);
  const [appealStatus, setAppealStatus] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return undefined;
    }
    return subscribeToUnreadNotifications(setUnreadCount);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setEnforcement(null);
      return undefined;
    }
    return subscribeToMyPlatformEnforcement(setEnforcement);
  }, [user]);

  const bottomNavClass = ({ isActive }) =>
    isActive ? "lit-bottom-nav-link active" : "lit-bottom-nav-link";

  async function handleAppeal() {
    if (!enforcement || !["suspended", "banned"].includes(enforcement.status)) {
      return;
    }

    const explanation = window.prompt(
      "Explain why you believe this suspension or ban should be reviewed:"
    );

    if (explanation === null || !String(explanation).trim()) return;

    try {
      setAppealSubmitting(true);
      setAppealStatus("");

      await submitPlatformAppeal(explanation);

      setAppealStatus(
        "Appeal submitted. A platform administrator will review it."
      );
    } catch (error) {
      setAppealStatus(
        error?.message || "We couldn't submit your appeal."
      );
    } finally {
      setAppealSubmitting(false);
    }
  }

  return (
    <>
      <header className="lit-top-header">
        <div className="lit-top-header-inner">
          <span className="lit-top-header-side" aria-hidden="true" />

          <NavLink
            to="/read"
            end
            className="lit-top-logo"
            aria-label="Lit Chain home"
          >
            <img
              src="/branding/lit-chain-logo-horizontal.png"
              alt="Lit Chain"
            />
          </NavLink>

          {!authLoading && user ? (
            <NavLink
              to="/read/notifications"
              className={({ isActive }) =>
                isActive
                  ? "lit-top-action active"
                  : "lit-top-action"
              }
              aria-label={
                unreadCount
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              title="Notifications"
            >
              <span className="notification-bell-wrap">
                <Bell size={21} />
                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
            </NavLink>
          ) : !authLoading ? (
            <NavLink
              to="/read/login"
              className="lit-top-action"
              aria-label="Log in"
              title="Log in"
            >
              <LogIn size={20} />
            </NavLink>
          ) : (
            <span className="lit-top-header-side" aria-hidden="true" />
          )}
        </div>
      </header>

      {user && enforcement && (
        <section
          role="alert"
          style={{
            margin: "0 auto",
            maxWidth: "1180px",
            padding: "0.75rem 1rem"
          }}
        >
          <div className="panel" style={{ padding: "0.9rem 1rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem"
              }}
            >
              {enforcement.status === "banned" ? (
                <Ban size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}

              <div>
                <strong>
                  {enforcement.status === "warning"
                    ? "Platform Warning"
                    : enforcement.status === "suspended"
                      ? "Account Suspended"
                      : "Account Banned"}
                </strong>

                <p style={{ margin: "0.35rem 0 0" }}>
                  {enforcement.reason ||
                    "A platform moderation action has been applied to your account."}
                </p>

                {enforcement.details && (
                  <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                    {enforcement.details}
                  </p>
                )}

                {enforcement.status === "suspended" &&
                  enforcement.endsAtISO && (
                    <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                      Suspension ends: {formatEnforcementDate(enforcement.endsAtISO)}
                    </p>
                  )}

                {["suspended", "banned"].includes(enforcement.status) && (
                  <div
                    className="button-row"
                    style={{
                      marginTop: "0.75rem",
                      gap: "0.5rem",
                      flexWrap: "wrap"
                    }}
                  >
                    <button
                      type="button"
                      className="button secondary"
                      disabled={appealSubmitting}
                      onClick={handleAppeal}
                    >
                      {appealSubmitting ? "Submitting..." : "Appeal"}
                    </button>
                  </div>
                )}

                {appealStatus && (
                  <p className="status" style={{ margin: "0.5rem 0 0" }}>
                    {appealStatus}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <nav className="lit-bottom-nav" aria-label="Primary navigation">
        <NavLink to="/read/discover" className={bottomNavClass}>
          <Compass size={21} />
          <span>Discover</span>
        </NavLink>

        <NavLink to="/read" end className={bottomNavClass}>
          <BookOpen size={21} />
          <span>Chain</span>
        </NavLink>

        <NavLink to="/read/groups" className={bottomNavClass}>
          <Users size={21} />
          <span>Groups</span>
        </NavLink>

        {user ? (
          <NavLink to="/read/profile" className={bottomNavClass}>
            <Library size={21} />
            <span>Library</span>
          </NavLink>
        ) : (
          <NavLink to="/read/login" className={bottomNavClass}>
            <LogIn size={21} />
            <span>Log In</span>
          </NavLink>
        )}
      </nav>
    </>
  );
}
