import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Link } from "react-router-dom";

import BookCard from "../components/BookCard.jsx";

import {
  getJournal,
  getSavedBooks,
  migrateLocalDataToFirestore,
  removeSavedBook
} from "../services/storage.js";

import { auth } from "../firebase";

export default function Journal() {
  const [books, setBooks] = useState([]);
  const [entries, setEntries] = useState([]);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);

        if (!firebaseUser) {
          setBooks([]);
          setEntries([]);
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setStatus("");

          /*
           * Move any old browser-based Random Reads
           * data into this user's Firestore account.
           *
           * This only runs once per UID.
           */
          await migrateLocalDataToFirestore();

          const [
            savedBooks,
            journalEntries
          ] = await Promise.all([
            getSavedBooks(),
            getJournal()
          ]);

          setBooks(savedBooks);
          setEntries(journalEntries);
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

  async function handleRemove(bookId) {
    try {
      setStatus("");

      const nextBooks =
        await removeSavedBook(bookId);

      setBooks(nextBooks);
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
        <section className="hero-card small">
          <p className="eyebrow">
            Reading Journal
          </p>

          <h1>Loading your library...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-wrap">
        <section className="hero-card small">
          <p className="eyebrow">
            Reading Journal
          </p>

          <h1>Your reading belongs to you.</h1>

          <p>
            Log in to save books, journal entries,
            and reading progress across your devices.
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
      <div className="stack-lg">

        <section className="hero-card small">
          <p className="eyebrow">
            Your Library
          </p>

          <h1>Your saved reading</h1>

          <p className="muted">
            Your books and notes are saved to your
            Random Reads account.
          </p>

          {status && (
            <p className="status">
              {status}
            </p>
          )}
        </section>

        <section className="panel">
          <div style={{ padding: "1.25rem" }}>
            <h2>Saved books</h2>

            {books.length === 0 ? (
              <p className="muted">
                No saved books yet.
              </p>
            ) : (
              <div className="results-list">
                {books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    compact
                    onRemove={() =>
                      handleRemove(book.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div style={{ padding: "1.25rem" }}>
            <h2>Reading Journal</h2>

            {entries.length === 0 ? (
              <p className="muted">
                No journal entries yet.
              </p>
            ) : (
              entries.map((entry) => (
                <article
                  key={entry.id}
                  className="note-card"
                >
                  <strong>
                    {entry.title}
                  </strong>

                  <small>
                    {entry.author}

                    {entry.createdAt
                      ? ` · ${new Date(
                          entry.createdAt
                        ).toLocaleDateString()}`
                      : ""}
                  </small>

                  <p>{entry.note}</p>
                </article>
              ))
            )}
          </div>
        </section>

      </div>
    </main>
  );
}
