import { useEffect, useState } from "react";

import {
  Home,
  LogIn,
  LogOut,
  MessageSquare,
  Bell,
  User
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from "../firebase";
import { subscribeToUnreadNotifications } from "../services/notifications.js";

export default function Header() {
  const navigate = useNavigate();
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

  async function handleLogout() {
    try {
      await signOut(auth);
      navigate("/read");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  const navClass = ({ isActive }) =>
    isActive ? "nav-link active" : "nav-link";

  return (
    <header className="site-header rr-header">
      <NavLink to="/read" className="brand rr-brand">
        <img
          className="rr-brand-logo"
          src="/branding/random-reads-logo.svg"
          alt="Random Reads"
        />
      </NavLink>

      <nav className="top-nav" aria-label="Random Reads navigation">
        <NavLink to="/read" end className={navClass}>
          <Home size={18} />
          <span>Home</span>
        </NavLink>

        <NavLink to="/read/margins" className={navClass}>
          <MessageSquare size={18} />
          <span>Chain</span>
        </NavLink>

        {!authLoading && !user && (
          <NavLink to="/read/login" className={navClass}>
            <LogIn size={18} />
            <span>Log In</span>
          </NavLink>
        )}

        {!authLoading && user && (
          <>
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

            <NavLink to="/read/profile" className={navClass}>
              <User size={18} />
              <span>Profile</span>
            </NavLink>

            <button type="button" className="nav-link" onClick={handleLogout}>
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </>
        )}
      </nav>

      <a className="rr-foundation-link" href="/">
        The Literature Foundation
      </a>
    </header>
  );
}
