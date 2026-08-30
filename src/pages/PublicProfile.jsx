import {
  useEffect,
  useState
} from "react";

import {
  Link,
  useParams
} from "react-router-dom";

import {
  BookOpen,
  Clock3,
  Flag,
  User,
  UserCheck,
  UserMinus,
  UserPlus
} from "lucide-react";

import {
  cancelFriendRequest,
  getFriendshipStatus,
  getPublicJournalForUser,
  getPublicProfile,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest
} from "../services/storage.js";

import {
  getProfileAvatar
} from "../data/avatars.js";

import SEO from "../components/SEO.jsx";
import { auth } from "../firebase";

import {
  reportPlatformContent
} from "../services/platformModeration.js";


function formatDate(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}


export default function PublicProfile() {
  const {
    userId
  } = useParams();

  const [
    profile,
    setProfile
  ] = useState(null);

  const [
    entries,
    setEntries
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    status,
    setStatus
  ] = useState("");

  const [
    friendship,
    setFriendship
  ] = useState({
    status: "none"
  });

  const [
    friendshipBusy,
    setFriendshipBusy
  ] = useState(false);


  const [
    reportBusy,
    setReportBusy
  ] = useState(false);


  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setStatus("");

        const loadedProfile =
          await getPublicProfile(
            userId
          );

        if (!active) {
          return;
        }

        setProfile(
          loadedProfile
        );

        if (
          loadedProfile &&
          auth.currentUser &&
          auth.currentUser.uid !==
            String(
              userId
            )
        ) {
          try {
            const relationship =
              await getFriendshipStatus(
                userId
              );

            if (active) {
              setFriendship(
                relationship
              );
            }
          } catch (friendError) {
            console.error(
              "Could not load friendship status:",
              friendError
            );
          }
        }

        if (!loadedProfile) {
          setStatus(
            "This reader profile is not available."
          );

          return;
        }

        try {
          const publicEntries =
            await getPublicJournalForUser(
              userId
            );

          if (active) {
            setEntries(
              publicEntries
            );
          }
        } catch (journalError) {
          console.error(
            "Could not load public journal:",
            journalError
          );

          if (active) {
            setEntries([]);

            setStatus(
              "Reader profile loaded, but public journal entries could not be loaded."
            );
          }
        }
      } catch (error) {
        console.error(
          "Could not load public profile:",
          error
        );

        if (active) {
          setStatus(
            "We couldn't load this reader profile."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [
    userId
  ]);



  async function refreshFriendship() {
    const relationship =
      await getFriendshipStatus(
        userId
      );

    setFriendship(
      relationship
    );
  }


  async function handleFriendAction(
    action
  ) {
    try {
      setFriendshipBusy(
        true
      );

      setStatus("");

      if (
        action === "send"
      ) {
        await sendFriendRequest(
          userId
        );

        setStatus(
          "Friend request sent."
        );
      } else if (
        action === "cancel"
      ) {
        await cancelFriendRequest(
          userId
        );

        setStatus(
          "Friend request canceled."
        );
      } else if (
        action === "accept"
      ) {
        await respondToFriendRequest(
          userId,
          true
        );

        setStatus(
          "Friend request accepted."
        );
      } else if (
        action === "decline"
      ) {
        await respondToFriendRequest(
          userId,
          false
        );

        setStatus(
          "Friend request declined."
        );
      } else if (
        action === "remove"
      ) {
        await removeFriend(
          userId
        );

        setStatus(
          "Friend removed."
        );
      }

      await refreshFriendship();
    } catch (error) {
      console.error(
        "Friend action failed:",
        error
      );

      setStatus(
        "We couldn't update this friendship."
      );
    } finally {
      setFriendshipBusy(
        false
      );
    }
  }


  async function handleReportProfile() {
    if (
      !auth.currentUser ||
      auth.currentUser.uid ===
        String(
          userId
        )
    ) {
      return;
    }

    const reason =
      window.prompt(
        "Why are you reporting this reader? Examples: harassment, spam, impersonation, inappropriate content."
      );

    if (
      !reason ||
      !reason.trim()
    ) {
      return;
    }

    const details =
      window.prompt(
        "Add any additional details (optional)."
      ) || "";

    try {
      setReportBusy(true);
      setStatus("");

      await reportPlatformContent({
        targetType:
          "profile",
        targetId:
          String(
            userId
          ),
        targetUserId:
          String(
            userId
          ),
        reason:
          reason.trim(),
        details:
          details.trim(),
        title:
          profile?.displayName ||
          "Reader profile"
      });

      setStatus(
        "Report submitted for platform review."
      );
    } catch (error) {
      console.error(
        "Could not report reader:",
        error
      );

      setStatus(
        error?.message ||
        "We couldn't submit this report."
      );
    } finally {
      setReportBusy(false);
    }
  }


  const avatar =
    getProfileAvatar(
      profile?.avatar
    );


  if (loading) {
    return (
      <main className="page-wrap">
        <section className="hero-card small">
          <p className="eyebrow">
            Reader
          </p>

          <h1>
            Loading reader...
          </h1>
        </section>
      </main>
    );
  }


  return (
    <main className="page-wrap">
      <SEO
        title={
          profile
            ? `${profile.displayName} | Random Reads`
            : "Reader | Random Reads"
        }
        description="A Random Reads public reader profile."
        path={`/read/public/${userId}`}
        noindex
      />

      <div className="stack-lg">

        <section className="profile-header-card">
          <div className="profile-avatar">
            {avatar ? (
              <img
                src={
                  avatar.image
                }
                alt={`${profile?.displayName || "Reader"} avatar`}
              />
            ) : (
              <User
                size={42}
              />
            )}
          </div>

          <div className="profile-header-content">
            <p className="eyebrow">
              Reader Profile
            </p>

            <h1 className="profile-title">
              {profile?.displayName ||
                "Reader"}
            </h1>

            {profile?.username && (
              <p
                className="muted"
                style={{
                  marginTop: "0.2rem",
                  marginBottom: "0.6rem"
                }}
              >
                @{profile.username}
              </p>
            )}

            {profile?.about && (
              <p className="muted">
                {profile.about}
              </p>
            )}

            {auth.currentUser &&
              auth.currentUser.uid !==
                String(
                  userId
                ) && (
              <div
                className="button-row"
                style={{
                  marginTop: "1rem"
                }}
              >
                {friendship.status ===
                  "none" && (
                  <button
                    type="button"
                    className="button primary"
                    disabled={
                      friendshipBusy
                    }
                    onClick={() =>
                      handleFriendAction(
                        "send"
                      )
                    }
                  >
                    <UserPlus
                      size={16}
                    />
                    Add Friend
                  </button>
                )}

                {friendship.status ===
                  "outgoing" && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      friendshipBusy
                    }
                    onClick={() =>
                      handleFriendAction(
                        "cancel"
                      )
                    }
                  >
                    <Clock3
                      size={16}
                    />
                    Request Sent
                  </button>
                )}

                {friendship.status ===
                  "incoming" && (
                  <>
                    <button
                      type="button"
                      className="button primary"
                      disabled={
                        friendshipBusy
                      }
                      onClick={() =>
                        handleFriendAction(
                          "accept"
                        )
                      }
                    >
                      <UserCheck
                        size={16}
                      />
                      Accept
                    </button>

                    <button
                      type="button"
                      className="button secondary"
                      disabled={
                        friendshipBusy
                      }
                      onClick={() =>
                        handleFriendAction(
                          "decline"
                        )
                      }
                    >
                      Decline
                    </button>
                  </>
                )}

                {friendship.status ===
                  "friends" && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      friendshipBusy
                    }
                    onClick={() =>
                      handleFriendAction(
                        "remove"
                      )
                    }
                  >
                    <UserMinus
                      size={16}
                    />
                    Friends
                  </button>
                )}

                <button
                  type="button"
                  className="button secondary"
                  disabled={
                    reportBusy
                  }
                  onClick={
                    handleReportProfile
                  }
                >
                  <Flag
                    size={16}
                  />
                  {reportBusy
                    ? "Reporting..."
                    : "Report Reader"}
                </button>
              </div>
            )}
          </div>
        </section>


        {status && (
          <p className="status">
            {status}
          </p>
        )}


        {profile && (
          <section className="panel public-profile-journal">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Public Journal
                </p>

                <h2>
                  From the Chain
                </h2>
              </div>
            </div>


            {entries.length ===
            0 ? (
              <p className="muted">
                This reader has no public
                journal entries yet.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {entries.map(
                  (entry) => (
                    <article
                      key={
                        entry.id
                      }
                      className="public-profile-entry"
                    >
                      <div className="public-entry-heading">
                        <div>
                          <p className="eyebrow">
                            Reading
                          </p>

                          <Link
                            to={`/read/reader/${entry.bookId}`}
                            className="public-entry-book-title"
                          >
                            {entry.title ||
                              "Untitled"}
                          </Link>

                          {entry.author && (
                            <p className="public-entry-author">
                              {
                                entry.author
                              }
                            </p>
                          )}
                        </div>

                        <Link
                          to={`/read/reader/${entry.bookId}`}
                          className="public-entry-book-icon"
                          aria-label={`Open ${entry.title || "book"}`}
                        >
                          <BookOpen
                            size={20}
                          />
                        </Link>
                      </div>


                      <div className="public-entry-meta">
                        {entry.paragraphNumber && (
                          <span>
                            Paragraph{" "}
                            {
                              entry.paragraphNumber
                            }
                          </span>
                        )}

                        {entry.createdAt && (
                          <span>
                            {formatDate(
                              entry.createdAt
                            )}
                          </span>
                        )}

                        {entry.updatedAtISO && (
                          <span>
                            Edited
                          </span>
                        )}
                      </div>


                      {entry.paragraphPreview && (
                        <div className="public-entry-quote">
                          <p>
                            “
                            {
                              entry.paragraphPreview
                            }
                            ”
                          </p>
                        </div>
                      )}


                      <p className="public-journal-note">
                        {entry.note}
                      </p>


                      <div className="public-entry-actions">
                        <Link
                          to={`/read/reader/${entry.bookId}`}
                          className="public-entry-read-link"
                        >
                          <BookOpen
                            size={16}
                          />

                          Read book
                        </Link>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
