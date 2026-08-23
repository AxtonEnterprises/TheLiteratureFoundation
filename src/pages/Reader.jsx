import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Check, ChevronDown, ChevronUp, Globe2, Lock, NotebookPen,
  Pencil, Trash2, Users, X
} from "lucide-react";

import ReaderControls from "../components/ReaderControls.jsx";
import { getBookById, getStructuredBookText } from "../services/booksApi.js";
import {
  addJournalEntry, clearReadingPresence, deleteJournalEntry,
  getJournalForBook, getMyGroups, getReadingProgress, saveBook, saveReadingProgress,
  updateJournalEntry, updateReadingPresence
} from "../services/storage.js";
import { paginateParagraphs } from "../utils/paginateText.js";
import { auth } from "../firebase";
import SEO from "../components/SEO.jsx";

function formatNoteDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  });
}

function getVisibilityLabel(visibility) {
  if (visibility === "public") return "Public";
  if (visibility === "group") return "Group";
  return "Private";
}

function VisibilityIcon({ visibility }) {
  if (visibility === "public") return <Globe2 size={14} />;
  if (visibility === "group") return <Users size={14} />;
  return <Lock size={14} />;
}

export default function Reader() {
  const { id } = useParams();
  const location = useLocation();
  const readerRef = useRef(null);

  // Paragraph position is the durable reading anchor. Page number is only display.
  const readingAnchorRef = useRef(0);
  const lastPaginationKeyRef = useRef("");

  const [book, setBook] = useState(location.state?.book || null);
  const [paragraphs, setParagraphs] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [myGroups, setMyGroups] = useState([]);

  // This changes only when the user explicitly chooses a paragraph.
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState(null);

  const [fontSize, setFontSize] = useState(18);
  const [note, setNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState("private");
  const [noteGroupId, setNoteGroupId] = useState("");
  const [status, setStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [textLoaded, setTextLoaded] = useState(false);
  const [savedParagraphAnchor, setSavedParagraphAnchor] = useState(0);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const [showToc, setShowToc] = useState(false);
  const [showPageNotes, setShowPageNotes] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [readerSize, setReaderSize] = useState({ width: 0, height: 0 });

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState("private");
  const [editGroupId, setEditGroupId] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  // Load text and saved position together. Journal data does not block the reader.
  useEffect(() => {
    let active = true;

    async function loadBook() {
      setLoading(true);
      setTextLoaded(false);
      setProgressLoaded(false);
      setStatus("");
      setParagraphs([]);
      setChapters([]);
      setJournalEntries([]);
      setPageIndex(0);
      setSavedParagraphAnchor(0);
      setSelectedParagraphIndex(null);
      setShowPageNotes(false);
      setShowAddNote(false);
      readingAnchorRef.current = 0;
      lastPaginationKeyRef.current = "";

      try {
        const loadedBook = location.state?.book || await getBookById(id);
        if (!active) return;
        setBook(loadedBook);

        const [structuredResult, progressResult] = await Promise.allSettled([
          getStructuredBookText(loadedBook),
          getReadingProgress(loadedBook.id)
        ]);
        if (!active) return;

        if (structuredResult.status !== "fulfilled") {
          throw structuredResult.reason;
        }

        const structuredBook = structuredResult.value;
        const loadedParagraphs = structuredBook.paragraphs || [];
        setParagraphs(loadedParagraphs);
        setChapters(structuredBook.chapters || []);

        let anchor = 0;
        if (
          progressResult.status === "fulfilled" &&
          progressResult.value?.paragraphIndex !== undefined &&
          progressResult.value?.paragraphIndex !== null
        ) {
          anchor = Math.min(
            Math.max(Number(progressResult.value.paragraphIndex) || 0, 0),
            Math.max(loadedParagraphs.length - 1, 0)
          );
        } else if (progressResult.status === "rejected") {
          console.error("Could not restore reading progress:", progressResult.reason);
        }

        readingAnchorRef.current = anchor;
        setSavedParagraphAnchor(anchor);
        setTextLoaded(true);
      } catch (error) {
        console.error("Could not load reader:", error);
        if (!active) return;

        setParagraphs([
          `Could not load the reader text. ${error?.message || "Unknown error"}`
        ]);
        setSavedParagraphAnchor(0);
        readingAnchorRef.current = 0;
        setTextLoaded(true);
        setProgressLoaded(true);
        setLoading(false);
        setStatus("The book text could not be loaded.");
      }
    }

    loadBook();
    return () => { active = false; };
  }, [id, location.state]);

  useEffect(() => {
    let active = true;

    async function loadMyGroups() {
      try {
        const groups =
          await getMyGroups();

        if (active) {
          setMyGroups(groups);
        }
      } catch (error) {
        if (active) {
          console.error(
            "Could not load reader groups:",
            error
          );

          setMyGroups([]);
        }
      }
    }

    loadMyGroups();

    return () => {
      active = false;
    };
  }, []);


  // Notes load independently after the book identity is known.
  useEffect(() => {
    if (!book?.id) return;
    let active = true;

    async function loadJournal() {
      try {
        setJournalLoading(true);
        const notes = await getJournalForBook(book.id);
        if (active) setJournalEntries(notes);
      } catch (error) {
        if (active) console.error("Could not load journal:", error);
      } finally {
        if (active) setJournalLoading(false);
      }
    }

    loadJournal();
    return () => { active = false; };
  }, [book?.id]);

  useEffect(() => {
    function updateSize() {
      if (!readerRef.current) return;
      const rect = readerRef.current.getBoundingClientRect();
      setReaderSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height)
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

    let frameId = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        setReaderSize((current) => {
          if (current.width === width && current.height === height) return current;
          return { width, height };
        });
      });
    });

    observer.observe(readerRef.current);
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  const pages = useMemo(() => {
    if (!paragraphs.length || !readerSize.width || !readerSize.height) return [];
    return paginateParagraphs({
      paragraphs,
      containerWidth: readerSize.width,
      containerHeight: readerSize.height,
      fontSize,
      className: "reader-window"
    });
  }, [paragraphs, readerSize.width, readerSize.height, fontSize]);

  const totalPages = Math.max(pages.length, 1);

  // Restore before exposing the finished page, eliminating page-1-then-jump behavior.
  useEffect(() => {
    if (!textLoaded || !pages.length || progressLoaded) return;

    const restoredPageIndex = pages.findIndex((page) =>
      page.blocks.some((block) => block.paragraphIndex === savedParagraphAnchor)
    );

    setPageIndex(restoredPageIndex >= 0 ? restoredPageIndex : 0);
    readingAnchorRef.current = savedParagraphAnchor;
    lastPaginationKeyRef.current = [
      readerSize.width, readerSize.height, fontSize, pages.length
    ].join(":");
    setProgressLoaded(true);
    setLoading(false);
  }, [
    textLoaded, pages, progressLoaded, savedParagraphAnchor,
    readerSize.width, readerSize.height, fontSize
  ]);

  // Repagination preserves paragraph position rather than old page number.
  useEffect(() => {
    if (!progressLoaded || !pages.length) return;

    const paginationKey = [
      readerSize.width, readerSize.height, fontSize, pages.length
    ].join(":");

    if (paginationKey === lastPaginationKeyRef.current) return;
    lastPaginationKeyRef.current = paginationKey;

    const anchor = readingAnchorRef.current;
    const anchoredPageIndex = pages.findIndex((page) =>
      page.blocks.some((block) => block.paragraphIndex === anchor)
    );

    if (anchoredPageIndex >= 0) setPageIndex(anchoredPageIndex);
  }, [
    pages, progressLoaded, readerSize.width, readerSize.height, fontSize
  ]);

  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(Math.max(totalPages - 1, 0));
    }
  }, [totalPages, pageIndex]);

  const currentPage = pages[pageIndex]?.blocks || [];

  const currentParagraphIndexes = useMemo(() => [
    ...new Set(currentPage.map((block) => block.paragraphIndex))
  ], [currentPage]);

  const groupsById = useMemo(
    () =>
      new Map(
        myGroups.map((group) => [
          String(group.id),
          group
        ])
      ),
    [myGroups]
  );

  const notesForCurrentPage = useMemo(() => {
    const currentSet = new Set(currentParagraphIndexes);
    return journalEntries.filter((entry) =>
      entry.paragraphIndex !== undefined &&
      entry.paragraphIndex !== null &&
      currentSet.has(Number(entry.paragraphIndex))
    );
  }, [journalEntries, currentParagraphIndexes]);

  const progress =
    totalPages > 1
      ? Math.round(((pageIndex + 1) / totalPages) * 100)
      : paragraphs.length ? 100 : 0;

  useEffect(() => {
    if (!book?.id || !progressLoaded || !pages[pageIndex]) return;
    let cancelled = false;

    async function persistProgress() {
      try {
        const paragraphIndex = pages[pageIndex].startParagraphIndex;
        readingAnchorRef.current = paragraphIndex;
        await saveReadingProgress(
          book, paragraphIndex, paragraphs.length, progress
        );
      } catch (error) {
        if (!cancelled && auth.currentUser) {
          console.error("Could not save reading progress:", error);
        }
      }
    }

    persistProgress();
    return () => { cancelled = true; };
  }, [book, pageIndex, pages, paragraphs.length, progress, progressLoaded]);

  useEffect(() => {
    if (!book?.id || !progressLoaded || !auth.currentUser) return;
    let active = true;

    async function heartbeat() {
      try {
        await updateReadingPresence({ book, percentComplete: progress });
      } catch (error) {
        if (active && auth.currentUser) {
          console.error("Could not update reading presence:", error);
        }
      }
    }

    heartbeat();
    const interval = window.setInterval(heartbeat, 1000 * 60 * 3);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [book, progress, progressLoaded]);

  useEffect(() => {
    const bookId = book?.id;
    if (!bookId) return;

    return () => {
      clearReadingPresence(bookId).catch((error) => {
        if (auth.currentUser) {
          console.error("Could not clear reading presence:", error);
        }
      });
    };
  }, [book?.id]);

  function setExplicitNoteTarget(paragraphIndex) {
    const value = Number(paragraphIndex);
    if (!Number.isFinite(value)) return;
    setSelectedParagraphIndex(value);
    setShowAddNote(true);
  }

  function toggleAddNote() {
    setShowAddNote((current) => {
      const next = !current;
      if (
        next &&
        selectedParagraphIndex === null &&
        currentParagraphIndexes.length
      ) {
        setSelectedParagraphIndex(currentParagraphIndexes[0]);
      }
      return next;
    });
  }

  function goToPage(newPageIndex) {
    const safe = Math.min(Math.max(newPageIndex, 0), totalPages - 1);
    const targetParagraph = pages[safe]?.startParagraphIndex;
    if (targetParagraph !== undefined && targetParagraph !== null) {
      readingAnchorRef.current = targetParagraph;
    }
    setPageIndex(safe);
  }

  function goToChapter(paragraphIndex) {
    const targetPageIndex = pages.findIndex((page) =>
      page.blocks.some((block) => block.paragraphIndex === paragraphIndex)
    );
    readingAnchorRef.current = paragraphIndex;
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
    // Lock target before any async work so it cannot drift while saving.
    const targetParagraphIndex = selectedParagraphIndex;

    if (!book || !note.trim() || targetParagraphIndex === null) return;

    if (noteVisibility === "group" && !noteGroupId.trim()) {
      setStatus("Choose a group for this note.");
      return;
    }

    setStatus("");

    if (!auth.currentUser) {
      setStatus("Log in to save journal entries.");
      return;
    }

    try {
      const paragraphText = paragraphs[targetParagraphIndex] || "";
      const journalEntry = await addJournalEntry({
        bookId: book.id,
        title: book.title,
        author: book.author,
        paragraphIndex: targetParagraphIndex,
        paragraphNumber: targetParagraphIndex + 1,
        paragraphPreview: paragraphText.slice(0, 240),
        note: note.trim(),
        visibility: noteVisibility,
        groupId: noteVisibility === "group" ? noteGroupId.trim() : null
      });

      setJournalEntries((current) => [journalEntry, ...current]);
      setNote("");
      setNoteVisibility("private");
      setNoteGroupId("");
      setStatus(`Note saved to paragraph ${targetParagraphIndex + 1}.`);
    } catch (error) {
      console.error("Could not save journal entry:", error);
      setStatus("We couldn't save your journal entry. Please try again.");
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

      setJournalEntries((current) =>
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
      setJournalEntries((current) =>
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

  const selectedParagraphPreview =
    selectedParagraphIndex !== null
      ? paragraphs[selectedParagraphIndex] || ""
      : "";

  return (
    <section className="reader-page">
      <SEO
        title={book ? `${book.title} | Random Reads` : "Read Classic Literature | Random Reads"}
        description={
          book
            ? `Read ${book.title}${book.author ? ` by ${book.author}` : ""} free online with Random Reads from The Literature Foundation.`
            : "Read classic public-domain literature free online with Random Reads."
        }
        path={`/read/reader/${id}`}
        image={book?.image || "https://theliteraturefoundation.org/branding/random-reads-icon.svg"}
        type="book"
      />

      <div className="reader-topbar">
        <div>
          <Link to="/read/search" className="back-link">← Back to search</Link>
          <h1>{book?.title || "Reader"}</h1>
          {book?.author && <p className="muted">{book.author}</p>}
        </div>

        <ReaderControls fontSize={fontSize} setFontSize={setFontSize} />
      </div>

      <div className="button-row">
        <button type="button" className="button secondary" onClick={handleSave} disabled={!book}>
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
                onClick={() => goToChapter(chapter.paragraphIndex)}
              >
                {chapter.title}
              </button>
            ))}
          </div>
        </aside>
      )}

      <div className="reader-progress">
        <span>
          {loading
            ? "Preparing your place..."
            : `Page ${pageIndex + 1} of ${totalPages}`}
        </span>
        <span>{loading ? "" : `${progress}%`}</span>
      </div>

      <article
        ref={readerRef}
        className="reader-window"
        style={{ fontSize: `${fontSize}px` }}
      >
        {loading ? (
          <div style={{ minHeight: "55vh", display: "grid", placeItems: "center" }}>
            <p>Preparing reader...</p>
          </div>
        ) : currentPage.length ? (
          currentPage.map((block, index) => {
            const showNumber = !block.isContinuation;
            const paragraphHasNote = journalEntries.some(
              (entry) => Number(entry.paragraphIndex) === block.paragraphIndex
            );

            return (
              <div
                key={`${block.paragraphIndex}-${index}`}
                className="reader-paragraph-row"
              >
                <button
                  type="button"
                  className={paragraphHasNote ? "paragraph-number has-note" : "paragraph-number"}
                  onClick={() => setExplicitNoteTarget(block.paragraphIndex)}
                  aria-label={`Add a note to paragraph ${block.paragraphIndex + 1}`}
                  title={`Add a note to paragraph ${block.paragraphIndex + 1}`}
                >
                  {showNumber ? block.paragraphIndex + 1 : ""}
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
          disabled={loading || pageIndex === 0}
        >
          ← Previous
        </button>

        <input
          className="page-input"
          type="number"
          min="1"
          max={totalPages}
          value={pageIndex + 1}
          disabled={loading}
          aria-label="Page number"
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value >= 1) goToPage(value - 1);
          }}
        />

        <button
          type="button"
          className="button secondary"
          onClick={() => goToPage(pageIndex + 1)}
          disabled={loading || pageIndex >= totalPages - 1}
        >
          Next →
        </button>
      </div>

      <aside className="reader-notes-panel">
        <button
          type="button"
          className="button secondary"
          style={{ width: "100%", justifyContent: "space-between" }}
          onClick={() => setShowPageNotes((current) => !current)}
          aria-expanded={showPageNotes}
        >
          <span>
            Notes on this page
            {notesForCurrentPage.length ? ` (${notesForCurrentPage.length})` : ""}
          </span>
          {showPageNotes ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showPageNotes && (
          <div style={{ marginTop: "1rem" }}>
            <div className="reader-notes-heading">
              <div>
                <p className="eyebrow">Reading Journal</p>
                <h2>Notes on this page</h2>
              </div>
              {notesForCurrentPage.length > 0 && (
                <span className="note-count">{notesForCurrentPage.length}</span>
              )}
            </div>

            {journalLoading ? (
              <p className="muted">Loading notes...</p>
            ) : notesForCurrentPage.length > 0 ? (
              <div className="reader-page-notes">
                {notesForCurrentPage.map((entry) => {
                  const isEditing = editingEntryId === entry.id;
                  const visibility = entry.visibility || "private";

                  return (
                    <article key={entry.id} className="reader-page-note">
                      <div className="reader-page-note-meta">
                        <span>
                          ¶{entry.paragraphNumber || Number(entry.paragraphIndex) + 1}
                        </span>
                        {entry.createdAt && (
                          <small>
                            {formatNoteDate(entry.createdAt)}
                            {entry.updatedAtISO ? " · Edited" : ""}
                          </small>
                        )}
                      </div>

                      <div className="journal-entry-meta-row">
                        <span className={`journal-visibility-badge ${visibility}`}>
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
                              onChange={(event) => setEditNote(event.target.value)}
                              rows={5}
                            />
                          </label>

                          <label className="journal-edit-field">
                            <span>Visibility</span>
                            <select
                              value={editVisibility}
                              onChange={(event) => {
                                const next = event.target.value;
                                setEditVisibility(next);
                                if (next !== "group") setEditGroupId("");
                              }}
                            >
                              <option value="private">Private</option>
                              <option value="public">Public</option>
                              <option value="group">Group</option>
                            </select>
                          </label>

                          {editVisibility === "group" && (
                            <label className="journal-edit-field">
                              <span>Share with</span>

                              <select
                                value={editGroupId}
                                onChange={(event) =>
                                  setEditGroupId(
                                    event.target.value
                                  )
                                }
                              >
                                <option value="">
                                  Choose a group
                                </option>

                                {myGroups.map((group) => (
                                  <option
                                    key={group.id}
                                    value={group.id}
                                  >
                                    {group.name}
                                  </option>
                                ))}
                              </select>
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
                          <p>{entry.note}</p>
                          {visibility === "group" && entry.groupId && (
                            <small className="journal-group-label">
                              Group:{" "}
                              {groupsById.get(
                                String(entry.groupId)
                              )?.name || "Reading group"}
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
                              {deletingEntryId === entry.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No notes on this page yet.</p>
            )}
          </div>
        )}

        <button
          type="button"
          className="button secondary"
          style={{ width: "100%", justifyContent: "space-between", marginTop: "0.75rem" }}
          onClick={toggleAddNote}
          aria-expanded={showAddNote}
        >
          <span>Add a note</span>
          {showAddNote ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showAddNote && (
          <div className="add-paragraph-note" style={{ marginTop: "1rem" }}>
            <h3>Add a note</h3>

            {selectedParagraphIndex !== null ? (
              <div
                style={{
                  padding: "0.85rem 1rem",
                  border: "1px solid var(--line)",
                  borderRadius: "14px",
                  background: "rgba(59, 182, 177, 0.06)",
                  marginBottom: "1rem"
                }}
              >
                <strong>Adding note to ¶{selectedParagraphIndex + 1}</strong>
                {selectedParagraphPreview && (
                  <p className="muted" style={{ margin: "0.45rem 0 0" }}>
                    {selectedParagraphPreview.slice(0, 220)}
                    {selectedParagraphPreview.length > 220 ? "…" : ""}
                  </p>
                )}
              </div>
            ) : (
              <p className="muted">Choose a paragraph number in the reader above.</p>
            )}

            {currentParagraphIndexes.length > 0 && (
              <label className="paragraph-select-label">
                Paragraph
                <select
                  value={selectedParagraphIndex ?? ""}
                  onChange={(event) =>
                    setExplicitNoteTarget(Number(event.target.value))
                  }
                >
                  {selectedParagraphIndex !== null &&
                    !currentParagraphIndexes.includes(selectedParagraphIndex) && (
                    <option value={selectedParagraphIndex}>
                      Paragraph {selectedParagraphIndex + 1} (locked)
                    </option>
                  )}

                  {currentParagraphIndexes.map((paragraphIndex) => (
                    <option key={paragraphIndex} value={paragraphIndex}>
                      Paragraph {paragraphIndex + 1}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Write a thought, question, summary, or reflection..."
            />

            <label className="paragraph-select-label">
              Visibility
              <select
                value={noteVisibility}
                onChange={(event) => {
                  const next = event.target.value;
                  setNoteVisibility(next);
                  if (next !== "group") setNoteGroupId("");
                }}
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
                <option value="group">Group</option>
              </select>
            </label>

            {noteVisibility === "group" && (
              <label className="paragraph-select-label">
                Share with
                <select
                  value={noteGroupId}
                  onChange={(event) =>
                    setNoteGroupId(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Choose a group
                  </option>

                  {myGroups.map((group) => (
                    <option
                      key={group.id}
                      value={group.id}
                    >
                      {group.name}
                    </option>
                  ))}
                </select>

                {myGroups.length === 0 && (
                  <small className="muted">
                    Join or create a group from your profile first.
                  </small>
                )}
              </label>
            )}

            <button
              type="button"
              className="button primary"
              onClick={handleJournal}
              disabled={
                selectedParagraphIndex === null ||
                !note.trim() ||
                (noteVisibility === "group" && !noteGroupId.trim())
              }
            >
              <NotebookPen size={18} />
              Save Note
            </button>
          </div>
        )}
      </aside>
    </section>
  );
}
