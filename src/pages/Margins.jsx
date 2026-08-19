import {
  useEffect,
  useState
} from "react";

import {
  BookOpen,
  Users
} from "lucide-react";

import {
  Link
} from "react-router-dom";

import {
  getMarginsFeed
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

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}


export default function Margins() {
  const [
    filter,
    setFilter
  ] = useState("all");

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

    async function loadMargins() {
      try {
        setLoading(true);
        setStatus("");

        const feed =
          await getMarginsFeed();

        if (
          active
        ) {
          setEntries(
            feed
          );
        }
      } catch (error) {
        console.error(
          "Could not load The Margins:",
          error
        );

        if (
          active
        ) {
          setStatus(
            "We couldn't load The Margins."
          );
        }
      } finally {
        if (
          active
        ) {
          setLoading(false);
        }
      }
    }

    loadMargins();

    return () => {
      active = false;
    };
  }, []);


  return (
    <main className="page-wrap">
      <SEO
        title="The Margins | Random Reads"
        description="See what readers are discovering, questioning, and discussing across classic literature."
        path="/read/margins"
      />

      <div className="stack-lg">

        <section className="hero-card small margins-hero">
          <p className="eyebrow">
            Reader Community
          </p>

          <h1>
            The Margins
          </h1>

          <p className="muted">
            Notes, questions, observations,
            and discoveries from readers
            across the library.
          </p>
        </section>


        <section className="margins-filter-bar">
          <button
            type="button"
            className={
              filter ===
              "all"
                ? "margins-filter active"
                : "margins-filter"
            }
            onClick={() =>
              setFilter(
                "all"
              )
            }
          >
            All
          </button>

          <button
            type="button"
            className="margins-filter"
            onClick={() =>
              setFilter(
                "friends"
              )
            }
          >
            Friends
          </button>

          <button
            type="button"
            className="margins-filter"
            onClick={() =>
              setFilter(
                "groups"
              )
            }
          >
            Groups
          </button>
        </section>


        {filter !==
          "all" && (
          <section className="panel margins-coming-soon">
            <Users
              size={22}
            />

            <div>
              <strong>
                {filter ===
                "friends"
                  ? "Friends feed"
                  : "Groups feed"}
              </strong>

              <p className="muted">
                This filter will activate when
                the corresponding social feature
                is added.
              </p>
            </div>
          </section>
        )}


        {filter ===
          "all" && (
          <>
            {loading && (
              <section className="panel margins-loading">
                <p className="muted">
                  Loading The Margins...
                </p>
              </section>
            )}

            {status && (
              <p className="status">
                {status}
              </p>
            )}

            {!loading &&
              !status &&
              entries.length ===
                0 && (
              <section className="panel margins-empty">
                <p className="muted">
                  Nothing has been written
                  in The Margins yet.
                </p>
              </section>
            )}

            {!loading &&
              entries.length >
                0 && (
              <div className="margins-feed">
                {entries.map(
                  (
                    entry
                  ) => {
                    const reader =
                      entry.reader;

                    const avatar =
                      getProfileAvatar(
                        reader
                          ?.avatar
                      );

                    return (
                      <article
                        key={
                          entry.id
                        }
                        className="margins-entry"
                      >
                        <div className="margins-reader-row">
                          <Link
                            to={`/read/public/${entry.userId}`}
                            className="margins-reader-link"
                          >
                            <div className="margins-reader-avatar">
                              {avatar ? (
                                <img
                                  src={
                                    avatar.image
                                  }
                                  alt=""
                                />
                              ) : (
                                <Users
                                  size={20}
                                />
                              )}
                            </div>

                            <div>
                              <strong>
                                {reader
                                  ?.displayName ||
                                  "Reader"}
                              </strong>

                              <small>
                                {formatDate(
                                  entry.updatedAtISO ||
                                  entry.createdAt
                                )}
                              </small>
                            </div>
                          </Link>
                        </div>


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
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </>
        )}

      </div>
    </main>
  );
}
