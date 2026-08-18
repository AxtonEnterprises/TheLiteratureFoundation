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
  BookOpen,
  NotebookPen,
  Pencil,
  User,
  X
} from "lucide-react";

import { auth } from "../firebase";

import {
  getJournal,
  getReadingTimeline,
  getUserProfile,
  saveUserProfile
} from "../services/storage.js";

import {
  PROFILE_AVATARS,
  getProfileAvatar
} from "../data/avatars.js";

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

  const editingFromUrl =
    searchParams.get("edit") === "1" ||
    searchParams.get("tab") === "profile";

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
            counts.get(key) ||
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


  function openEditProfile() {
    setEditingProfile(
      true
    );

    setSearchParams({
      edit: "1"
    });
  }


  function closeEditProfile() {
    setEditingProfile(
      false
    );

    setSearchParams({});
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
            selectedAvatar
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

      setSearchParams({});
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
        description="Your Random Reads reading profile and timeline."
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

          <div className="profile-header-content">
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

            {!editingProfile && (
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
            )}
          </div>
        </section>


        {status && (
          <p className="status">
            {status}
          </p>
        )}


        {editingProfile ? (
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
                <X size={16} />
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
                    (avatar) => {
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
                          aria-label={
                            `Choose ${avatar.name}`
                          }
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
        ) : (
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

              <Link
                to="/read/journal"
                className="button secondary"
              >
                <NotebookPen
                  size={16}
                />

                Full Journal
              </Link>
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
                      ) ||
                      0;

                    return (
                      <article
                        key={`reading-${
                          bookId ||
                          index
                        }`}
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
                            {percent >=
                            100
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

                          {noteCount >
                            0 && (
                            <div className="timeline-journal-link-row">
                              <Link
                                to={`/read/journal?bookId=${encodeURIComponent(
                                  bookId
                                )}`}
                                className="timeline-journal-link"
                              >
                                <NotebookPen
                                  size={16}
                                />

                                See journal entries
                                {" "}
                                ({noteCount})
                              </Link>
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

      </div>
    </main>
  );
}
