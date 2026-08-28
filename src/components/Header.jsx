import { useEffect, useState } from "react";
import { Bell, Compass, Library, LogIn } from "lucide-react";
import { NavLink } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";
import { subscribeToUnreadNotifications } from "../services/notifications.js";

export default function Header() {
  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);

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

  const navClass = ({ isActive }) =>
    isActive ? "nav-link active" : "nav-link";

  return (
    <header className="site-header rr-header">
      <nav className="top-nav" aria-label="Lit Chain navigation">
        <NavLink to="/read/discover" className={navClass}>
          <Compass size={18} />
          <span>Discover</span>
        </NavLink>

        <NavLink
          to="/read"
          end
          className="chain-logo-link"
          aria-label="Lit Chain home"
          title="Lit Chain"
        >
          <img
            className="chain-logo-image"
            src="/branding/lit-chain-logo-horizontal.png"
            alt="Lit Chain"
          />
        </NavLink>

        {!authLoading && !user && (
          <NavLink to="/read/login" className={navClass}>
            <LogIn size={18} />
            <span>Log In</span>
          </NavLink>
        )}

        {!authLoading && user && (
          <>
            <NavLink to="/read/profile" className={navClass}>
              <Library size={18} />
              <span>My Library</span>
            </NavLink>

            <NavLink
              to="/read/notifications"
              className={navClass}
              aria-label={
                unreadCount
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              title="Notifications"
            >
              <span className="notification-bell-wrap">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
            </NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
