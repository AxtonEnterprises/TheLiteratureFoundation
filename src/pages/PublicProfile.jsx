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
  User
} from "lucide-react";

import {
  getPublicJournalForUser,
  getPublicProfile
} from "../services/storage.js";

import {
  getProfileAvatar
} from "../data/avatars.js";

import SEO from "../components/SEO.jsx";


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


  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setStatus("");

        const [
          loadedProfile,
          publicEntries
        ] =
          await Promise.all([
            getPublicProfile(
              userId
            ),
            getPublicJournalForUser(
              userId
            )
          ]);

        if (!active) {
          return;
        }

        setProfile(
          loadedProfile
        );

        setEntries(
          publicEntries
        );

        if (!loadedProfile) {
          setStatus(
            "This reader profile is not available."
          );
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

            {profile?.about && (
              <p className="muted">
                {profile.about}
              </p>
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
                  From the Margins
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
                      className="note-card public-profile-entry"
                    >
                      <div className="public-entry-book-row">
                        <div>
                          <p className="eyebrow">
                            Reading
                          </p>

                          <Link
                            to={`/read/reader/${entry.bookId}`}
                            className="timeline-book-title"
                          >
                            {entry.title ||
                              "Untitled"}
                          </Link>
                        </div>

                        <BookOpen
                          size={20}
                        />
                      </div>


                      <small className="muted">
                        {entry.paragraphNumber
                          ? `¶${entry.paragraphNumber}`
                          : ""}

                        {entry.createdAt
                          ? ` · ${formatDate(
                              entry.createdAt
                            )}`
                          : ""}

                        {entry.updatedAtISO
                          ? " · Edited"
                          : ""}
                      </small>


                      {entry.paragraphPreview && (
                        <p className="journal-paragraph-preview">
                          “
                          {
                            entry.paragraphPreview
                          }
                          ”
                        </p>
                      )}


                      <p className="public-journal-note">
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
