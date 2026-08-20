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
  getSavedBooks,
  getSavedMargins,
  getUserProfile,
  saveUserProfile
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
    id: "books",
    label: "Saved Books"
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
              margins
            ] =
              await Promise.all([
                getUserProfile(),
                getReadingTimeline(),
                getJournal(),
                getSavedBooks(),
                getSavedMargins()
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


  function changeTab(
    tabId
  ) {
    setEditingProfile(false);
    setStatus("");

    setSearchParams({
      tab:
        tabId
    });
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

        <section className="profile-header-card">
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
            className="profile-header-content"
            style={{
              flex: "1 1 auto",
              minWidth: 0
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "1rem",
                flexWrap: "wrap"
              }}
            >
              <div>
                <p className="eyebrow">
                  Reader Profile
                </p>

                <h1 className="profile-title">
                  {profile?.displayName ||
                    "Reader"}
                </h1>
              </div>

              <button
                type="button"
                className="button secondary profile-edit-button"
                onClick={
                  openEditProfile
                }
              >
                <Pencil
                  size={16}
                />

                Edit Profile
              </button>
            </div>

            {profile?.about && (
              <p className="muted">
                {profile.about}
              </p>
            )}

            <div
              aria-label="Reading stats"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.55rem",
                marginTop: "0.85rem"
              }}
            >
              <div
                title="Books in reading timeline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.65rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff"
                }}
              >
                <BookOpen
                  size={16}
                />
                <strong>
                  {readingTimeline.length}
                </strong>
                <span className="muted">
                  Timeline
                </span>
              </div>

              <div
                title="Books completed"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.65rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff"
                }}
              >
                <Book
                  size={16}
                />
                <strong>
                  {completedBooks}
                </strong>
                <span className="muted">
                  Completed
                </span>
              </div>

              <div
                title="Journal entries"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.38rem 0.65rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff"
                }}
              >
                <NotebookPen
                  size={16}
                />
                <strong>
                  {journalEntries.length}
                </strong>
                <span className="muted">
                  Journal
                </span>
              </div>
            </div>
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
            </div>


            {readingTimeline.length ===
            0 ? (
              <p className="muted">
                Your reading activity
                will appear here.
              </p>
            ) : (
              <div className="reading-timeline">
                {readingTimeline.map(
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

                    return (
                      <article
                        key={`reading-${bookId || index}`}
                        className="timeline-book"
                      >
                        <Link
                          to={`/read/reader/${bookId}`}
                          className="timeline-cover"
                        >
                          {item.image ? (
                            <img
                              src={
                                item.image
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
                          <p className="timeline-event-label">
                            {percent >= 100
                              ? "Finished Reading"
                              : "Reading"}
                          </p>

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
                            {percent >= 100
                              ? "Completed"
                              : "Last read"}

                            {item.updatedAtISO
                              ? ` · ${formatDate(
                                  item.updatedAtISO
                                )}`
                              : ""}
                          </small>

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


        {activeTab === "books" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Your Library
                </p>

                <h2>
                  Saved Books
                </h2>
              </div>
            </div>


            {savedBooks.length ===
            0 ? (
              <p className="muted">
                Books you save will
                appear here.
              </p>
            ) : (
              <div className="results-list">
                {savedBooks.map(
                  (
                    book,
                    index
                  ) => {
                    const bookId =
                      String(
                        book.id ||
                        book.bookId ||
                        ""
                      );

                    return (
                      <article
                        key={
                          bookId ||
                          `saved-book-${index}`
                        }
                        className="book-card compact"
                      >
                        <Link
                          to={`/read/reader/${bookId}`}
                          className="cover-wrap"
                        >
                          {book.image ||
                          book.cover ? (
                            <img
                              src={
                                book.image ||
                                book.cover
                              }
                              alt={`Cover of ${
                                book.title ||
                                "book"
                              }`}
                            />
                          ) : (
                            <div className="cover-placeholder">
                              <BookOpen
                                size={24}
                              />
                            </div>
                          )}
                        </Link>

                        <div>
                          <p className="eyebrow">
                            Saved Book
                          </p>

                          <Link
                            to={`/read/reader/${bookId}`}
                          >
                            <h3>
                              {book.title ||
                                "Untitled"}
                            </h3>
                          </Link>

                          <p className="muted">
                            {book.author ||
                              "Unknown author"}
                          </p>

                          <Link
                            to={`/read/reader/${bookId}`}
                            className="button secondary"
                          >
                            <BookOpen
                              size={16}
                            />

                            Read
                          </Link>
                        </div>
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
