import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import ReaderControls from "../components/ReaderControls.jsx";
import {
  getBookById,
  getStructuredBookText
} from "../services/booksApi.js";

import {
  addJournalEntry,
  getReadingProgress,
  saveBook,
  saveReadingProgress
} from "../services/storage.js";

import { paginateParagraphs } from "../utils/paginateText.js";
import { auth } from "../firebase";

export default function Reader() {
  const { id } = useParams();
  const location = useLocation();
  const readerRef = useRef(null);

  const [book, setBook] = useState(
    location.state?.book || null
  );

  const [paragraphs, setParagraphs] = useState([]);
  const [chapters, setChapters] = useState([]);

  const [fontSize, setFontSize] = useState(18);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [progressLoaded, setProgressLoaded] =
    useState(false);

  const [pageIndex, setPageIndex] = useState(0);
  const [showToc, setShowToc] = useState(false);

  const [readerSize, setReaderSize] = useState({
    width: 0,
    height: 0
  });

  /*
   * Load the selected book and structured text.
   */
  useEffect(() => {
    let active = true;

    async function loadBook() {
      setLoading(true);
      setStatus("");
      setParagraphs([]);
      setChapters([]);
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

        setParagraphs(
          structuredBook.paragraphs || []
        );

        setChapters(
          structuredBook.chapters || []
        );
      } catch (error) {
        console.error(
          "Could not load reader:",
          error
        );

        if (active) {
          setParagraphs([
            `Could not load the reader text. ${
              error?.message || "Unknown error"
            }`
          ]);

          setStatus(
            "The book text could not be loaded."
          );
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

  /*
   * Measure the visible reader area.
   */
  useEffect(() => {
    function updateSize() {
      if (!readerRef.current) return;

      const rect =
        readerRef.current.getBoundingClientRect();

      setReaderSize({
        width: rect.width,
        height: rect.height
      });
    }

    updateSize();

    window.addEventListener(
      "resize",
      updateSize
    );

    window.addEventListener(
      "orientationchange",
      updateSize
    );

    return () => {
      window.removeEventListener(
        "resize",
        updateSize
      );

      window.removeEventListener(
        "orientationchange",
        updateSize
      );
    };
  }, []);

  /*
   * Re-measure whenever the reader itself changes size.
   * This helps on mobile browsers where the viewport can
   * change without a traditional window resize.
   */
  useEffect(() => {
    if (!readerRef.current) return;

    const resizeObserver = new ResizeObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) return;

        setReaderSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    );

    resizeObserver.observe(readerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  /*
   * Generate pages dynamically based on reader size
   * and font size.
   */
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

  const totalPages = Math.max(
    pages.length,
    1
  );

  const currentPage =
    pages[pageIndex]?.blocks || [];

  const progress =
    totalPages > 1
      ? Math.round(
          ((pageIndex + 1) / totalPages) * 100
        )
      : paragraphs.length
        ? 100
        : 0;

  /*
   * Restore reading progress from Firestore after the
   * book has been paginated.
   */
  useEffect(() => {
    if (
      !book?.id ||
      !pages.length ||
      progressLoaded
    ) {
      return;
    }

    let active = true;

    async function restoreProgress() {
      try {
        const saved =
          await getReadingProgress(book.id);

        if (!active) return;

        if (
          saved?.paragraphIndex !== undefined &&
          saved?.paragraphIndex !== null
        ) {
          const restoredPageIndex =
            pages.findIndex(
              (page, index) => {
                const nextPage =
                  pages[index + 1];

                return (
                  saved.paragraphIndex >=
                    page.startIndex &&
                  (!nextPage ||
                    saved.paragraphIndex <
                      nextPage.startIndex)
                );
              }
            );

          setPageIndex(
            restoredPageIndex >= 0
              ? restoredPageIndex
              : 0
          );
        }
      } catch (error) {
        console.error(
          "Could not restore reading progress:",
          error
        );
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
  }, [
    book?.id,
    pages,
    progressLoaded
  ]);

  /*
   * Save reading progress to Firestore whenever the
   * reader moves to another page.
   */
  useEffect(() => {
    if (
      !book?.id ||
      !progressLoaded ||
      !pages[pageIndex]
    ) {
      return;
    }

    /*
     * Reading itself still works while logged out.
     * Only account-backed progress requires login.
     */
    if (!auth.currentUser) {
      return;
    }

    let cancelled = false;

    async function persistProgress() {
      try {
        await saveReadingProgress(
          book.id,
          pages[pageIndex].startIndex
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Could not save reading progress:",
            error
          );
        }
      }
    }

    persistProgress();

    return () => {
      cancelled = true;
    };
  }, [
    book?.id,
    pageIndex,
    pages,
    progressLoaded
  ]);

  /*
   * Prevent pageIndex from pointing past the end
   * if font size or viewport changes pagination.
   */
  useEffect(() => {
    if (pageIndex > totalPages - 1) {
      setPageIndex(
        Math.max(totalPages - 1, 0)
      );
    }
  }, [
    totalPages,
    pageIndex
  ]);

  function goToPage(newPageIndex) {
    const safePageIndex = Math.min(
      Math.max(newPageIndex, 0),
      totalPages - 1
    );

    setPageIndex(safePageIndex);
  }

  function goToChapter(paragraphIndex) {
    const targetPageIndex =
      pages.findIndex(
        (page, index) => {
          const nextPage =
            pages[index + 1];

          return (
            paragraphIndex >=
              page.startIndex &&
            (!nextPage ||
              paragraphIndex <
                nextPage.startIndex)
          );
        }
      );

    setShowToc(false);

    goToPage(
      targetPageIndex >= 0
        ? targetPageIndex
        : 0
    );
  }

  async function handleSave() {
    if (!book) return;

    setStatus("");

    if (!auth.currentUser) {
      setStatus(
        "Log in to save this book to your account."
      );
      return;
    }

    try {
      await saveBook(book);

      setStatus(
        "Book saved to your account."
      );
    } catch (error) {
      console.error(
        "Could not save book:",
        error
      );

      setStatus(
        "We couldn't save this book. Please try again."
      );
    }
  }

  async function handleJournal() {
    if (!book || !note.trim()) {
      return;
    }

    setStatus("");

    if (!auth.currentUser) {
      setStatus(
        "Log in to save journal entries."
      );
      return;
    }

    try {
      await addJournalEntry({
        bookId: book.id,
        title: book.title,
        author: book.author,
        note: note.trim()
      });

      setNote("");

      setStatus(
        "Journal note saved to your account."
      );
    } catch (error) {
      console.error(
        "Could not save journal entry:",
        error
      );

      setStatus(
        "We couldn't save your journal entry. Please try again."
      );
    }
  }

  return (
    <section className="reader-page">

      <div className="reader-topbar">
        <div>
          <Link
            to="/read/search"
            className="back-link"
          >
            ← Back to search
          </Link>

          <h1>
            {book?.title || "Reader"}
          </h1>

          {book?.author && (
            <p className="muted">
              {book.author}
            </p>
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
          onClick={() =>
            setShowToc(
              (value) => !value
            )
          }
          disabled={!chapters.length}
        >
          {showToc
            ? "Hide contents"
            : "Table of contents"}
        </button>

      </div>

      {status && (
        <p className="status">
          {status}
        </p>
      )}

      {showToc && (
        <aside className="journal-box">
          <h2>
            Table of contents
          </h2>

          <div className="toc-list">
            {chapters.map(
              (chapter, index) => (
                <button
                  key={`${chapter.title}-${chapter.paragraphIndex}-${index}`}
                  type="button"
                  className="toc-link"
                  onClick={() =>
                    goToChapter(
                      chapter.paragraphIndex
                    )
                  }
                >
                  {chapter.title}
                </button>
              )
            )}
          </div>
        </aside>
      )}

      <div className="reader-progress">
        <span>
          Page {pageIndex + 1} of{" "}
          {totalPages}
        </span>

        <span>
          {progress}%
        </span>
      </div>

      <article
        ref={readerRef}
        className="reader-window"
        style={{
          fontSize: `${fontSize}px`
        }}
      >
        {loading ? (
          <p>
            Loading reader...
          </p>
        ) : currentPage.length ? (
          currentPage.map(
            (paragraph, index) => (
              <p
                key={`${paragraph.slice(
                  0,
                  20
                )}-${index}`}
              >
                {paragraph}
              </p>
            )
          )
        ) : (
          <p>
            No readable text is available
            for this page.
          </p>
        )}
      </article>

      <div className="reader-nav">

        <button
          type="button"
          className="button secondary"
          onClick={() =>
            goToPage(pageIndex - 1)
          }
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
            const value = Number(
              event.target.value
            );

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
          onClick={() =>
            goToPage(pageIndex + 1)
          }
          disabled={
            pageIndex >=
            totalPages - 1
          }
        >
          Next →
        </button>

      </div>

      <aside className="journal-box">
        <h2>
          Reading note
        </h2>

        <textarea
          value={note}
          onChange={(event) =>
            setNote(event.target.value)
          }
          placeholder="Write a quick thought, summary, or favorite line..."
        />

        <button
          type="button"
          className="button primary"
          onClick={handleJournal}
        >
          Save Note
        </button>
      </aside>

    </section>
  );
}
