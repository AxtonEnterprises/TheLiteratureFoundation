import {
  useEffect,
  useMemo,
  useState
} from "react";

import { onAuthStateChanged } from "firebase/auth";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Globe2,
  Lock,
  Pencil,
  Trash2,
  Users,
  X
} from "lucide-react";

import BookCard from "../components/BookCard.jsx";
import SEO from "../components/SEO.jsx";
import {
  deleteJournalEntry,
  getJournal,
  getSavedBooks,
  migrateLocalDataToFirestore,
  removeSavedBook,
  updateJournalEntry
} from "../services/storage.js";
import { auth } from "../firebase";

function getVisibilityLabel(visibility) {
  switch (visibility) {
    case "public": return "Public";
    case "group": return "Group";
    default: return "Private";
  }
}

function VisibilityIcon({ visibility }) {
  if (visibility === "public") return <Globe2 size={14} />;
  if (visibility === "group") return <Users size={14} />;
  return <Lock size={14} />;
}

export default function Journal() {
  const [searchParams] = useSearchParams();
  const selectedBookId = searchParams.get("bookId");

  const [books, setBooks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState("private");
  const [editGroupId, setEditGroupId] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  const journalSEO = (
    <SEO
      title="Reading Journal | Random Reads"
      description="Save books, reading progress, notes, and reflections with the Random Reads reading journal."
      path="/read/journal"
      noindex
    />
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
        await migrateLocalDataToFirestore();

        const [savedBooks, journalEntries] = await Promise.all([
          getSavedBooks(),
          getJournal()
        ]);

        setBooks(savedBooks);
        setEntries(journalEntries);
      } catch (error) {
        console.error("Could not load journal:", error);
        setStatus("We couldn't load your reading journal.");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const filteredEntries = useMemo(() => {
    if (!selectedBookId) return entries;

    return entries.filter(
      (entry) => String(entry.bookId) === String(selectedBookId)
    );
  }, [entries, selectedBookId]);

  const selectedBook = useMemo(() => {
    if (!selectedBookId) return null;

    const savedBook = books.find(
      (book) => String(book.id) === String(selectedBookId)
    );

    if (savedBook) return savedBook;

    const journalEntry = entries.find(
      (entry) => String(entry.bookId) === String(selectedBookId)
    );

    if (!journalEntry) return null;

    return {
      id: selectedBookId,
      title: journalEntry.title || "Untitled",
      author: journalEntry.author || "Unknown author"
    };
  }, [books, entries, selectedBookId]);

  async function handleRemove(bookId) {
    try {
      setStatus("");
      const nextBooks = await removeSavedBook(bookId);
      setBooks(nextBooks);
    } catch (error) {
      console.error("Could not remove saved book:", error);
      setStatus("We couldn't remove that book.");
    }
  }

  function beginEdit(entry) {
    setEditingEntryId(entry.id);
    setEditNote(entry.note || "");
    setEditVisibility(entry.visibility || "private");
    setEditGroupId(entry.groupId || "");
    setStatus("");
  }

  function cancelEdit() {
    setEditingEntryId(null);
    setEditNote("");
    setEditVisibility("private");
    setEditGroupId("");
  }

  async function handleUpdateEntry(entry) {
    if (!editNote.trim()) {
      setStatus("A journal entry cannot be empty.");
      return;
    }

    if (editVisibility === "group" && !editGroupId.trim()) {
      setStatus("Enter a group ID for group-visible journal entries.");
      return;
    }

    try {
      setSavingEntry(true);
      setStatus("");

      const updated = await updateJournalEntry(entry.id, {
        note: editNote.trim(),
        visibility: editVisibility,
        groupId: editVisibility === "group" ? editGroupId.trim() : null
      });

      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, ...updated } : item
        )
      );

      cancelEdit();
      setStatus("Journal entry updated.");
    } catch (error) {
      console.error("Could not update journal entry:", error);
      setStatus("We couldn't update that journal entry.");
    } finally {
      setSavingEntry(false);
    }
  }

  async function handleDeleteEntry(entry) {
    const confirmed = window.confirm(
      "Delete this journal entry? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      setDeletingEntryId(entry.id);
      setStatus("");

      await deleteJournalEntry(entry.id);

      setEntries((current) =>
        current.filter((item) => item.id !== entry.id)
      );

      if (editingEntryId === entry.id) cancelEdit();

      setStatus("Journal entry deleted.");
    } catch (error) {
      console.error("Could not delete journal entry:", error);
      setStatus("We couldn't delete that journal entry.");
    } finally {
      setDeletingEntryId(null);
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        {journalSEO}
        <section className="hero-card small">
          <p className="eyebrow">Reading Journal</p>
          <h1>Loading your library...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-wrap">
        {journalSEO}
        <section className="hero-card small">
          <p className="eyebrow">Reading Journal</p>
          <h1>Your reading belongs to you.</h1>
          <p>
            Log in to save books, journal entries, and reading progress across
            your devices.
          </p>
          <div className="button-row">
            <Link to="/read/login" className="button primary large">
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
          <p className="eyebrow">Reading Journal</p>

          {selectedBookId ? (
            <>
              <h1>{selectedBook?.title || "Book Journal"}</h1>

              {selectedBook?.author && (
                <p className="muted">{selectedBook.author}</p>
              )}

              <div className="button-row">
                <Link to="/read/profile" className="button secondary">
                  <ArrowLeft size={16} />
                  Reading Timeline
                </Link>

                <Link
                  to={`/read/reader/${selectedBookId}`}
                  state={
                    selectedBook
                      ? {
                          book: {
                            ...selectedBook,
                            id: selectedBookId,
                            bookId: selectedBookId
                          }
                        }
                      : undefined
                  }
                  className="button primary"
                >
                  <BookOpen size={16} />
                  Read Book
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1>Your saved reading</h1>
              <p className="muted">
                Your books and notes are saved to your Random Reads account.
              </p>
            </>
          )}

          {status && <p className="status">{status}</p>}
        </section>

        {!selectedBookId && (
          <section className="panel">
            <div style={{ padding: "1.25rem" }}>
              <h2>Saved books</h2>

              {books.length === 0 ? (
                <p className="muted">No saved books yet.</p>
              ) : (
                <div className="results-list">
                  {books.map((book) => (
                    <BookCard
                      key={book.id}
                      book={book}
                      compact
                      onRemove={() => handleRemove(book.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <section className="panel">
          <div style={{ padding: "1.25rem" }}>
            <h2>
              {selectedBookId ? "Journal Entries" : "Reading Journal"}
            </h2>

            {filteredEntries.length === 0 ? (
              <p className="muted">
                {selectedBookId
                  ? "No journal entries for this book yet."
                  : "No journal entries yet."}
              </p>
            ) : (
              filteredEntries.map((entry) => {
                const isEditing = editingEntryId === entry.id;
                const visibility = entry.visibility || "private";

                return (
                  <article key={entry.id} className="note-card">
                    {!selectedBookId && (
                      <Link
                        to={`/read/journal?bookId=${encodeURIComponent(
                          entry.bookId
                        )}`}
                        className="timeline-book-title"
                      >
                        {entry.title || "Untitled"}
                      </Link>
                    )}

                    <div className="journal-entry-meta-row">
                      <small>
                        {!selectedBookId && entry.author}

                        {entry.paragraphNumber
                          ? `${
                              !selectedBookId ? " · " : ""
                            }¶${entry.paragraphNumber}`
                          : ""}

                        {entry.createdAt
                          ? ` · ${new Date(
                              entry.createdAt
                            ).toLocaleDateString()}`
                          : ""}

                        {entry.updatedAtISO ? " · Edited" : ""}
                      </small>

                      <span
                        className={`journal-visibility-badge ${visibility}`}
                      >
                        <VisibilityIcon visibility={visibility} />
                        {getVisibilityLabel(visibility)}
                      </span>
                    </div>

                    {entry.paragraphPreview && (
                      <p className="journal-paragraph-preview">
                        “{entry.paragraphPreview}”
                      </p>
                    )}

                    {isEditing ? (
                      <div className="journal-edit-form">
                        <label className="journal-edit-field">
  <span>Journal entry</span>

  <textarea
    value={editNote}
    onChange={(event) =>
      setEditNote(event.target.value)
    }
    rows={5}
  />
</label>

                        <label className="journal-edit-field">
  <span>Visibility</span>

  <select
    value={editVisibility}
    onChange={(event) => {
      const nextVisibility =
        event.target.value;

      setEditVisibility(
        nextVisibility
      );

      if (
        nextVisibility !== "group"
      ) {
        setEditGroupId("");
      }
    }}
  >
    <option value="private">
      Private
    </option>

    <option value="public">
      Public
    </option>

    <option value="group">
      Group
    </option>
  </select>
</label>

                        {editVisibility === "group" && (
                          <label>
                            Group ID
                            <input
                              type="text"
                              value={editGroupId}
                              onChange={(event) =>
                                setEditGroupId(event.target.value)
                              }
                              placeholder="Group ID"
                            />
                          </label>
                        )}

                        <div className="button-row">
                          <button
                            type="button"
                            className="button primary"
                            onClick={() => handleUpdateEntry(entry)}
                            disabled={savingEntry || !editNote.trim()}
                          >
                            <Check size={16} />
                            {savingEntry ? "Saving..." : "Save Changes"}
                          </button>

                          <button
                            type="button"
                            className="button secondary"
                            onClick={cancelEdit}
                            disabled={savingEntry}
                          >
                            <X size={16} />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {entry.bookId !== undefined &&
                        entry.bookId !== null ? (
                          <Link
                            to={`/read/reader/${entry.bookId}?paragraph=${Math.max(
                              Number(entry.paragraphIndex) || 0,
                              0
                            )}&note=${encodeURIComponent(entry.id)}`}
                            className="journal-note-deep-link"
                            title={`Open paragraph ${Math.max(
                              Number(entry.paragraphIndex) || 0,
                              0
                            ) + 1} in the Reader`}
                          >
                            <p>{entry.note}</p>
                          </Link>
                        ) : (
                          <p>{entry.note}</p>
                        )}

                        {visibility === "group" && entry.groupId && (
                          <small className="journal-group-label">
                            Group: {entry.groupId}
                          </small>
                        )}

                        <div className="journal-entry-actions">
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => beginEdit(entry)}
                          >
                            <Pencil size={15} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="button danger"
                            onClick={() => handleDeleteEntry(entry)}
                            disabled={deletingEntryId === entry.id}
                          >
                            <Trash2 size={15} />
                            {deletingEntryId === entry.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
