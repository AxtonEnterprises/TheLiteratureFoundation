import {
  useEffect,
  useState
} from "react";

import {
  Bell,
  CheckCheck
} from "lucide-react";

import {
  useNavigate
} from "react-router-dom";

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../services/notifications.js";

import {
  getProfileAvatar
} from "../data/avatars.js";


function labelFor(
  item
) {
  if (
    item.message
  ) {
    return item.message;
  }

  const actor =
    item.actorName ||
    "A reader";

  const group =
    item.groupName
      ? ` in ${item.groupName}`
      : "";

  switch (
    item.type
  ) {
    case "friend_request":
      return `${actor} sent you a friend request.`;

    case "friend_accepted":
      return `${actor} accepted your friend request.`;

    case "group_invite":
      return `${actor} invited you to ${
        item.groupName ||
        "a group"
      }.`;

    case "group_invite_accepted":
      return `${actor} accepted your invitation to ${
        item.groupName ||
        "your group"
      }.`;

    case "margin_reply":
      return `${actor} replied to your Margin.`;

    case "group_margin_reply":
      return `${actor} replied to your Margin${group}.`;

    case "forum_reply":
      return `${actor} replied to your group discussion${group}.`;

    case "group_join_request":
      return `${actor} requested to join ${
        item.groupName ||
        "your group"
      }.`;

    case "group_join_approved":
      return `Your request to join ${
        item.groupName ||
        "the group"
      } was approved.`;

    case "group_role_changed":
      return `Your role in ${
        item.groupName ||
        "a group"
      } was updated.`;

    default:
      return `${actor} sent you a notification.`;
  }
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

  const now =
    new Date();

  return date.toLocaleString(
    [],
    {
      month:
        "short",

      day:
        "numeric",

      year:
        date.getFullYear() !==
        now.getFullYear()
          ? "numeric"
          : undefined,

      hour:
        "numeric",

      minute:
        "2-digit"
    }
  );
}


export default function Notifications() {
  const navigate =
    useNavigate();

  const [
    items,
    setItems
  ] =
    useState([]);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    error,
    setError
  ] =
    useState("");


  async function loadNotifications() {
    try {
      setError("");

      const loaded =
        await getNotifications();

      setItems(
        loaded
      );
    } catch (
      loadError
    ) {
      console.error(
        "Could not load notifications:",
        loadError
      );

      setError(
        "Couldn't load notifications."
      );
    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(() => {
    loadNotifications();
  }, []);


  async function openNotification(
    item
  ) {
    try {
      if (
        !item.read
      ) {
        await markNotificationRead(
          item.id
        );

        setItems(
          (
            current
          ) =>
            current.map(
              (
                notification
              ) =>
                notification.id ===
                item.id
                  ? {
                      ...notification,
                      read:
                        true
                    }
                  : notification
            )
        );
      }
    } catch (
      markError
    ) {
      console.error(
        "Could not mark notification as read:",
        markError
      );
    }

    if (
      item.targetPath
    ) {
      navigate(
        item.targetPath
      );
    }
  }


  async function handleMarkAllRead() {
    try {
      setError("");

      await markAllNotificationsRead();

      setItems(
        (
          current
        ) =>
          current.map(
            (
              notification
            ) => ({
              ...notification,
              read:
                true
            })
          )
      );
    } catch (
      markError
    ) {
      console.error(
        "Could not mark notifications as read:",
        markError
      );

      setError(
        "Couldn't mark notifications as read."
      );
    }
  }


  const unreadCount =
    items.filter(
      (
        item
      ) =>
        !item.read
    ).length;


  return (
    <section className="notifications-page">
      <div className="notifications-shell">

        <div className="notifications-heading">
          <div>
            <p className="eyebrow">
              Social Activity
            </p>

            <h1>
              Notifications
            </h1>
          </div>


          {unreadCount >
            0 && (
            <button
              type="button"
              className="notification-mark-all"
              onClick={
                handleMarkAllRead
              }
            >
              <CheckCheck
                size={18}
              />

              Mark all as read
            </button>
          )}
        </div>


        {error && (
          <p className="status">
            {error}
          </p>
        )}


        {loading ? (
          <p className="notifications-empty">
            Loading notifications...
          </p>
        ) : items.length ===
          0 ? (
          <div className="notifications-empty notification-empty-card">
            <Bell
              size={30}
            />

            <h2>
              Nothing new yet
            </h2>

            <p>
              Friend requests,
              group invitations,
              Margin replies,
              and forum activity
              will appear here.
            </p>
          </div>
        ) : (
          <div className="notification-list">
            {items.map(
              (
                item
              ) => {
                const actorAvatar =
                  getProfileAvatar(
                    item.actorAvatar
                  );

                return (
                  <button
                    type="button"
                    key={
                      item.id
                    }
                    className={
                      `notification-item${
                        item.read
                          ? ""
                          : " unread"
                      }`
                    }
                    onClick={() =>
                      openNotification(
                        item
                      )
                    }
                  >
                    <span className="notification-avatar">
                      {actorAvatar ? (
                        <img
                          src={
                            actorAvatar.image
                          }
                          alt=""
                        />
                      ) : (
                        <Bell
                          size={20}
                        />
                      )}
                    </span>


                    <span className="notification-copy">
                      <span className="notification-message">
                        {labelFor(
                          item
                        )}
                      </span>

                      <span className="notification-date">
                        {formatDate(
                          item.createdAtISO
                        )}
                      </span>
                    </span>


                    {!item.read && (
                      <span
                        className="notification-unread-dot"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                );
              }
            )}
          </div>
        )}

      </div>
    </section>
  );
}
