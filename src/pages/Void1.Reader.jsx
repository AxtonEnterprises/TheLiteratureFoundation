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
  NotebookPen
} from "lucide-react";

import ReaderControls from "../components/ReaderControls.jsx";

import {
  getBookById,
  getStructuredBookText
} from "../services/booksApi.js";

import {
  addJournalEntry,
  getJournalForBook,
  getReadingProgress,
  saveBook,
  saveReadingProgress
} from "../services/storage.js";

import {
  paginateParagraphs
} from "../utils/paginateText.js";

import { auth } from "../firebase";
import SEO from "../components/SEO.jsx";

function formatNoteDate(value) {
  if (!value) {
    return "";
  }

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

export default function Reader() {
  const { id } = useParams();
  const location = useLocation();
  const readerRef = useRef(null);

  const [book, setBook] = useState(
    location.state?.book || null
  );

  const [paragraphs, setParagraphs] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState(null);
  const [fontSize, setFontSize] = useState(18);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [readerSize, setReaderSize] = useState({
    width: 0,
    height: 0
  });

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
        const loadedBook =
          book || (await getBookById(id));

        if (!active) return;

        setBook(loadedBook);

        const structuredBook =
          await getStructuredBookText(loadedBook);

        if (!active) return;

        setParagraphs(structuredBook.paragraphs || []);
        setChapters(structuredBook.chapters || []);

        if (auth.currentUser) {
          const notes = await getJournalForBook(loadedBook.id);

          if (active) {
            setJournalEntries(notes);
          }
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

    if (!auth.currentUser) {
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
        if (!cancelled) {
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
        note: note.trim()
      });

      setJournalEntries((current) => [
        journalEntry,
        ...current
      ]);

      setNote("");

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

      {status && (
        <p className="status">{status}</p>
      )}

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

            if (
              Number.isFinite(value) &&
              value >= 1
            ) {
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
            {notesForCurrentPage.map((entry) => (
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
                    </small>
                  )}
                </div>

                <p>{entry.note}</p>
              </article>
            ))}
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
            onChange={(event) => setNote(event.target.value)}
            placeholder="Write a thought, question, summary, or reflection..."
          />

          <button
            type="button"
            className="button primary"
            onClick={handleJournal}
            disabled={
              selectedParagraphIndex === null ||
              !note.trim()
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
