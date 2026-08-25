import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../services/notifications.js";

function labelFor(item) {
  if (item.message) return item.message;
  const actor = item.actorName || "A reader";
  const group = item.groupName ? ` in ${item.groupName}` : "";

  switch (item.type) {
    case "friend_request":
      return `${actor} sent you a friend request.`;
    case "friend_accepted":
      return `${actor} accepted your friend request.`;
    case "group_invite":
      return `${actor} invited you to ${item.groupName || "a group"}.`;
    case "group_invite_accepted":
      return `${actor} accepted your invitation to ${item.groupName || "your group"}.`;
    case "margin_reply":
      return `${actor} replied to your Margin.`;
    case "group_margin_reply":
      return `${actor} replied to your Margin${group}.`;
    case "forum_reply":
      return `${actor} replied to your group discussion${group}.`;
    default:
      return `${actor} sent you a notification.`;
  }
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "numeric",
    minute: "2-digit"
  });
}

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      setItems(await getNotifications());
    } catch (err) {
      console.error(err);
      setError("Couldn't load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openNotification(item) {
    try {
      if (!item.read) {
        await markNotificationRead(item.id);
        setItems(current =>
          current.map(n => n.id === item.id ? { ...n, read: true } : n)
        );
      }
    } finally {
      if (item.targetPath) navigate(item.targetPath);
    }
  }

  async function markAll() {
    try {
      await markAllNotificationsRead();
      setItems(current => current.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error(err);
      setError("Couldn't mark notifications as read.");
    }
  }

  const unread = items.filter(item => !item.read).length;

  return (
    <section className="notifications-page">
      <div className="notifications-shell">
        <div className="notifications-heading">
          <div>
            <p className="eyebrow">SOCIAL ACTIVITY</p>
            <h1>Notifications</h1>
          </div>

          {unread > 0 && (
            <button
              type="button"
              className="notification-mark-all"
              onClick={markAll}
            >
              <CheckCheck size={18} />
              Mark all as read
            </button>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}

        {loading ? (
          <p className="notifications-empty">Loading notifications…</p>
        ) : items.length === 0 ? (
          <div className="notifications-empty notification-empty-card">
            <Bell size={30} />
            <h2>Nothing new yet</h2>
            <p>
              Friend requests, group invitations, Margin replies, and forum
              activity will appear here.
            </p>
          </div>
        ) : (
          <div className="notification-list">
            {items.map(item => (
              <button
                type="button"
                key={item.id}
                className={`notification-item${item.read ? "" : " unread"}`}
                onClick={() => openNotification(item)}
              >
                <span className="notification-avatar">
                  {item.actorAvatar ? (
                    <img src={item.actorAvatar} alt="" />
                  ) : (
                    <Bell size={20} />
                  )}
                </span>

                <span className="notification-copy">
                  <span className="notification-message">{labelFor(item)}</span>
                  <span className="notification-date">
                    {formatDate(item.createdAtISO)}
                  </span>
                </span>

                {!item.read && (
                  <span className="notification-unread-dot" aria-label="Unread" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
