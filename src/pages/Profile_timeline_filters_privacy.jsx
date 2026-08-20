import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  onAuthStateChanged
} from "firebase/auth";

import {
  Link,
  useSearchParams
} from "react-router-dom";

import {
  Bookmark,
  Book,
  BookOpen,
  Globe2,
  Lock,
  MessageCircle,
  NotebookPen,
  Pencil,
  User,
  X
} from "lucide-react";

import { auth } from "../firebase";

import {
  getJournal,
  getReadingTimeline,
  getReadingTimelineVisibility,
  getSavedBooks,
  getSavedMargins,
  getUserProfile,
  saveUserProfile,
  setReadingProgressVisibility,
  setReadingTimelineVisibility
} from "../services/storage.js";

import {
  PROFILE_AVATARS,
  getProfileAvatar
} from "../data/avatars.js";

import ReadersHere from "../components/ReadersHere.jsx";
import SEO from "../components/SEO.jsx";


const PROFILE_TABS = [
  {
    id: "timeline",
    label: "Reading Timeline"
  },
  {
    id: "journal",
    label: "Journal"
  },
  {
    id: "margins",
    label: "Saved Margins"
  }
];


function formatDate(value) {
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


function ProgressBar({
  percent = 0
}) {
  const safePercent =
    Math.min(
      Math.max(
        Number(percent) || 0,
        0
      ),
      100
    );

  return (
    <div
      className="reading-progress-track"
      aria-label={`${safePercent}% complete`}
    >
      <div
        className="reading-progress-fill"
        style={{
          width:
            `${safePercent}%`
        }}
      />
    </div>
  );
}


export default function Profile() {
  const [
    searchParams,
    setSearchParams
  ] = useSearchParams();

  const requestedTab =
    searchParams.get("tab");

  const activeTab =
    PROFILE_TABS.some(
      (tab) =>
        tab.id === requestedTab
    )
      ? requestedTab
      : "timeline";

  const editingFromUrl =
    searchParams.get("edit") === "1";

  const [
    editingProfile,
    setEditingProfile
  ] = useState(
    editingFromUrl
  );

  const [
    user,
    setUser
  ] = useState(null);

  const [
    profile,
    setProfile
  ] = useState(null);

  const [
    readingTimeline,
    setReadingTimeline
  ] = useState([]);

  const [
    journalEntries,
    setJournalEntries
  ] = useState([]);

  const [
    savedBooks,
    setSavedBooks
  ] = useState([]);

  const [
    savedMargins,
    setSavedMargins
  ] = useState([]);

  const [
    displayName,
    setDisplayName
  ] = useState("");

  const [
    about,
    setAbout
  ] = useState("");

  const [
    selectedAvatar,
    setSelectedAvatar
  ] = useState("");

  const [
    showReadingPresence,
    setShowReadingPresence
  ] = useState(false);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    status,
    setStatus
  ] = useState("");


  const [
    statHelp,
    setStatHelp
  ] = useState(null);

  const [
    timelineFilter,
    setTimelineFilter
  ] = useState(
    searchParams.get("filter") ||
    "all"
  );

  const [
    timelinePublic,
    setTimelinePublic
  ] = useState(false);

  const [
    privacySaving,
    setPrivacySaving
  ] = useState(false);

  const [
    bookPrivacySaving,
    setBookPrivacySaving
  ] = useState(null);


  useEffect(() => {
    setEditingProfile(
      searchParams.get("edit") === "1"
    );
  }, [searchParams]);


  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          setUser(
            firebaseUser
          );

          if (
            !firebaseUser
          ) {
            setProfile(null);
            setReadingTimeline([]);
            setJournalEntries([]);
            setSavedBooks([]);
            setSavedMargins([]);
            setShowReadingPresence(false);
            setLoading(false);

            return;
          }

          try {
            setLoading(true);
            setStatus("");

            const [
              loadedProfile,
              timeline,
              journal,
              books,
              margins,
              timelineVisibility
            ] =
              await Promise.all([
                getUserProfile(),
                getReadingTimeline(),
                getJournal(),
                getSavedBooks(),
                getSavedMargins(),
                getReadingTimelineVisibility()
              ]);

            setProfile(
              loadedProfile
            );

            setDisplayName(
              loadedProfile
                ?.displayName ||
              ""
            );

            setAbout(
              loadedProfile
                ?.about ||
              ""
            );

            setSelectedAvatar(
              loadedProfile
                ?.avatar ||
              ""
            );

            setShowReadingPresence(
              loadedProfile
                ?.showReadingPresence ===
              true
            );

            setReadingTimeline(
              timeline
            );

            setJournalEntries(
              journal
            );

            setSavedBooks(
              books
            );

            setSavedMargins(
              margins
            );

            setTimelinePublic(
              timelineVisibility ===
              "public"
            );
          } catch (error) {
            console.error(
              "Could not load profile:",
              error
            );

            setStatus(
              "We couldn't load your profile."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return unsubscribe;
  }, []);


  const journalCountsByBook =
    useMemo(() => {
      const counts =
        new Map();

      for (
        const entry
        of journalEntries
      ) {
        if (
          entry.bookId ===
            undefined ||
          entry.bookId ===
            null
        ) {
          continue;
        }

        const key =
          String(
            entry.bookId
          );

        counts.set(
          key,
          (
            counts.get(
              key
            ) ||
            0
          ) + 1
        );
      }

      return counts;
    }, [
      journalEntries
    ]);


  const activeAvatar =
    getProfileAvatar(
      profile?.avatar
    );


  const completedBooks =
    readingTimeline.filter(
      (item) =>
        Number(
          item.percentComplete
        ) >= 100
    ).length;


  const savedBookIds =
    useMemo(
      () =>
        new Set(
          savedBooks.map(
            (book) =>
              String(
                book.id ||
                book.bookId ||
                ""
              )
          )
        ),
      [
        savedBooks
      ]
    );


  const timelineByBookId =
    useMemo(
      () =>
        new Map(
          readingTimeline.map(
            (item) => [
              String(
                item.bookId ||
                item.id ||
                ""
              ),
              item
            ]
          )
        ),
      [
        readingTimeline
      ]
    );


  const savedTimelineItems =
    useMemo(
      () =>
        savedBooks.map(
          (book) => {
            const bookId =
              String(
                book.id ||
                book.bookId ||
                ""
              );

            const timelineItem =
              timelineByBookId.get(
                bookId
              );

            if (
              timelineItem
            ) {
              return {
                ...book,
                ...timelineItem,
                bookId,
                isSaved:
                  true
              };
            }

            return {
              ...book,
              bookId,
              percentComplete:
                0,
              savedOnly:
                true,
              isSaved:
                true
            };
          }
        ),
      [
        savedBooks,
        timelineByBookId
      ]
    );


  const filteredTimeline =
    useMemo(
      () => {
        switch (
          timelineFilter
        ) {
          case "reading":
            return readingTimeline.filter(
              (item) =>
                Number(
                  item.percentComplete
                ) < 100
            );

          case "completed":
            return readingTimeline.filter(
              (item) =>
                Number(
                  item.percentComplete
                ) >= 100
            );

          case "saved":
            return savedTimelineItems;

          default:
            return readingTimeline;
        }
      },
      [
        timelineFilter,
        readingTimeline,
        savedTimelineItems
      ]
    );


  function changeTab(
    tabId,
    filterId = null
  ) {
    setEditingProfile(false);
    setStatus("");
    setStatHelp(null);

    if (
      tabId === "timeline"
    ) {
      const nextFilter =
        filterId ||
        timelineFilter ||
        "all";

      setTimelineFilter(
        nextFilter
      );

      setSearchParams({
        tab: "timeline",
        filter:
          nextFilter
      });

      return;
    }

    setSearchParams({
      tab:
        tabId
    });
  }


  function changeTimelineFilter(
    filterId
  ) {
    setTimelineFilter(
      filterId
    );

    setSearchParams({
      tab: "timeline",
      filter:
        filterId
    });
  }


  async function handleTimelineVisibility() {
    const nextVisibility =
      timelinePublic
        ? "private"
        : "public";

    try {
      setPrivacySaving(true);
      setStatus("");

      await setReadingTimelineVisibility(
        nextVisibility
      );

      setTimelinePublic(
        nextVisibility ===
        "public"
      );

      setStatus(
        nextVisibility ===
          "public"
          ? "Reading timeline is public."
          : "Reading timeline is private."
      );
    } catch (error) {
      console.error(
        "Could not update timeline visibility:",
        error
      );

      setStatus(
        "We couldn't update timeline visibility."
      );
    } finally {
      setPrivacySaving(false);
    }
  }


  async function handleBookVisibility(
    item
  ) {
    const bookId =
      String(
        item.bookId ||
        item.id ||
        ""
      );

    if (
      !bookId ||
      item.savedOnly
    ) {
      return;
    }

    const currentVisibility =
      item.visibility ===
      "public"
        ? "public"
        : "private";

    const nextVisibility =
      currentVisibility ===
      "public"
        ? "private"
        : "public";

    try {
      setBookPrivacySaving(
        bookId
      );

      setStatus("");

      await setReadingProgressVisibility(
        bookId,
        nextVisibility
      );

      setReadingTimeline(
        (current) =>
          current.map(
            (record) =>
              String(
                record.bookId ||
                record.id ||
                ""
              ) ===
              bookId
                ? {
                    ...record,
                    visibility:
                      nextVisibility
                  }
                : record
          )
      );
    } catch (error) {
      console.error(
        "Could not update book visibility:",
        error
      );

      setStatus(
        "We couldn't update that book's visibility."
      );
    } finally {
      setBookPrivacySaving(
        null
      );
    }
  }

  function openEditProfile() {
    setEditingProfile(
      true
    );

    setSearchParams({
      tab: "timeline",
      edit: "1"
    });
  }


  function closeEditProfile() {
    setEditingProfile(
      false
    );

    setSearchParams({
      tab: "timeline"
    });

    setStatus("");

    setDisplayName(
      profile
        ?.displayName ||
      ""
    );

    setAbout(
      profile
        ?.about ||
      ""
    );

    setSelectedAvatar(
      profile
        ?.avatar ||
      ""
    );

    setShowReadingPresence(
      profile
        ?.showReadingPresence ===
      true
    );
  }


  async function handleSaveProfile(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setStatus("");

      const saved =
        await saveUserProfile({
          displayName,
          about,
          avatar:
            selectedAvatar,
          showReadingPresence
        });

      setProfile(
        saved
      );

      setStatus(
        "Profile saved."
      );

      setEditingProfile(
        false
      );

      setSearchParams({
        tab: "timeline"
      });
    } catch (error) {
      console.error(
        "Could not save profile:",
        error
      );

      setStatus(
        "We couldn't save your profile."
      );
    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <main className="page-wrap">
        <SEO
          title="Profile | Random Reads"
          description="Your Random Reads profile."
          path="/read/profile"
          noindex
        />

        <section className="hero-card small">
          <p className="eyebrow">
            Reader Profile
          </p>

          <h1>
            Loading profile...
          </h1>
        </section>
      </main>
    );
  }


  if (!user) {
    return (
      <main className="page-wrap">
        <SEO
          title="Profile | Random Reads"
          description="Your Random Reads profile."
          path="/read/profile"
          noindex
        />

        <section className="hero-card small">
          <p className="eyebrow">
            Reader Profile
          </p>

          <h1>
            Log in to view your profile.
          </h1>

          <p>
            Your reading timeline,
            profile, journal, saved books,
            and saved Margins are connected
            to your Random Reads account.
          </p>

          <Link
            to="/read/login"
            className="button primary large"
          >
            Log In
          </Link>
        </section>
      </main>
    );
  }


  return (
    <main className="page-wrap">
      <SEO
        title="Profile | Random Reads"
        description="Your Random Reads reading profile."
        path="/read/profile"
        noindex
      />

      <div className="stack-lg">

        <section
          className="profile-header-card"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(92px, 0.65fr) minmax(0, 1.55fr)",
            gap: "1.25rem",
            alignItems: "start"
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.6rem",
              minWidth: 0
            }}
          >
            <div className="profile-avatar">
              {activeAvatar ? (
                <img
                  src={
                    activeAvatar.image
                  }
                  alt={`${profile?.displayName || "Reader"} avatar`}
                />
              ) : profile?.photoURL ? (
                <img
                  src={
                    profile.photoURL
                  }
                  alt=""
                />
              ) : (
                <User
                  size={42}
                />
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.45rem",
                flexWrap: "wrap",
                justifyContent: "center"
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setStatHelp(
                    statHelp ===
                    "timeline"
                      ? null
                      : "timeline"
                  )
                }
                aria-label={`${readingTimeline.length} books in reading timeline`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.38rem",
                  minWidth: "58px",
                  justifyContent: "center",
                  padding: "0.48rem 0.6rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                <BookOpen
                  size={17}
                />
                <strong>
                  {readingTimeline.length}
                </strong>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatHelp(
                    statHelp ===
                    "completed"
                      ? null
                      : "completed"
                  )
                }
                aria-label={`${completedBooks} books completed`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.38rem",
                  minWidth: "58px",
                  justifyContent: "center",
                  padding: "0.48rem 0.6rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                <Book
                  size={17}
                />
                <strong>
                  {completedBooks}
                </strong>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatHelp(
                    statHelp ===
                    "journal"
                      ? null
                      : "journal"
                  )
                }
                aria-label={`${journalEntries.length} journal entries`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.38rem",
                  minWidth: "58px",
                  justifyContent: "center",
                  padding: "0.48rem 0.6rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                <NotebookPen
                  size={17}
                />
                <strong>
                  {journalEntries.length}
                </strong>
              </button>
            </div>

            {statHelp ===
              "timeline" && (
              <button
                type="button"
                className="button secondary"
                style={{
                  width: "100%",
                  whiteSpace: "normal",
                  textAlign: "center"
                }}
                onClick={() =>
                  changeTab(
                    "timeline",
                    "all"
                  )
                }
              >
                {readingTimeline.length} books
                in your reading timeline
              </button>
            )}

            {statHelp ===
              "completed" && (
              <button
                type="button"
                className="button secondary"
                style={{
                  width: "100%",
                  whiteSpace: "normal",
                  textAlign: "center"
                }}
                onClick={() =>
                  changeTab(
                    "timeline",
                    "completed"
                  )
                }
              >
                {completedBooks} completed
                books
              </button>
            )}

            {statHelp ===
              "journal" && (
              <button
                type="button"
                className="button secondary"
                style={{
                  width: "100%",
                  whiteSpace: "normal",
                  textAlign: "center"
                }}
                onClick={() =>
                  changeTab(
                    "journal"
                  )
                }
              >
                {journalEntries.length}
                journal entries
              </button>
            )}
          </div>

          <div
            className="profile-header-content"
            style={{
              minWidth: 0,
              paddingTop: "0.1rem"
            }}
          >
            <p className="eyebrow">
              Reader Profile
            </p>

            <h1 className="profile-title">
              {profile?.displayName ||
                "Reader"}
            </h1>

            <button
              type="button"
              className="button secondary profile-edit-button"
              onClick={
                openEditProfile
              }
              style={{
                marginTop: "0.45rem"
              }}
            >
              <Pencil
                size={16}
              />
              Edit Profile
            </button>

            {profile?.about && (
              <p
                className="muted"
                style={{
                  marginTop: "1rem"
                }}
              >
                {profile.about}
              </p>
            )}
          </div>
        </section>

        <nav
          aria-label="Profile sections"
          style={{
            display: "flex",
            gap: "0.45rem",
            overflowX: "auto",
            padding: "0.4rem",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: "999px",
            WebkitOverflowScrolling:
              "touch"
          }}
        >
          {PROFILE_TABS.map(
            (tab) => {
              const selected =
                activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    selected
                      ? "margins-filter active"
                      : "margins-filter"
                  }
                  style={{
                    flex: "0 0 auto",
                    whiteSpace: "nowrap"
                  }}
                  onClick={() =>
                    changeTab(
                      tab.id
                    )
                  }
                  aria-current={
                    selected
                      ? "page"
                      : undefined
                  }
                >
                  {tab.label}
                </button>
              );
            }
          )}
        </nav>


        {status && (
          <p className="status">
            {status}
          </p>
        )}


        {editingProfile && (
              <section className="panel profile-panel">
                <div className="section-heading-row">
                  <div>
                    <p className="eyebrow">
                      Account
                    </p>

                    <h2>
                      Edit Profile
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="button secondary"
                    onClick={
                      closeEditProfile
                    }
                  >
                    <X
                      size={16}
                    />

                    Cancel
                  </button>
                </div>


                <form
                  className="profile-form"
                  onSubmit={
                    handleSaveProfile
                  }
                >
                  <label>
                    Display name

                    <input
                      type="text"
                      value={
                        displayName
                      }
                      onChange={(
                        event
                      ) =>
                        setDisplayName(
                          event.target.value
                        )
                      }
                      maxLength={80}
                    />
                  </label>


                  <div className="profile-avatar-picker">
                    <div>
                      <p className="profile-field-label">
                        Choose your avatar
                      </p>

                      <p className="muted">
                        Select a classic author
                        or literary character.
                      </p>
                    </div>

                    <div className="profile-avatar-grid">
                      {PROFILE_AVATARS.map(
                        (
                          avatar
                        ) => {
                          const selected =
                            selectedAvatar ===
                            avatar.id;

                          return (
                            <button
                              key={
                                avatar.id
                              }
                              type="button"
                              className={
                                selected
                                  ? "profile-avatar-option selected"
                                  : "profile-avatar-option"
                              }
                              onClick={() =>
                                setSelectedAvatar(
                                  avatar.id
                                )
                              }
                              aria-pressed={
                                selected
                              }
                              aria-label={`Choose ${avatar.name}`}
                            >
                              <img
                                src={
                                  avatar.image
                                }
                                alt=""
                              />

                              <span>
                                {avatar.name}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>


                  <label>
                    About me

                    <textarea
                      value={
                        about
                      }
                      onChange={(
                        event
                      ) =>
                        setAbout(
                          event.target.value
                        )
                      }
                      maxLength={500}
                      rows={6}
                      placeholder="Tell other readers a little about yourself..."
                    />
                  </label>


                  <small className="muted">
                    {about.length}/500
                  </small>


                  <div className="profile-presence-setting">
                    <label className="profile-presence-toggle">
                      <input
                        type="checkbox"
                        checked={
                          showReadingPresence
                        }
                        onChange={(
                          event
                        ) =>
                          setShowReadingPresence(
                            event.target.checked
                          )
                        }
                      />

                      <span>
                        Show when I'm reading
                      </span>
                    </label>

                    <p className="muted">
                      When enabled, other signed-in
                      readers may see your avatar on
                      books you're actively reading.
                    </p>
                  </div>


                  <div className="button-row">
                    <button
                      type="submit"
                      className="button primary"
                      disabled={
                        saving
                      }
                    >
                      {saving
                        ? "Saving..."
                        : "Save Profile"}
                    </button>
                  </div>
                </form>
              </section>
        )}

        {activeTab === "timeline" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Reading History
                </p>

                <h2>
                  Reading Timeline
                </h2>
              </div>

              <button
                type="button"
                className={
                  timelinePublic
                    ? "button primary"
                    : "button secondary"
                }
                onClick={
                  handleTimelineVisibility
                }
                disabled={
                  privacySaving
                }
                title={
                  timelinePublic
                    ? "Your timeline can be shared. Individual private books stay hidden."
                    : "Your entire timeline is private."
                }
              >
                {timelinePublic ? (
                  <Globe2
                    size={16}
                  />
                ) : (
                  <Lock
                    size={16}
                  />
                )}

                {privacySaving
                  ? "Saving..."
                  : timelinePublic
                    ? "Timeline Public"
                    : "Timeline Private"}
              </button>
            </div>

            <p className="muted">
              The timeline setting controls
              the entire reading history.
              Individual books can still be
              kept private.
            </p>

            <div
              style={{
                display: "flex",
                gap: "0.45rem",
                overflowX: "auto",
                paddingBottom: "0.35rem",
                margin: "1rem 0"
              }}
            >
              {[
                [
                  "all",
                  "All",
                  readingTimeline.length
                ],
                [
                  "reading",
                  "Reading",
                  readingTimeline.filter(
                    (item) =>
                      Number(
                        item.percentComplete
                      ) < 100
                  ).length
                ],
                [
                  "completed",
                  "Completed",
                  completedBooks
                ],
                [
                  "saved",
                  "Saved",
                  savedBooks.length
                ]
              ].map(
                ([
                  filterId,
                  label,
                  count
                ]) => (
                  <button
                    key={
                      filterId
                    }
                    type="button"
                    className={
                      timelineFilter ===
                      filterId
                        ? "margins-filter active"
                        : "margins-filter"
                    }
                    style={{
                      flex:
                        "0 0 auto",
                      whiteSpace:
                        "nowrap"
                    }}
                    onClick={() =>
                      changeTimelineFilter(
                        filterId
                      )
                    }
                  >
                    {label} ({count})
                  </button>
                )
              )}
            </div>

            {filteredTimeline.length ===
            0 ? (
              <p className="muted">
                {timelineFilter ===
                "saved"
                  ? "Books you save will appear here."
                  : timelineFilter ===
                    "completed"
                    ? "Completed books will appear here."
                    : "Your reading activity will appear here."}
              </p>
            ) : (
              <div className="reading-timeline">
                {filteredTimeline.map(
                  (
                    item,
                    index
                  ) => {
                    const percent =
                      Math.min(
                        Math.max(
                          Number(
                            item.percentComplete
                          ) || 0,
                          0
                        ),
                        100
                      );

                    const bookId =
                      String(
                        item.bookId ||
                        item.id ||
                        ""
                      );

                    const noteCount =
                      journalCountsByBook.get(
                        bookId
                      ) || 0;

                    const isSaved =
                      item.isSaved ===
                        true ||
                      savedBookIds.has(
                        bookId
                      );

                    const visibility =
                      item.visibility ===
                      "public"
                        ? "public"
                        : "private";

                    return (
                      <article
                        key={`reading-${bookId || index}`}
                        className="timeline-book"
                      >
                        <Link
                          to={`/read/reader/${bookId}`}
                          className="timeline-cover"
                        >
                          {item.image ||
                          item.cover ? (
                            <img
                              src={
                                item.image ||
                                item.cover
                              }
                              alt={`Cover of ${
                                item.title ||
                                "book"
                              }`}
                            />
                          ) : (
                            <div className="timeline-cover-placeholder">
                              <BookOpen
                                size={24}
                              />
                            </div>
                          )}
                        </Link>

                        <div className="timeline-book-content">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.75rem",
                              flexWrap: "wrap"
                            }}
                          >
                            <p className="timeline-event-label">
                              {item.savedOnly
                                ? "Saved Book"
                                : percent >=
                                  100
                                  ? "Finished Reading"
                                  : "Reading"}
                            </p>

                            {!item.savedOnly && (
                              <button
                                type="button"
                                className={
                                  visibility ===
                                  "public"
                                    ? "button primary"
                                    : "button secondary"
                                }
                                style={{
                                  padding:
                                    "0.35rem 0.55rem"
                                }}
                                onClick={() =>
                                  handleBookVisibility(
                                    item
                                  )
                                }
                                disabled={
                                  bookPrivacySaving ===
                                  bookId
                                }
                                title={
                                  visibility ===
                                  "public"
                                    ? "This book may appear on your public timeline when the timeline is public."
                                    : "This book is private."
                                }
                              >
                                {visibility ===
                                "public" ? (
                                  <Globe2
                                    size={14}
                                  />
                                ) : (
                                  <Lock
                                    size={14}
                                  />
                                )}

                                {bookPrivacySaving ===
                                bookId
                                  ? "Saving..."
                                  : visibility ===
                                    "public"
                                    ? "Public"
                                    : "Private"}
                              </button>
                            )}
                          </div>

                          <Link
                            to={`/read/reader/${bookId}`}
                            className="timeline-book-title"
                          >
                            {item.title ||
                              "Untitled"}
                          </Link>

                          <p className="timeline-author">
                            {item.author ||
                              "Unknown author"}
                          </p>

                          {isSaved && (
                            <small className="muted">
                              Saved to your library
                            </small>
                          )}

                          {!item.savedOnly && (
                            <>
                              <ReadersHere
                                bookId={
                                  bookId
                                }
                              />

                              <div className="timeline-progress-row">
                                <ProgressBar
                                  percent={
                                    percent
                                  }
                                />

                                <strong>
                                  {percent}%
                                </strong>
                              </div>

                              <small className="muted">
                                {percent >=
                                100
                                  ? "Completed"
                                  : "Last read"}

                                {item.updatedAtISO
                                  ? ` · ${formatDate(
                                      item.updatedAtISO
                                    )}`
                                  : ""}
                              </small>
                            </>
                          )}

                          {noteCount > 0 && (
                            <div className="timeline-journal-link-row">
                              <button
                                type="button"
                                className="timeline-journal-link"
                                onClick={() =>
                                  changeTab(
                                    "journal"
                                  )
                                }
                              >
                                <NotebookPen
                                  size={16}
                                />

                                Journal entries{" "}
                                ({noteCount})
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === "journal" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Your Notes
                </p>

                <h2>
                  Journal
                </h2>
              </div>

              <Link
                to="/read/journal"
                className="button secondary"
              >
                <NotebookPen
                  size={16}
                />

                Open Full Journal
              </Link>
            </div>


            {journalEntries.length ===
            0 ? (
              <p className="muted">
                Your journal entries
                will appear here.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {journalEntries.map(
                  (
                    entry,
                    index
                  ) => {
                    const bookId =
                      String(
                        entry.bookId ||
                        ""
                      );

                    return (
                      <article
                        key={
                          entry.id ||
                          `journal-${index}`
                        }
                        className="public-profile-entry"
                      >
                        <div className="public-entry-heading">
                          <div>
                            <p className="eyebrow">
                              Journal Entry
                            </p>

                            {bookId ? (
                              <Link
                                to={`/read/reader/${bookId}`}
                                className="public-entry-book-title"
                              >
                                {entry.title ||
                                  "Untitled"}
                              </Link>
                            ) : (
                              <strong className="public-entry-book-title">
                                {entry.title ||
                                  "Untitled"}
                              </strong>
                            )}

                            {entry.author && (
                              <p className="public-entry-author">
                                {entry.author}
                              </p>
                            )}
                          </div>
                        </div>


                        <div className="public-entry-meta">
                          {entry.paragraphNumber && (
                            <span>
                              Paragraph{" "}
                              {entry.paragraphNumber}
                            </span>
                          )}

                          {(entry.updatedAtISO ||
                            entry.createdAt) && (
                            <span>
                              {formatDate(
                                entry.updatedAtISO ||
                                  entry.createdAt
                              )}
                            </span>
                          )}

                          <span>
                            {entry.visibility ||
                              "private"}
                          </span>
                        </div>


                        {entry.paragraphPreview && (
                          <div className="public-entry-quote">
                            <p>
                              “{entry.paragraphPreview}”
                            </p>
                          </div>
                        )}


                        <p className="public-journal-note">
                          {entry.note}
                        </p>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}




        {activeTab === "margins" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Bookmarked Discussions
                </p>

                <h2>
                  Saved Margins
                </h2>
              </div>

              <Link
                to="/read/margins"
                className="button secondary"
              >
                <MessageCircle
                  size={16}
                />

                The Margins
              </Link>
            </div>


            {savedMargins.length ===
            0 ? (
              <p className="muted">
                Margins you save will
                appear here.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {savedMargins.map(
                  (
                    entry,
                    index
                  ) => {
                    const bookId =
                      String(
                        entry.bookId ||
                        ""
                      );

                    return (
                      <article
                        key={
                          entry.id ||
                          `saved-margin-${index}`
                        }
                        className="public-profile-entry"
                      >
                        <div className="public-entry-heading">
                          <div>
                            <p className="eyebrow">
                              Saved Margin
                            </p>

                            {bookId ? (
                              <Link
                                to={`/read/reader/${bookId}`}
                                className="public-entry-book-title"
                              >
                                {entry.title ||
                                  "Untitled"}
                              </Link>
                            ) : (
                              <strong className="public-entry-book-title">
                                {entry.title ||
                                  "Untitled"}
                              </strong>
                            )}

                            {entry.author && (
                              <p className="public-entry-author">
                                {entry.author}
                              </p>
                            )}
                          </div>

                          <Bookmark
                            size={20}
                          />
                        </div>


                        <div className="public-entry-meta">
                          {entry.paragraphNumber && (
                            <span>
                              Paragraph{" "}
                              {entry.paragraphNumber}
                            </span>
                          )}

                          {entry.savedAtISO && (
                            <span>
                              Saved{" "}
                              {formatDate(
                                entry.savedAtISO
                              )}
                            </span>
                          )}
                        </div>


                        {entry.paragraphPreview && (
                          <div className="public-entry-quote">
                            <p>
                              “{entry.paragraphPreview}”
                            </p>
                          </div>
                        )}


                        <p className="public-journal-note">
                          {entry.note}
                        </p>


                        <div className="button-row">
                          {bookId && (
                            <Link
                              to={`/read/reader/${bookId}`}
                              className="button secondary"
                            >
                              <BookOpen
                                size={16}
                              />

                              Open Book
                            </Link>
                          )}

                          {entry.sourceEntryId && (
                            <Link
                              to={`/read/margins#margin-${entry.sourceEntryId}`}
                              className="button secondary"
                            >
                              <MessageCircle
                                size={16}
                              />

                              Open Margin
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
