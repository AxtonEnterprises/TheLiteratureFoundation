import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  List,
  Moon,
  Sun,
  Globe2,
  Lock,
  NotebookPen,
  Pencil,
  Trash2,
  Users,
  X
} from "lucide-react";

import ReaderControls from "../components/ReaderControls.jsx";
import { getBookById, getStructuredBookText } from "../services/booksApi.js";
import {
  addJournalEntry,
  clearReadingPresence,
  deleteJournalEntry,
  getJournalForBook,
  getMyGroups,
  getReadingProgress,
  saveBook,
  saveReadingProgress,
  updateJournalEntry,
  updateReadingPresence
} from "../services/storage.js";
import { paginateParagraphs } from "../utils/paginateText.js";
import { auth } from "../firebase";
import SEO from "../components/SEO.jsx";
import { syncClassReadingProgress } from "../services/classStorage.js";

function formatNoteDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const readerRef = useRef(null);

  const readingAnchorRef = useRef(0);
  const lastPaginationKeyRef = useRef("");
  const swipeStartRef = useRef(null);
  const suppressCanvasClickRef = useRef(false);

  const requestedParagraph = useMemo(() => {
    const raw = searchParams.get("paragraph");
    if (raw === null || raw === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.max(Math.floor(parsed), 0) : null;
  }, [searchParams]);

  const [book, setBook] = useState(location.state?.book || null);
  const [paragraphs, setParagraphs] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [myGroups, setMyGroups] = useState([]);

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
  const [readerTheme, setReaderTheme] = useState(() => {
    try {
      return window.localStorage.getItem("litChainReaderTheme") || "light";
    } catch {
      return "light";
    }
  });
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showPageNotes, setShowPageNotes] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [readerSize, setReaderSize] = useState({ width: 0, height: 0 });

  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editNote, setEditNote] = useState("");
  const [editVisibility, setEditVisibility] = useState("private");
  const [editGroupId, setEditGroupId] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState(null);

  useEffect(() => {
    document.body.classList.add("reader-mode");
    return () => document.body.classList.remove("reader-mode");
  }, []);

  useEffect(() => {
    document.body.classList.toggle("reader-dark-mode", readerTheme === "dark");
    try {
      window.localStorage.setItem("litChainReaderTheme", readerTheme);
    } catch {
      // Reader theme persistence is optional.
    }

    return () => {
      document.body.classList.remove("reader-dark-mode");
    };
  }, [readerTheme]);

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

        // An explicit Chain/assignment link always wins over saved progress.
        if (requestedParagraph !== null) {
          anchor = Math.min(
            requestedParagraph,
            Math.max(loadedParagraphs.length - 1, 0)
          );
        } else if (
          progressResult.status === "fulfilled" &&
          progressResult.value?.paragraphIndex !== undefined &&
          progressResult.value?.paragraphIndex !== null
        ) {
          anchor = Math.min(
            Math.max(Number(progressResult.value.paragraphIndex) || 0, 0),
            Math.max(loadedParagraphs.length - 1, 0)
          );
        }

        readingAnchorRef.current = anchor;
        setSavedParagraphAnchor(anchor);
        setTextLoaded(true);
      } catch (error) {
        console.error("Could not load reader:", error);
        if (!active) return;
        setParagraphs([`Could not load the reader text. ${error?.message || "Unknown error"}`]);
        setTextLoaded(true);
        setProgressLoaded(true);
        setLoading(false);
        setStatus("The book text could not be loaded.");
      }
    }

    loadBook();
    return () => { active = false; };
  }, [id, location.state, requestedParagraph]);

  useEffect(() => {
    if (!showAddNote && !showPageNotes) return;
    if (myGroups.length) return;

    let active = true;
    getMyGroups()
      .then((groups) => {
        if (active) setMyGroups(groups);
      })
      .catch((error) => {
        console.error("Could not load reader groups:", error);
        if (active) setMyGroups([]);
      });

    return () => { active = false; };
  }, [showAddNote, showPageNotes, myGroups.length]);

  useEffect(() => {
    if (!book?.id || !progressLoaded) return;
    let active = true;

    async function loadJournal() {
      try {
        setJournalLoading(true);
        const notes = await getJournalForBook(book.id);
        if (active) setJournalEntries(notes);
      } catch (error) {
        console.error("Could not load journal:", error);
      } finally {
        if (active) setJournalLoading(false);
      }
    }

    loadJournal();
    return () => { active = false; };
  }, [book?.id, progressLoaded]);

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

  useEffect(() => {
    if (!textLoaded || !pages.length || progressLoaded) return;

    const restoredPageIndex = pages.findIndex((page) =>
      page.blocks.some((block) => block.paragraphIndex === savedParagraphAnchor)
    );

    setPageIndex(restoredPageIndex >= 0 ? restoredPageIndex : 0);
    readingAnchorRef.current = savedParagraphAnchor;
    lastPaginationKeyRef.current = [
      readerSize.width,
      readerSize.height,
      fontSize,
      pages.length
    ].join(":");
    setProgressLoaded(true);
    setLoading(false);
  }, [
    textLoaded,
    pages,
    progressLoaded,
    savedParagraphAnchor,
    readerSize.width,
    readerSize.height,
    fontSize
  ]);

  useEffect(() => {
    if (!progressLoaded || !pages.length) return;

    const paginationKey = [
      readerSize.width,
      readerSize.height,
      fontSize,
      pages.length
    ].join(":");

    if (paginationKey === lastPaginationKeyRef.current) return;
    lastPaginationKeyRef.current = paginationKey;

    const anchor = readingAnchorRef.current;
    const anchoredPageIndex = pages.findIndex((page) =>
      page.blocks.some((block) => block.paragraphIndex === anchor)
    );

    if (anchoredPageIndex >= 0) setPageIndex(anchoredPageIndex);
  }, [pages, progressLoaded, readerSize.width, readerSize.height, fontSize]);

  const currentPage = pages[pageIndex]?.blocks || [];

  const currentParagraphIndexes = useMemo(
    () => [...new Set(currentPage.map((block) => block.paragraphIndex))],
    [currentPage]
  );

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
    if (!book?.id || !progressLoaded || !pages[pageIndex]) return;

    const paragraphIndex =
      pages[pageIndex].startParagraphIndex;

    const visibleParagraphIndex = Math.max(
      paragraphIndex,
      ...pages[pageIndex].blocks.map(
        (block) => Number(block.paragraphIndex) || 0
      )
    );

    saveReadingProgress(
      book,
      paragraphIndex,
      paragraphs.length,
      progress
    ).catch((error) => {
      if (auth.currentUser) {
        console.error(
          "Could not save reading progress:",
          error
        );
      }
    });

    /*
     * Class progress uses the furthest paragraph actually visible
     * on this page. classStorage keeps that value monotonic and
     * writes it only to classes that assigned this specific book.
     */
    if (auth.currentUser && myGroups.length) {
      syncClassReadingProgress({
        groups: myGroups,
        book,
        paragraphIndex: visibleParagraphIndex,
        totalParagraphs: paragraphs.length,
        percentComplete: progress
      }).catch((error) => {
        console.error(
          "Could not sync class reading progress:",
          error
        );
      });
    }

    readingAnchorRef.current = paragraphIndex;
  }, [
    book,
    pageIndex,
    pages,
    paragraphs.length,
    progress,
    progressLoaded,
    myGroups
  ]);

  useEffect(() => {
    if (!book?.id || !progressLoaded || !auth.currentUser) return;

    updateReadingPresence({ book, percentComplete: progress }).catch(() => {});
    const interval = window.setInterval(() => {
      updateReadingPresence({ book, percentComplete: progress }).catch(() => {});
    }, 1000 * 60 * 3);

    return () => window.clearInterval(interval);
  }, [book, progress, progressLoaded]);

  useEffect(() => {
    const bookId = book?.id;
    if (!bookId) return;
    return () => {
      clearReadingPresence(bookId).catch(() => {});
    };
  }, [book?.id]);

  function goToPage(next) {
    const safe = Math.min(Math.max(next, 0), totalPages - 1);
    const target = pages[safe]?.startParagraphIndex;
    if (target !== undefined) readingAnchorRef.current = target;
    setPageIndex(safe);
  }

  function goToParagraph(paragraphIndex) {
    const target = Number(paragraphIndex);
    const targetPage = pages.findIndex((page) =>
      page.blocks.some((block) => block.paragraphIndex === target)
    );
    if (targetPage >= 0) {
      readingAnchorRef.current = target;
      setPageIndex(targetPage);
    }
  }

  async function handleSave() {
    if (!book || !auth.currentUser) {
      setStatus("Log in to save this book to your account.");
      return;
    }

    try {
      await saveBook(book);
      setStatus("Book saved to your account.");
    } catch (error) {
      setStatus("We couldn't save this book.");
    }
  }

  async function handleJournal() {
    const targetParagraphIndex = selectedParagraphIndex;
    if (!book || !note.trim() || targetParagraphIndex === null) return;

    if (noteVisibility === "group" && !noteGroupId) {
      setStatus("Choose a group for this note.");
      return;
    }

    if (!auth.currentUser) {
      setStatus("Log in to save journal entries.");
      return;
    }

    try {
      const entry = await addJournalEntry({
        bookId: book.id,
        title: book.title,
        author: book.author,
        paragraphIndex: targetParagraphIndex,
        paragraphNumber: targetParagraphIndex + 1,
        paragraphPreview: (paragraphs[targetParagraphIndex] || "").slice(0, 240),
        note: note.trim(),
        visibility: noteVisibility,
        groupId: noteVisibility === "group" ? noteGroupId : null
      });

      setJournalEntries((current) => [entry, ...current]);
      setNote("");
      setNoteVisibility("private");
      setNoteGroupId("");
      setShowAddNote(false);
      setStatus(`Note saved to paragraph ${targetParagraphIndex + 1}.`);
    } catch (error) {
      setStatus("We couldn't save your journal entry.");
    }
  }

  async function saveEdit(entry) {
    try {
      setSavingEntry(true);
      const updates = await updateJournalEntry(entry.id, {
        note: editNote,
        visibility: editVisibility,
        groupId: editVisibility === "group" ? editGroupId : null
      });

      setJournalEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, ...updates } : item
        )
      );
      setEditingEntryId(null);
    } catch (error) {
      setStatus("We couldn't update that note.");
    } finally {
      setSavingEntry(false);
    }
  }

  async function removeEntry(entry) {
    if (!window.confirm("Delete this note?")) return;

    try {
      setDeletingEntryId(entry.id);
      await deleteJournalEntry(entry.id);
      setJournalEntries((current) =>
        current.filter((item) => item.id !== entry.id)
      );
    } finally {
      setDeletingEntryId(null);
    }
  }

  if (!book && !loading) {
    return <main className="page-wrap"><p>Book not found.</p></main>;
  }

  return (
    <main className={`reader-page reader-page-immersive reader-theme-${readerTheme}`}>
      <SEO
        title={`${book?.title || "Reader"} | Lit Chain`}
        description={`Read ${book?.title || "this book"} on Lit Chain.`}
        path={`/read/reader/${id}`}
      />

      <header className={`ereader-topbar ${controlsVisible ? "visible" : "hidden"}`}>
        <button
          type="button"
          className="ereader-icon-button ereader-back-button"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft size={24} />
          <span>Back</span>
        </button>

        <div className="ereader-book-heading">
          <strong>{book?.title || "Loading…"}</strong>
          {book?.author && <small>{book.author}</small>}
        </div>

        <div className="ereader-top-actions">
          <ReaderControls fontSize={fontSize} setFontSize={setFontSize} />
          <button
            type="button"
            className="ereader-icon-button"
            onClick={() =>
              setReaderTheme((current) => current === "dark" ? "light" : "dark")
            }
            aria-label={readerTheme === "dark" ? "Use light mode" : "Use dark mode"}
            title={readerTheme === "dark" ? "Light mode" : "Dark mode"}
          >
            {readerTheme === "dark" ? <Sun size={21} /> : <Moon size={21} />}
          </button>

          <button
            type="button"
            className="ereader-icon-button"
            onClick={() => setShowToc((current) => !current)}
            aria-label="Table of contents"
          >
            <List size={23} />
          </button>
          <button
            type="button"
            className="ereader-icon-button"
            onClick={handleSave}
            aria-label="Save book"
          >
            <Bookmark size={23} />
          </button>
        </div>
      </header>

      {status && controlsVisible && <p className="ereader-status">{status}</p>}

      {showToc && (
        <div className="ereader-sheet-backdrop" onClick={() => setShowToc(false)}>
          <section className="ereader-sheet ereader-toc-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="ereader-sheet-heading">
              <div>
                <small>Table of contents</small>
                <h2>{book?.title}</h2>
              </div>
              <button type="button" className="margin-close-button" onClick={() => setShowToc(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="ereader-toc-list">
              {chapters.length ? chapters.map((chapter, index) => (
                <button
                  key={`${chapter.title}-${index}`}
                  type="button"
                  className="toc-link"
                  onClick={() => {
                    goToParagraph(chapter.paragraphIndex);
                    setShowToc(false);
                  }}
                >
                  {chapter.title || `Section ${index + 1}`}
                </button>
              )) : <p className="muted">No chapter list is available for this book.</p>}
            </div>
          </section>
        </div>
      )}

      <section
        ref={readerRef}
        className="reader-window ereader-canvas"
        style={{ fontSize: `${fontSize}px` }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (!touch) return;
          swipeStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now()
          };
        }}
        onTouchEnd={(event) => {
          const start = swipeStartRef.current;
          swipeStartRef.current = null;
          const touch = event.changedTouches[0];
          if (!start || !touch) return;

          const deltaX = touch.clientX - start.x;
          const deltaY = touch.clientY - start.y;
          const elapsed = Date.now() - start.time;

          if (
            Math.abs(deltaX) >= 55 &&
            Math.abs(deltaX) > Math.abs(deltaY) * 1.25 &&
            elapsed < 900
          ) {
            suppressCanvasClickRef.current = true;
            if (deltaX < 0) {
              goToPage(pageIndex + 1);
            } else {
              goToPage(pageIndex - 1);
            }
            window.setTimeout(() => {
              suppressCanvasClickRef.current = false;
            }, 250);
          }
        }}
        onClick={(event) => {
          if (suppressCanvasClickRef.current) return;
          if (event.target.closest("button")) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          if (x < rect.width * 0.22) {
            goToPage(pageIndex - 1);
            return;
          }
          if (x > rect.width * 0.78) {
            goToPage(pageIndex + 1);
            return;
          }
          setControlsVisible((current) => !current);
        }}
      >
        {loading ? (
          <div className="ereader-loading">
            <strong>{book?.title || "Opening book…"}</strong>
            <span>Preparing your place…</span>
          </div>
        ) : (
          currentPage.map((block, index) => {
            const paragraphHasNote = journalEntries.some(
              (entry) => Number(entry.paragraphIndex) === block.paragraphIndex
            );
            const isTarget = requestedParagraph === block.paragraphIndex;
            const isSelected = selectedParagraphIndex === block.paragraphIndex;

            return (
              <div
                key={`${block.paragraphIndex}-${index}`}
                className={[
                  "reader-paragraph-row",
                  isTarget ? "reader-paragraph-target" : "",
                  isSelected ? "reader-paragraph-selected" : ""
                ].filter(Boolean).join(" ")}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  setSelectedParagraphIndex(block.paragraphIndex);
                  setShowPageNotes(true);
                  setShowAddNote(true);
                  setControlsVisible(true);
                }}
              >
                <button
                  type="button"
                  className={[
                    "paragraph-number",
                    "ereader-paragraph-number",
                    paragraphHasNote ? "has-note" : ""
                  ].filter(Boolean).join(" ")}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedParagraphIndex(block.paragraphIndex);
                    setShowPageNotes(true);
                    setShowAddNote(false);
                    setControlsVisible(true);
                  }}
                  aria-label={`Notes for paragraph ${block.paragraphIndex + 1}`}
                  title={`Paragraph ${block.paragraphIndex + 1}`}
                >
                  {!block.isContinuation ? block.paragraphIndex + 1 : ""}
                </button>
                <p>{block.text}</p>
              </div>
            );
          })
        )}
      </section>

      <footer className={`ereader-bottombar ${controlsVisible ? "visible" : "hidden"}`}>
        <div className="ereader-progress-meta">
          <span>{loading ? "" : `Page ${pageIndex + 1} of ${totalPages}`}</span>
          <span>{loading ? "" : `${progress}%`}</span>
        </div>

        <input
          className="ereader-progress-slider"
          type="range"
          min="0"
          max={Math.max(totalPages - 1, 0)}
          value={Math.min(pageIndex, Math.max(totalPages - 1, 0))}
          disabled={loading || totalPages <= 1}
          aria-label="Reading position"
          onChange={(event) => goToPage(Number(event.target.value))}
        />

        <div className="ereader-bottom-actions">
          <button
            type="button"
            className="ereader-page-button"
            disabled={pageIndex <= 0}
            onClick={() => goToPage(pageIndex - 1)}
          >
            Previous
          </button>

          <button
            type="button"
            className="ereader-notes-button"
            onClick={() => {
              setSelectedParagraphIndex(
                selectedParagraphIndex ?? currentParagraphIndexes[0] ?? readingAnchorRef.current
              );
              setShowPageNotes(true);
              setControlsVisible(true);
            }}
          >
            <NotebookPen size={19} />
            Notes{notesForCurrentPage.length ? ` ${notesForCurrentPage.length}` : ""}
          </button>

          <button
            type="button"
            className="ereader-page-button"
            disabled={pageIndex >= totalPages - 1}
            onClick={() => goToPage(pageIndex + 1)}
          >
            Next
          </button>
        </div>
      </footer>

      {(showAddNote || showPageNotes) && (
        <div className="ereader-sheet-backdrop ereader-notes-backdrop" onClick={() => { setShowAddNote(false); setShowPageNotes(false); }}>
          <aside className="ereader-sheet ereader-notes-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="ereader-sheet-heading">
              <div>
                <small>Notes</small>
                <h2>
                  {selectedParagraphIndex !== null
                    ? `Paragraph ${selectedParagraphIndex + 1}`
                    : "Paragraph notes"}
                </h2>
              </div>
              <button
                type="button"
                className="margin-close-button"
                onClick={() => { setShowAddNote(false); setShowPageNotes(false); }}
              >
                <X size={18} />
              </button>
            </div>

            {!showAddNote && (
              <>
                {journalLoading && <p className="muted">Loading notes…</p>}
                {!journalLoading && notesForCurrentPage.length === 0 && (
                  <p className="muted">No notes for the visible paragraphs yet.</p>
                )}
                <div className="ereader-note-list">
                  {notesForCurrentPage.map((entry) => (
                    <article key={entry.id} className="ereader-note-card">
                      <div className="public-entry-meta">
                        <span>Paragraph {Number(entry.paragraphIndex) + 1}</span>
                        <span><VisibilityIcon visibility={entry.visibility} /> {getVisibilityLabel(entry.visibility)}</span>
                        <span>{formatNoteDate(entry.createdAtISO || entry.createdAt)}</span>
                      </div>
                      {editingEntryId === entry.id ? (
                        <>
                          <textarea rows={4} value={editNote} onChange={(event) => setEditNote(event.target.value)} />
                          <select value={editVisibility} onChange={(event) => setEditVisibility(event.target.value)}>
                            <option value="private">Private</option>
                            <option value="public">Public</option>
                            <option value="group">Group / Class</option>
                          </select>
                          {editVisibility === "group" && (
                            <select value={editGroupId} onChange={(event) => setEditGroupId(event.target.value)}>
                              <option value="">Choose...</option>
                              {myGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                            </select>
                          )}
                          <div className="button-row">
                            <button className="button primary" disabled={savingEntry} onClick={() => saveEdit(entry)}>{savingEntry ? "Saving..." : "Save"}</button>
                            <button className="button secondary" onClick={() => setEditingEntryId(null)}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p>{entry.note}</p>
                          <div className="button-row">
                            <button className="button secondary" onClick={() => { setEditingEntryId(entry.id); setEditNote(entry.note || ""); setEditVisibility(entry.visibility || "private"); setEditGroupId(entry.groupId || ""); }}>
                              <Pencil size={15} /> Edit
                            </button>
                            <button className="button secondary" disabled={deletingEntryId === entry.id} onClick={() => removeEntry(entry)}>
                              <Trash2 size={15} /> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>
                <div className="ereader-sheet-actions">
                  <button className="button primary" onClick={() => setShowAddNote(true)}>
                    <Pencil size={16} /> Add Note
                  </button>
                  <Link to="/read/journal" className="button secondary">Full Journal</Link>
                </div>
              </>
            )}

            {showAddNote && (
              <div className="add-paragraph-note ereader-add-note">
                <label className="paragraph-select-label">
                  Paragraph
                  <select
                    value={selectedParagraphIndex ?? ""}
                    onChange={(event) => setSelectedParagraphIndex(Number(event.target.value))}
                  >
                    {currentParagraphIndexes.map((paragraphIndex) => (
                      <option key={paragraphIndex} value={paragraphIndex}>Paragraph {paragraphIndex + 1}</option>
                    ))}
                  </select>
                </label>

                {selectedParagraphIndex !== null && (
                  <blockquote className="ereader-paragraph-preview">
                    {(paragraphs[selectedParagraphIndex] || "").slice(0, 320)}
                  </blockquote>
                )}

                <textarea
                  rows={5}
                  maxLength={3000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Write your note…"
                />

                <label className="paragraph-select-label">
                  Visibility
                  <select value={noteVisibility} onChange={(event) => setNoteVisibility(event.target.value)}>
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                    <option value="group">Group / Class</option>
                  </select>
                </label>

                {noteVisibility === "group" && (
                  <label className="paragraph-select-label">
                    Group or class
                    <select value={noteGroupId} onChange={(event) => setNoteGroupId(event.target.value)}>
                      <option value="">Choose...</option>
                      {myGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  </label>
                )}

                <div className="ereader-sheet-actions">
                  <button className="button primary" onClick={handleJournal}>Save Note</button>
                  <button className="button secondary" onClick={() => setShowAddNote(false)}>Cancel</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
