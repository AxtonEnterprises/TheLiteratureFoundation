import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  Link,
  useLocation,
  useParams
} from "react-router-dom";

import {
  Check,
  Globe2,
  Lock,
  NotebookPen,
  Pencil,
  Trash2,
  Users,
  X
} from "lucide-react";

import ReaderControls from "../components/ReaderControls.jsx";

import {
  getBookById,
  getStructuredBookText
} from "../services/booksApi.js";

import {
  addJournalEntry,
  clearReadingPresence,
  deleteJournalEntry,
  getJournalForBook,
  getReadingProgress,
  saveBook,
  saveReadingProgress,
  updateJournalEntry,
  updateReadingPresence
} from "../services/storage.js";

import {
  paginateParagraphs
} from "../utils/paginateText.js";

import { auth } from "../firebase";
import SEO from "../components/SEO.jsx";

function formatNoteDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getVisibilityLabel(visibility) {
  switch (visibility) {
    case "public":
      return "Public";
    case "group":
      return "Group";
    default:
      return "Private";
  }
}

function VisibilityIcon({ visibility }) {
  if (visibility === "public") {
    return <Globe2 size={14} />;
  }

  if (visibility === "group") {
    return <Users size={14} />;
  }

  return <Lock size={14} />;
}

export default function Reader() {
  const { id } = useParams();
  const location = useLocation();
  const readerRef = useRef(null);

  const [book, setBook] = useState(location.state?.book || null);
  const [paragraphs, setParagraphs] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState(null);
  const [fontSize, setFontSize] = useState(18);
  const [note, setNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("private");
  const [noteGroupId, setNoteGroupId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [readerSize, setReaderSize] = useState({
    width: 0,
    height: 0
  });

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState("private");
  const [editGroupId, setEditGroupId] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadBook() {
      setLoading(true);
      setStatus("");
      setParagraphs([]);
      setChapters([]);
      setJournalEntries([]);
      setPageIndex(0);
      setProgressLoaded(false);

      try {
        const loadedBook = book || (await getBookById(id));

        if (!active) return;

        setBook(loadedBook);

        const structuredBook = await getStructuredBookText(loadedBook);

        if (!active) return;

        setParagraphs(structuredBook.paragraphs || []);
        setChapters(structuredBook.chapters || []);

        const notes = await getJournalForBook(loadedBook.id);

        if (active) {
          setJournalEntries(notes);
        }
      } catch (error) {
        console.error("Could not load reader:", error);

        if (active) {
          setParagraphs([
            `Could not load the reader text. ${
              error?.message || "Unknown error"
            }`
          ]);

          setStatus("The book text could not be loaded.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadBook();

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    function updateSize() {
      if (!readerRef.current) return;

      const rect = readerRef.current.getBoundingClientRect();

      setReaderSize({
        width: rect.width,
        height: rect.height
      });
    }

    updateSize();

    window.addEventListener("resize", updateSize);
    window.addEventListener("orientationchange", updateSize);

    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("orientationchange", updateSize);
    };
  }, []);

  useEffect(() => {
    if (!readerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) return;

      setReaderSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      });
    });

    resizeObserver.observe(readerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const pages = useMemo(() => {
    if (
      !paragraphs.length ||
      !readerSize.width ||
      !readerSize.height
    ) {
      return [];
    }

    return paginateParagraphs({
      paragraphs,
      containerWidth: readerSize.width,
      containerHeight: readerSize.height,
      fontSize,
      className: "reader-window"
    });
  }, [
    paragraphs,
    readerSize.width,
    readerSize.height,
    fontSize
  ]);

  const totalPages = Math.max(pages.length, 1);
  const currentPage = pages[pageIndex]?.blocks || [];

  const currentParagraphIndexes = useMemo(() => {
    return [
      ...new Set(
        currentPage.map((block) => block.paragraphIndex)
      )
    ];
  }, [currentPage]);

  useEffect(() => {
    if (
      currentParagraphIndexes.length &&
      (
        selectedParagraphIndex === null ||
        !currentParagraphIndexes.includes(selectedParagraphIndex)
      )
    ) {
      setSelectedParagraphIndex(currentParagraphIndexes[0]);
    }
  }, [currentParagraphIndexes, selectedParagraphIndex]);

  const notesForCurrentPage = useMemo(() => {
    const currentSet = new Set(currentParagraphIndexes);

    return journalEntries.filter(
      (entry) =>
        entry.paragraphIndex !== undefined &&
        entry.paragraphIndex !== null &&
        currentSet.has(Number(entry.paragraphIndex))
    );
  }, [journalEntries, currentParagraphIndexes]);

  const progress =
    totalPages > 1
      ? Math.round(((pageIndex + 1) / totalPages) * 100)
      : paragraphs.length
        ? 100
        : 0;

  useEffect(() => {
    if (!book?.id || !pages.length || progressLoaded) {
      return;
    }

    let active = true;

    async function restoreProgress() {
      try {
        const saved = await getReadingProgress(book.id);

        if (!active) return;

        if (
          saved?.paragraphIndex !== undefined &&
          saved?.paragraphIndex !== null
        ) {
          const restoredPageIndex = pages.findIndex((page) =>
            page.blocks.some(
              (block) =>
                block.paragraphIndex === Number(saved.paragraphIndex)
            )
          );

          setPageIndex(
            restoredPageIndex >= 0 ? restoredPageIndex : 0
          );
        }
      } catch (error) {
        console.error("Could not restore reading progress:", error);
      } finally {
        if (active) {
          setProgressLoaded(true);
        }
      }
    }

    restoreProgress();

    return () => {
      active = false;
    };
  }, [book?.id, pages, progressLoaded]);

  useEffect(() => {
    if (!book?.id || !progressLoaded || !pages[pageIndex]) {
      return;
    }

    let cancelled = false;

    async function persistProgress() {
      try {
        await saveReadingProgress(
          book,
          pages[pageIndex].startParagraphIndex,
          paragraphs.length,
          progress
        );
      } catch (error) {
        if (!cancelled && auth.currentUser) {
          console.error("Could not save reading progress:", error);
        }
      }
    }

    persistProgress();

    return () => {
      cancelled = true;
    };
  }, [
    book,
    pageIndex,
    pages,
    paragraphs.length,
    progress,
    progressLoaded
  ]);

useEffect(() => {
  if (
    !book?.id ||
    !progressLoaded ||
    !auth.currentUser
  ) {
    return;
  }

  let active = true;

  async function heartbeat() {
    try {
      await updateReadingPresence({
        book,
        percentComplete:
          progress
      });
    } catch (error) {
      /*
       * Presence should never interrupt reading.
       */
      if (
        active &&
        auth.currentUser
      ) {
        console.error(
          "Could not update reading presence:",
          error
        );
      }
    }
  }

  /*
   * Register immediately when the reader is ready.
   */
  heartbeat();

  /*
   * Keep the reader active while this book remains open.
   *
   * The public presence window is 10 minutes, so a
   * 3-minute heartbeat leaves plenty of margin.
   */
  const heartbeatInterval =
    window.setInterval(
      heartbeat,
      1000 * 60 * 3
    );

  return () => {
    active = false;

    window.clearInterval(
      heartbeatInterval
    );
  };
}, [
  book,
  progress,
  progressLoaded
]);

  useEffect(() => {
  const bookId =
    book?.id;

  if (!bookId) {
    return;
  }

  return () => {
    /*
     * Fire-and-forget cleanup.
     *
     * If navigation/unloading prevents this request from
     * completing, the 10-minute activity window still
     * prevents stale presence from appearing indefinitely.
     */
    clearReadingPresence(
      bookId
    ).catch(
      (error) => {
        if (
          auth.currentUser
        ) {
          console.error(
            "Could not clear reading presence:",
            error
          );
        }
      }
    );
  };
}, [
  book?.id
]);
  
  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(totalPages - 1, 0));
    }
  }, [totalPages, pageIndex]);

  function goToPage(newPageIndex) {
    const safePageIndex = Math.min(
      Math.max(newPageIndex, 0),
      totalPages - 1
    );

    setPageIndex(safePageIndex);
  }

  function goToChapter(paragraphIndex) {
    const targetPageIndex = pages.findIndex((page) =>
      page.blocks.some(
        (block) => block.paragraphIndex === paragraphIndex
      )
    );

    setShowToc(false);
    goToPage(targetPageIndex >= 0 ? targetPageIndex : 0);
  }

  async function handleSave() {
    if (!book) return;

    setStatus("");

    if (!auth.currentUser) {
      setStatus("Log in to save this book to your account.");
      return;
    }

    try {
      await saveBook(book);
      setStatus("Book saved to your account.");
    } catch (error) {
      console.error("Could not save book:", error);
      setStatus("We couldn't save this book. Please try again.");
    }
  }

  async function handleJournal() {
    if (
      !book ||
      !note.trim() ||
      selectedParagraphIndex === null
    ) {
      return;
    }

    if (
      noteVisibility === "group" &&
      !noteGroupId.trim()
    ) {
      setStatus(
        "Enter a group ID for group-visible journal entries."
      );
      return;
    }

    setStatus("");

    if (!auth.currentUser) {
      setStatus("Log in to save journal entries.");
      return;
    }

    try {
      const paragraphText =
        paragraphs[selectedParagraphIndex] || "";

      const journalEntry = await addJournalEntry({
        bookId: book.id,
        title: book.title,
        author: book.author,
        paragraphIndex: selectedParagraphIndex,
        paragraphNumber: selectedParagraphIndex + 1,
        paragraphPreview: paragraphText.slice(0, 240),
        note: note.trim(),
        visibility: noteVisibility,
        groupId:
          noteVisibility === "group"
            ? noteGroupId.trim()
            : null
      });

      setJournalEntries((current) => [
        journalEntry,
        ...current
      ]);

      setNote("");
      setNoteVisibility("private");
      setNoteGroupId("");

      setStatus(
        `Note saved to paragraph ${selectedParagraphIndex + 1}.`
      );
    } catch (error) {
      console.error("Could not save journal entry:", error);
      setStatus(
        "We couldn't save your journal entry. Please try again."
      );
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

    if (
      editVisibility === "group" &&
      !editGroupId.trim()
    ) {
      setStatus(
        "Enter a group ID for group-visible journal entries."
      );
      return;
    }

    try {
      setSavingEntry(true);
      setStatus("");

      const updated = await updateJournalEntry(
        entry.id,
        {
          note: editNote.trim(),
          visibility: editVisibility,
          groupId:
            editVisibility === "group"
              ? editGroupId.trim()
              : null
        }
      );

      setJournalEntries((current) =>
        current.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                ...updated
              }
            : item
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

      setJournalEntries((current) =>
        current.filter((item) => item.id !== entry.id)
      );

      if (editingEntryId === entry.id) {
        cancelEdit();
      }

      setStatus("Journal entry deleted.");
    } catch (error) {
      console.error("Could not delete journal entry:", error);
      setStatus("We couldn't delete that journal entry.");
    } finally {
      setDeletingEntryId(null);
    }
  }

  return (
    <section className="reader-page">
      <SEO
        title={
          book
            ? `${book.title} | Random Reads`
            : "Read Classic Literature | Random Reads"
        }
        description={
          book
            ? `Read ${book.title}${
                book.author ? ` by ${book.author}` : ""
              } free online with Random Reads from The Literature Foundation.`
            : "Read classic public-domain literature free online with Random Reads."
        }
        path={`/read/reader/${id}`}
        image={
          book?.image ||
          "https://theliteraturefoundation.org/branding/random-reads-icon.svg"
        }
        type="book"
      />

      <div className="reader-topbar">
        <div>
          <Link to="/read/search" className="back-link">
            ← Back to search
          </Link>

          <h1>{book?.title || "Reader"}</h1>

          {book?.author && (
            <p className="muted">{book.author}</p>
          )}
        </div>

        <ReaderControls
          fontSize={fontSize}
          setFontSize={setFontSize}
        />
      </div>

      <div className="button-row">
        <button
          type="button"
          className="button secondary"
          onClick={handleSave}
          disabled={!book}
        >
          Save book
        </button>

        <button
          type="button"
          className="button secondary"
          onClick={() => setShowToc((value) => !value)}
          disabled={!chapters.length}
        >
          {showToc ? "Hide contents" : "Table of contents"}
        </button>
      </div>

      {status && <p className="status">{status}</p>}

      {showToc && (
        <aside className="reader-notes-panel">
          <h2>Table of contents</h2>

          <div className="toc-list">
            {chapters.map((chapter, index) => (
              <button
                key={`${chapter.title}-${chapter.paragraphIndex}-${index}`}
                type="button"
                className="toc-link"
                onClick={() =>
                  goToChapter(chapter.paragraphIndex)
                }
              >
                {chapter.title}
              </button>
            ))}
          </div>
        </aside>
      )}

      <div className="reader-progress">
        <span>
          Page {pageIndex + 1} of {totalPages}
        </span>
        <span>{progress}%</span>
      </div>

      <article
        ref={readerRef}
        className="reader-window"
        style={{
          fontSize: `${fontSize}px`
        }}
      >
        {loading ? (
          <p>Loading reader...</p>
        ) : currentPage.length ? (
          currentPage.map((block, index) => {
            const showNumber = !block.isContinuation;

            const paragraphHasNote = journalEntries.some(
              (entry) =>
                Number(entry.paragraphIndex) ===
                block.paragraphIndex
            );

            return (
              <div
                key={`${block.paragraphIndex}-${index}`}
                className="reader-paragraph-row"
              >
                <button
                  type="button"
                  className={
                    paragraphHasNote
                      ? "paragraph-number has-note"
                      : "paragraph-number"
                  }
                  onClick={() =>
                    setSelectedParagraphIndex(block.paragraphIndex)
                  }
                  aria-label={`Use paragraph ${
                    block.paragraphIndex + 1
                  } for note`}
                >
                  {showNumber
                    ? block.paragraphIndex + 1
                    : ""}
                </button>

                <p>{block.text}</p>
              </div>
            );
          })
        ) : (
          <p>No readable text is available for this page.</p>
        )}
      </article>

      <div className="reader-nav">
        <button
          type="button"
          className="button secondary"
          onClick={() => goToPage(pageIndex - 1)}
          disabled={pageIndex === 0}
        >
          ← Previous
        </button>

        <input
          className="page-input"
          type="number"
          min="1"
          max={totalPages}
          value={pageIndex + 1}
          aria-label="Page number"
          onChange={(event) => {
            const value = Number(event.target.value);

            if (Number.isFinite(value) && value >= 1) {
              goToPage(value - 1);
            }
          }}
        />

        <button
          type="button"
          className="button secondary"
          onClick={() => goToPage(pageIndex + 1)}
          disabled={pageIndex >= totalPages - 1}
        >
          Next →
        </button>
      </div>

      <aside className="reader-notes-panel">
        <div className="reader-notes-heading">
          <div>
            <p className="eyebrow">Reading Journal</p>
            <h2>Notes on this page</h2>
          </div>

          {notesForCurrentPage.length > 0 && (
            <span className="note-count">
              {notesForCurrentPage.length}
            </span>
          )}
        </div>

        {notesForCurrentPage.length > 0 ? (
          <div className="reader-page-notes">
            {notesForCurrentPage.map((entry) => {
              const isEditing =
                editingEntryId === entry.id;

              const visibility =
                entry.visibility || "private";

              return (
                <article
                  key={entry.id}
                  className="reader-page-note"
                >
                  <div className="reader-page-note-meta">
                    <span>
                      ¶
                      {entry.paragraphNumber ||
                        Number(entry.paragraphIndex) + 1}
                    </span>

                    {entry.createdAt && (
                      <small>
                        {formatNoteDate(entry.createdAt)}
                        {entry.updatedAtISO ? " · Edited" : ""}
                      </small>
                    )}
                  </div>

                  <div className="journal-entry-meta-row">
                    <span
                      className={`journal-visibility-badge ${visibility}`}
                    >
                      <VisibilityIcon visibility={visibility} />
                      {getVisibilityLabel(visibility)}
                    </span>
                  </div>

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

                            setEditVisibility(nextVisibility);

                            if (nextVisibility !== "group") {
                              setEditGroupId("");
                            }
                          }}
                        >
                          <option value="private">Private</option>
                          <option value="public">Public</option>
                          <option value="group">Group</option>
                        </select>
                      </label>

                      {editVisibility === "group" && (
                        <label className="journal-edit-field">
                          <span>Group ID</span>

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
                          onClick={() =>
                            handleUpdateEntry(entry)
                          }
                          disabled={
                            savingEntry ||
                            !editNote.trim()
                          }
                        >
                          <Check size={16} />
                          {savingEntry
                            ? "Saving..."
                            : "Save Changes"}
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
                      <p>{entry.note}</p>

                      {visibility === "group" &&
                        entry.groupId && (
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
                          onClick={() =>
                            handleDeleteEntry(entry)
                          }
                          disabled={
                            deletingEntryId === entry.id
                          }
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
            })}
          </div>
        ) : (
          <p className="muted">
            No notes on this page yet.
          </p>
        )}

        <div className="add-paragraph-note">
          <h3>Add a note</h3>

          {currentParagraphIndexes.length > 0 && (
            <label className="paragraph-select-label">
              Paragraph

              <select
                value={selectedParagraphIndex ?? ""}
                onChange={(event) =>
                  setSelectedParagraphIndex(
                    Number(event.target.value)
                  )
                }
              >
                {currentParagraphIndexes.map(
                  (paragraphIndex) => (
                    <option
                      key={paragraphIndex}
                      value={paragraphIndex}
                    >
                      Paragraph {paragraphIndex + 1}
                    </option>
                  )
                )}
              </select>
            </label>
          )}

          <textarea
            value={note}
            onChange={(event) =>
              setNote(event.target.value)
            }
            placeholder="Write a thought, question, summary, or reflection..."
          />

          <label className="paragraph-select-label">
            Visibility

            <select
              value={noteVisibility}
              onChange={(event) => {
                const nextVisibility =
                  event.target.value;

                setNoteVisibility(nextVisibility);

                if (nextVisibility !== "group") {
                  setNoteGroupId("");
                }
              }}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="group">Group</option>
            </select>
          </label>

          {noteVisibility === "group" && (
            <label className="paragraph-select-label">
              Group ID

              <input
                type="text"
                value={noteGroupId}
                onChange={(event) =>
                  setNoteGroupId(event.target.value)
                }
                placeholder="Group ID"
              />
            </label>
          )}

          <button
            type="button"
            className="button primary"
            onClick={handleJournal}
            disabled={
              selectedParagraphIndex === null ||
              !note.trim() ||
              (
                noteVisibility === "group" &&
                !noteGroupId.trim()
              )
            }
          >
            <NotebookPen size={18} />
            Save Note
          </button>
        </div>
      </aside>
    </section>
  );
}
