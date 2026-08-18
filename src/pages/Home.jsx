import { auth } from "../firebase";
import {
  onAuthStateChanged
} from "firebase/auth";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Download,
  ExternalLink,
  Search,
  Shuffle
} from "lucide-react";

import BookCard from "../components/BookCard.jsx";
import { getRandomBook } from "../services/booksApi.js";
import {
  getReadingTimeline,
  saveBook
} from "../services/storage.js";
import SEO from "../components/SEO.jsx";

const SPONSORED_BOOKS = [
  {
    id: 1342,
    title: "Pride and Prejudice",
    author: "Jane Austen",
    sponsor: "The Literature Foundation",
    image:
      "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg"
  },
  {
    id: 84,
    title: "Frankenstein",
    author: "Mary Shelley",
    sponsor: "The Literature Foundation",
    image:
      "https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg"
  },
  {
    id: 2701,
    title: "Moby Dick",
    author: "Herman Melville",
    sponsor: "The Literature Foundation",
    image:
      "https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg"
  }
];

const INSTALL_HANDLED_KEY =
  "randomReads.installPromptHandled";

function isRunningStandalone() {
  return (
    window.matchMedia?.(
      "(display-mode: standalone)"
    )?.matches ||
    window.navigator.standalone === true
  );
}

export default function Home() {
  const [book, setBook] = useState(null);
  const [status, setStatus] = useState("");
  const [
  continueReading,
  setContinueReading
] = useState([]);
  

    useEffect(() => {
  let active = true;

  const unsubscribe =
    onAuthStateChanged(
      auth,
      async (
        firebaseUser
      ) => {
        if (
          !firebaseUser
        ) {
          if (active) {
            setContinueReading(
              []
            );
          }

          return;
        }

        try {
          const timeline =
            await getReadingTimeline();

          if (!active) {
            return;
          }

          /*
           * Only unfinished books belong in
           * Continue Reading.
           */
          const unfinished =
            timeline.filter(
              (item) =>
                Number(
                  item.percentComplete
                ) < 100
            );

          setContinueReading(
            unfinished.slice(
              0,
              3
            )
          );
        } catch (error) {
          console.error(
            "Could not load continue reading:",
            error
          );
        }
      }
    );

  return () => {
    active = false;
    unsubscribe();
  };
}, []);
        
  loadContinueReading();

  return () => {
    active = false;
  };
}, []);

  const [installPrompt, setInstallPrompt] =
    useState(null);

  const [showInstallCard, setShowInstallCard] =
    useState(false);

  const [sponsoredIndex, setSponsoredIndex] =
    useState(0);

  const sponsoredBook =
    SPONSORED_BOOKS[sponsoredIndex];

  useEffect(() => {
    if (
      isRunningStandalone() ||
      localStorage.getItem(
        INSTALL_HANDLED_KEY
      ) === "true"
    ) {
      setShowInstallCard(false);
      return;
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();

      setInstallPrompt(event);
      setShowInstallCard(true);
    }

    function handleAppInstalled() {
      localStorage.setItem(
        INSTALL_HANDLED_KEY,
        "true"
      );

      setInstallPrompt(null);
      setShowInstallCard(false);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSponsoredIndex((currentIndex) => {
        return (
          (currentIndex + 1) %
          SPONSORED_BOOKS.length
        );
      });
    }, 7000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  async function handleRandomBook() {
    try {
      setStatus("Finding a book...");

      const nextBook =
        await getRandomBook();

      setBook(nextBook);
      setStatus("");
    } catch (error) {
      console.error(
        "Random book error:",
        error
      );

      setStatus(
        "We couldn't find a book right now. Please try again."
      );
    }
  }

  async function handleSave(selectedBook) {
    try {
      await saveBook(selectedBook);

      setStatus(
        "Book saved to your account."
      );
    } catch (error) {
      console.error(
        "Save book error:",
        error
      );

      if (!auth.currentUser) {
        setStatus(
          "Log in to save books to your account."
        );
      } else {
        setStatus(
          "We couldn't save that book. Please try again."
        );
      }
    }
  }

  async function handleInstall() {
    if (!installPrompt) {
      setShowInstallCard(false);
      return;
    }

    try {
      await installPrompt.prompt();

      await installPrompt.userChoice;

      localStorage.setItem(
        INSTALL_HANDLED_KEY,
        "true"
      );

      setInstallPrompt(null);
      setShowInstallCard(false);
    } catch (error) {
      console.error(
        "Install error:",
        error
      );

      localStorage.setItem(
        INSTALL_HANDLED_KEY,
        "true"
      );

      setInstallPrompt(null);
      setShowInstallCard(false);
    }
  }

  function handleDismissInstall() {
    localStorage.setItem(
      INSTALL_HANDLED_KEY,
      "true"
    );

    setInstallPrompt(null);
    setShowInstallCard(false);
  }

  return (
    <main className="page-wrap">
      <SEO
        title="Random Reads | Free Classic Literature"
        description="Discover public-domain books at random, search classic literature, save your progress, and read free with Random Reads."
        path="/read"
        image="https://theliteraturefoundation.org/branding/random-reads-icon.svg"
      />

      <div className="stack-lg">

        <section className="hero-card">
          <p className="eyebrow">
            Classic literature discovery
          </p>

          <h1>
            Find your next public domain read.
          </h1>

          <p>
            Discover a classic at random or search the
            library for your next book.
          </p>

          {continueReading.length > 0 && (
  <section className="panel continue-reading-panel">
    <div className="section-heading-row">
      <div>
        <p className="eyebrow">
          Your Reading
        </p>

        <h2>
          Continue Reading
        </h2>
      </div>

      <Link
        to="/read/profile?tab=reading"
        className="button secondary"
      >
        See All
      </Link>
    </div>

    <div className="continue-reading-list">
      {continueReading.map(
        (item) => {
          const percent =
            Math.min(
              Math.max(
                Number(
                  item.percentComplete
                ) || 0,
                0
              ),
              100
            );

          return (
            <article
              key={
                item.bookId ||
                item.id
              }
              className="continue-reading-item"
            >
              <Link
                to={`/read/reader/${item.bookId}`}
                className="continue-reading-title"
              >
                {item.title ||
                  "Untitled"}
              </Link>

              <p className="continue-reading-author">
                {item.author ||
                  "Unknown author"}
              </p>

              <div className="continue-reading-progress">
                <div className="reading-progress-track">
                  <div
                    className="reading-progress-fill"
                    style={{
                      width:
                        `${percent}%`
                    }}
                  />
                </div>

                <strong>
                  {percent}%
                </strong>
              </div>
            </article>
          );
        }
      )}
    </div>
  </section>
)}

          <div className="button-row">
            <button
              type="button"
              className="button primary large"
              onClick={handleRandomBook}
            >
              <Shuffle size={20} />
              Random Book
            </button>

            <Link
              to="/read/search"
              className="button secondary large"
            >
              <Search size={20} />
              Search Library
            </Link>
          </div>

          {status && (
            <p className="status">
              {status}
            </p>
          )}
        </section>

        {book && (
          <BookCard
            book={book}
            onSave={() =>
              handleSave(book)
            }
          />
        )}

        <section className="sponsored-banner">
          <div className="sponsored-label">
            Sponsored Book
          </div>

          <Link
            to={`/read/reader/${sponsoredBook.id}`}
            className="sponsored-book-link"
          >
            <div className="sponsored-cover">
              <img
                src={sponsoredBook.image}
                alt={`Cover of ${sponsoredBook.title}`}
              />
            </div>

            <div className="sponsored-content">
              <p className="eyebrow">
                Featured Reading
              </p>

              <h2>
                {sponsoredBook.title}
              </h2>

              <p className="sponsored-author">
                {sponsoredBook.author}
              </p>

              <span className="sponsored-read-link">
                <BookOpen size={18} />
                Read Now
              </span>

              <small>
                Sponsored by:{" "}
                {sponsoredBook.sponsor}
              </small>
            </div>
          </Link>

          <div className="sponsored-dots">
            {SPONSORED_BOOKS.map(
              (sponsored, index) => (
                <button
                  key={sponsored.id}
                  type="button"
                  className={
                    index === sponsoredIndex
                      ? "sponsored-dot active"
                      : "sponsored-dot"
                  }
                  onClick={() =>
                    setSponsoredIndex(index)
                  }
                  aria-label={
                    `Show ${sponsored.title}`
                  }
                />
              )
            )}
          </div>
        </section>

        {showInstallCard && (
          <section className="install-card">
            <div>
              <p className="eyebrow">
                Random Reads App
              </p>

              <h2>
                Add Random Reads to your
                home screen
              </h2>

              <p className="muted">
                Install Random Reads for quick
                access from your phone, tablet,
                or computer.
              </p>
            </div>

            <div className="button-row">
              <button
                type="button"
                className="button primary large"
                onClick={handleInstall}
              >
                <Download size={20} />
                Install App
              </button>

              <button
                type="button"
                className="button secondary large"
                onClick={
                  handleDismissInstall
                }
              >
                Not Now
              </button>
            </div>
          </section>
        )}

        <footer className="foundation-footer">
          <p>
            This app is brought to you by{" "}
            <strong>
              The Literature Foundation.
            </strong>
          </p>

          <div className="home-footer-links">
  <Link
    to="/read/about"
    className="foundation-link"
  >
    About Random Reads
  </Link>

  <a
    href="/"
    className="foundation-link"
  >
    Visit The Literature Foundation
    <ExternalLink size={16} />
  </a>
</div>
        </footer>

      </div>
    </main>
  );
}
