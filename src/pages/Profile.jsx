import {
  useEffect,
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
  BookOpen,
  User,
  NotebookPen
} from "lucide-react";

import { auth } from "../firebase";

import {
  getJournal,
  getReadingTimeline,
  getUserProfile,
  saveUserProfile
} from "../services/storage.js";

import SEO from "../components/SEO.jsx";


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
          width: `${safePercent}%`
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

  const initialTab =
    [
      "profile",
      "reading",
      "journal"
    ].includes(requestedTab)
      ? requestedTab
      : "profile";

  const [
    activeTab,
    setActiveTab
  ] = useState(initialTab);

  const [user, setUser] =
    useState(null);

  const [profile, setProfile] =
    useState(null);

  const [
    readingTimeline,
    setReadingTimeline
  ] = useState([]);

  const [
    journalEntries,
    setJournalEntries
  ] = useState([]);

  const [
    displayName,
    setDisplayName
  ] = useState("");

  const [
    photoURL,
    setPhotoURL
  ] = useState("");

  const [
    about,
    setAbout
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [status, setStatus] =
    useState("");


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
            setLoading(false);
            return;
          }

          try {
            setLoading(true);
            setStatus("");

            const [
              loadedProfile,
              timeline,
              journal
            ] =
              await Promise.all([
                getUserProfile(),
                getReadingTimeline(),
                getJournal()
              ]);

            setProfile(
              loadedProfile
            );

            setDisplayName(
              loadedProfile
                ?.displayName ||
              ""
            );

            setPhotoURL(
              loadedProfile
                ?.photoURL ||
              ""
            );

            setAbout(
              loadedProfile
                ?.about ||
              ""
            );

            setReadingTimeline(
              timeline
            );

            setJournalEntries(
              journal
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


  function changeTab(
    nextTab
  ) {
    setActiveTab(nextTab);

    setSearchParams({
      tab: nextTab
    });
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
          photoURL,
          about
        });

      setProfile(saved);

      setStatus(
        "Profile saved."
      );
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
            profile, and journal are
            connected to your Random
            Reads account.
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
        description="Your Random Reads reading profile, timeline, and journal."
        path="/read/profile"
        noindex
      />

      <div className="stack-lg">

        <section className="profile-header-card">
          <div className="profile-avatar">
            {profile?.photoURL ? (
              <img
                src={
                  profile.photoURL
                }
                alt=""
              />
            ) : (
              <User size={42} />
            )}
          </div>

          <div>
            <p className="eyebrow">
              Reader Profile
            </p>

            <h1 className="profile-title">
              {profile?.displayName ||
                "Reader"}
            </h1>

            {profile?.about && (
              <p className="muted">
                {profile.about}
              </p>
            )}
          </div>
        </section>


        <nav
          className="profile-tabs"
          aria-label="Profile sections"
        >
          <button
            type="button"
            className={
              activeTab === "profile"
                ? "profile-tab active"
                : "profile-tab"
            }
            onClick={() =>
              changeTab(
                "profile"
              )
            }
          >
            <User size={18} />
            Profile
          </button>

          <button
            type="button"
            className={
              activeTab === "reading"
                ? "profile-tab active"
                : "profile-tab"
            }
            onClick={() =>
              changeTab(
                "reading"
              )
            }
          >
            <BookOpen size={18} />
            Reading Timeline
          </button>

          <button
            type="button"
            className={
              activeTab === "journal"
                ? "profile-tab active"
                : "profile-tab"
            }
            onClick={() =>
              changeTab(
                "journal"
              )
            }
          >
            <NotebookPen
              size={18}
            />
            Journal
          </button>
        </nav>


        {status && (
          <p className="status">
            {status}
          </p>
        )}


        {activeTab ===
          "profile" && (
          <section className="panel profile-panel">
            <h2>
              Edit Profile
            </h2>

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
                      event.target
                        .value
                    )
                  }
                  maxLength={80}
                />
              </label>


              <label>
                Profile picture URL

                <input
                  type="url"
                  value={
                    photoURL
                  }
                  onChange={(
                    event
                  ) =>
                    setPhotoURL(
                      event.target
                        .value
                    )
                  }
                  placeholder="https://..."
                />
              </label>


              {photoURL && (
                <div className="profile-photo-preview">
                  <img
                    src={photoURL}
                    alt="Profile preview"
                  />
                </div>
              )}


              <label>
                About me

                <textarea
                  value={about}
                  onChange={(
                    event
                  ) =>
                    setAbout(
                      event.target
                        .value
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


              <div>
                <button
                  type="submit"
                  className="button primary"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : "Save Profile"}
                </button>
              </div>
            </form>
          </section>
        )}


        {activeTab ===
          "reading" && (
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

              <span className="muted">
                {
                  readingTimeline.length
                }{" "}
                {
                  readingTimeline.length ===
                  1
                    ? "book"
                    : "books"
                }
              </span>
            </div>


            {readingTimeline.length ===
            0 ? (
              <p className="muted">
                You haven't started
                reading a book yet.
              </p>
            ) : (
              <div className="reading-timeline">
                {readingTimeline.map(
                  (item) => {
                    const percent =
                      Math.min(
                        Math.max(
                          Number(
                            item
                              .percentComplete
                          ) || 0,
                          0
                        ),
                        100
                      );

                    return (
                      <article
                        key={
                          item.bookId ||
                          item.id
                        }
                        className="timeline-book"
                      >
                        {item.image && (
                          <Link
                            to={`/read/reader/${item.bookId}`}
                            className="timeline-cover"
                          >
                            <img
                              src={
                                item.image
                              }
                              alt=""
                            />
                          </Link>
                        )}

                        <div className="timeline-book-content">
                          <Link
                            to={`/read/reader/${item.bookId}`}
                            className="timeline-book-title"
                          >
                            {item.title ||
                              "Untitled"}
                          </Link>

                          <p className="timeline-author">
                            {item.author ||
                              "Unknown author"}
                          </p>

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
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}


        {activeTab ===
          "journal" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Reflections
                </p>

                <h2>
                  Journal Snippets
                </h2>
              </div>

              <Link
                to="/read/journal"
                className="button secondary"
              >
                Full Journal
              </Link>
            </div>


            {journalEntries.length ===
            0 ? (
              <p className="muted">
                No journal entries yet.
              </p>
            ) : (
              <div className="profile-journal-list">
                {journalEntries.map(
                  (entry) => (
                    <article
                      key={entry.id}
                      className="profile-journal-snippet"
                    >
                      <Link
                        to={`/read/reader/${entry.bookId}`}
                        className="timeline-book-title"
                      >
                        {entry.title ||
                          "Untitled"}
                      </Link>

                      <small>
                        {entry.author}

                        {entry.createdAt
                          ? ` · ${formatDate(
                              entry.createdAt
                            )}`
                          : ""}
                      </small>

                      <p>
                        {entry.note}
                      </p>
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
