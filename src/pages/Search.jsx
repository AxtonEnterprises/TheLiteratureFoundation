import { useEffect, useState } from "react";

import BookCard from "../components/BookCard.jsx";
import SearchBar from "../components/SearchBar.jsx";
import {
  getCachedBooks,
  prefetchSearchBooks,
  searchBooks
} from "../services/booksApi.js";
import { saveBook } from "../services/storage.js";
import { auth } from "../firebase";
import SEO from "../components/SEO.jsx";

function localMatches(books, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return books.filter((book) => {
    const subjects = Array.isArray(book.subjects) ? book.subjects.join(" ") : "";
    const haystack = [book.title, book.author, subjects]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });
}

function mergeBooks(primary, secondary) {
  const map = new Map();
  [...primary, ...secondary].forEach((book) => {
    if (book?.id !== undefined && book?.id !== null) {
      map.set(String(book.id), book);
    }
  });
  return [...map.values()];
}

export default function Search() {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("Search for a book, author, or subject.");
  const [pendingQuery, setPendingQuery] = useState("");

  useEffect(() => {
    const query = pendingQuery.trim();
    if (query.length < 3) return;

    const timer = window.setTimeout(() => {
      prefetchSearchBooks(query);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pendingQuery]);

  async function handleSearch(query) {
    const cleanedQuery = query.trim();

    if (!cleanedQuery) {
      setStatus("Enter a search term first.");
      setResults([]);
      return;
    }

    setStatus("Searching...");

    let instantResults = [];

    try {
      const cachedPool = await getCachedBooks();
      instantResults = localMatches(cachedPool, cleanedQuery);

      if (instantResults.length) {
        setResults(instantResults);
        setStatus(
          `${instantResults.length} fast result${instantResults.length === 1 ? "" : "s"} found. Checking the full library...`
        );
      }
    } catch (error) {
      console.debug("Local search unavailable:", error);
    }

    try {
      const remoteResults = await searchBooks(cleanedQuery);
      const books = mergeBooks(remoteResults, instantResults);

      setResults(books);
      setStatus(
        books.length
          ? `${books.length} result${books.length === 1 ? "" : "s"} found.`
          : "No books found."
      );
    } catch (error) {
      console.error("Search failed:", error);

      if (!instantResults.length) {
        setStatus("Search failed. Check your connection and try again.");
      } else {
        setStatus(
          `${instantResults.length} cached result${instantResults.length === 1 ? "" : "s"} found. Full-library search is temporarily unavailable.`
        );
      }
    }
  }

  async function handleSave(book) {
    try {
      setStatus("Saving book...");
      await saveBook(book);
      setStatus(`Saved “${book.title}.”`);
    } catch (error) {
      console.error("Could not save book:", error);
      setStatus(
        !auth.currentUser
          ? "Log in to save books to your account."
          : "We couldn't save that book. Please try again."
      );
    }
  }

  return (
    <section className="stack-md">
      <SEO
        title="Search Classic Literature | Random Reads"
        description="Search public-domain books by title, author, or subject and read classic literature free with Random Reads."
        path="/read/search"
        image="https://theliteraturefoundation.org/branding/random-reads-icon.svg"
      />

      <div className="section-heading">
        <p className="eyebrow">Library search</p>
        <h1>Search public domain books</h1>
      </div>

      <SearchBar onSearch={handleSearch} onQueryChange={setPendingQuery} />
      <p className="status">{status}</p>

      <div className="results-list">
        {results.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            onSave={handleSave}
            compact
          />
        ))}
      </div>
    </section>
  );
}
