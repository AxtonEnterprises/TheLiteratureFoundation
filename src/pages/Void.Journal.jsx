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
  ArrowLeft,
  BookOpen
} from "lucide-react";

import BookCard from "../components/BookCard.jsx";
import SEO from "../components/SEO.jsx";

import {
  getJournal,
  getSavedBooks,
  migrateLocalDataToFirestore,
  removeSavedBook
} from "../services/storage.js";

import { auth } from "../firebase";


export default function Journal() {
  const [
    searchParams
  ] = useSearchParams();

  const selectedBookId =
    searchParams.get(
      "bookId"
    );

  const [
    books,
    setBooks
  ] = useState([]);

  const [
    entries,
    setEntries
  ] = useState([]);

  const [
    user,
    setUser
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    status,
    setStatus
  ] = useState("");


  const journalSEO = (
    <SEO
      title="Reading Journal | Random Reads"
      description="Save books, reading progress, notes, and reflections with the Random Reads reading journal."
      path="/read/journal"
      noindex
    />
  );


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
            setBooks([]);
            setEntries([]);
            setLoading(false);

            return;
          }

          try {
            setLoading(true);
            setStatus("");

            await migrateLocalDataToFirestore();

            const [
              savedBooks,
              journalEntries
            ] =
              await Promise.all([
                getSavedBooks(),
                getJournal()
              ]);

            setBooks(
              savedBooks
            );

            setEntries(
              journalEntries
            );
          } catch (error) {
            console.error(
              "Could not load journal:",
              error
            );

            setStatus(
              "We couldn't load your reading journal."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return unsubscribe;
  }, []);


  const filteredEntries =
    useMemo(() => {
      if (
        !selectedBookId
      ) {
        return entries;
      }

      return entries.filter(
        (entry) =>
          String(
            entry.bookId
          ) ===
          String(
            selectedBookId
          )
      );
    }, [
      entries,
      selectedBookId
    ]);


  const selectedBook =
    useMemo(() => {
      if (
        !selectedBookId
      ) {
        return null;
      }

      const savedBook =
        books.find(
          (book) =>
            String(
              book.id
            ) ===
            String(
              selectedBookId
            )
        );

      if (
        savedBook
      ) {
        return savedBook;
      }

      const journalEntry =
        entries.find(
          (entry) =>
            String(
              entry.bookId
            ) ===
            String(
              selectedBookId
            )
        );

      if (
        !journalEntry
      ) {
        return null;
      }

      return {
        id:
          selectedBookId,

        title:
          journalEntry.title ||
          "Untitled",

        author:
          journalEntry.author ||
          "Unknown author"
      };
    }, [
      books,
      entries,
      selectedBookId
    ]);


  async function handleRemove(
    bookId
  ) {
    try {
      setStatus("");

      const nextBooks =
        await removeSavedBook(
          bookId
        );

      setBooks(
        nextBooks
      );
    } catch (error) {
      console.error(
        "Could not remove saved book:",
        error
      );

      setStatus(
        "We couldn't remove that book."
      );
    }
  }


  if (loading) {
    return (
      <main className="page-wrap">
        {journalSEO}

        <section className="hero-card small">
          <p className="eyebrow">
            Reading Journal
          </p>

          <h1>
            Loading your library...
          </h1>
        </section>
      </main>
    );
  }


  if (!user) {
    return (
      <main className="page-wrap">
        {journalSEO}

        <section className="hero-card small">
          <p className="eyebrow">
            Reading Journal
          </p>

          <h1>
            Your reading belongs to you.
          </h1>

          <p>
            Log in to save books,
            journal entries, and
            reading progress across
            your devices.
          </p>

          <div className="button-row">
            <Link
              to="/read/login"
              className="button primary large"
            >
              Log In
            </Link>
          </div>
        </section>
      </main>
    );
  }


  return (
    <main className="page-wrap">
      {journalSEO}

      <div className="stack-lg">

        <section className="hero-card small">
          <p className="eyebrow">
            Reading Journal
          </p>

          {selectedBookId ? (
            <>
              <h1>
                {selectedBook?.title ||
                  "Book Journal"}
              </h1>

              {selectedBook?.author && (
                <p className="muted">
                  {
                    selectedBook.author
                  }
                </p>
              )}

              <div className="button-row">
                <Link
                  to="/read/profile"
                  className="button secondary"
                >
                  <ArrowLeft
                    size={16}
                  />

                  Reading Timeline
                </Link>

                <Link
                  to={`/read/reader/${selectedBookId}`}
                  className="button primary"
                >
                  <BookOpen
                    size={16}
                  />

                  Read Book
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1>
                Your saved reading
              </h1>

              <p className="muted">
                Your books and notes
                are saved to your
                Random Reads account.
              </p>
            </>
          )}

          {status && (
            <p className="status">
              {status}
            </p>
          )}
        </section>


        {!selectedBookId && (
          <section className="panel">
            <div
              style={{
                padding:
                  "1.25rem"
              }}
            >
              <h2>
                Saved books
              </h2>

              {books.length ===
              0 ? (
                <p className="muted">
                  No saved books yet.
                </p>
              ) : (
                <div className="results-list">
                  {books.map(
                    (book) => (
                      <BookCard
                        key={
                          book.id
                        }
                        book={
                          book
                        }
                        compact
                        onRemove={() =>
                          handleRemove(
                            book.id
                          )
                        }
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </section>
        )}


        <section className="panel">
          <div
            style={{
              padding:
                "1.25rem"
            }}
          >
            <h2>
              {selectedBookId
                ? "Journal Entries"
                : "Reading Journal"}
            </h2>

            {filteredEntries.length ===
            0 ? (
              <p className="muted">
                {selectedBookId
                  ? "No journal entries for this book yet."
                  : "No journal entries yet."}
              </p>
            ) : (
              filteredEntries.map(
                (entry) => (
                  <article
                    key={
                      entry.id
                    }
                    className="note-card"
                  >
                    {!selectedBookId && (
                      <Link
                        to={`/read/journal?bookId=${encodeURIComponent(
                          entry.bookId
                        )}`}
                        className="timeline-book-title"
                      >
                        {entry.title ||
                          "Untitled"}
                      </Link>
                    )}

                    <small>
                      {!selectedBookId &&
                        entry.author}

                      {entry.paragraphNumber
                        ? `${
                            !selectedBookId
                              ? " · "
                              : ""
                          }¶${entry.paragraphNumber}`
                        : ""}

                      {entry.createdAt
                        ? ` · ${new Date(
                            entry.createdAt
                          ).toLocaleDateString()}`
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

                    <p>
                      {entry.note}
                    </p>
                  </article>
                )
              )
            )}
          </div>
        </section>

      </div>
    </main>
  );
}
