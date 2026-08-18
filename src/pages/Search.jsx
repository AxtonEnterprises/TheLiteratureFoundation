import {
  useEffect,
  useState
} from "react";

import BookCard from "../components/BookCard.jsx";
import SearchBar from "../components/SearchBar.jsx";

import {
  prefetchSearchBooks,
  searchBooks
} from "../services/booksApi.js";

import {
  saveBook
} from "../services/storage.js";

import { auth } from "../firebase";

import SEO from "../components/SEO.jsx";


export default function Search() {
  const [
    results,
    setResults
  ] = useState([]);

  const [
    status,
    setStatus
  ] = useState(
    "Search for a book, author, or subject."
  );

  const [
    pendingQuery,
    setPendingQuery
  ] = useState("");


  /*
   * Quietly preload likely search results after the user
   * pauses typing.
   *
   * The visible search still only happens when the user
   * presses Search, but in many cases the result is already
   * cached by then.
   */
  useEffect(() => {
    const query =
      pendingQuery.trim();

    if (
      query.length <
      3
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          prefetchSearchBooks(
            query
          );
        },
        450
      );

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [pendingQuery]);


  async function handleSearch(
    query
  ) {
    const cleanedQuery =
      query.trim();

    if (!cleanedQuery) {
      setStatus(
        "Enter a search term first."
      );

      setResults([]);

      return;
    }

    setStatus(
      "Searching..."
    );

    try {
      const books =
        await searchBooks(
          cleanedQuery
        );

      setResults(
        books
      );

      setStatus(
        books.length
          ? `${books.length} result${
              books.length === 1
                ? ""
                : "s"
            } found.`
          : "No books found."
      );
    } catch (error) {
      console.error(
        "Search failed:",
        error
      );

      setStatus(
        "Search failed. Check your connection and try again."
      );
    }
  }


  async function handleSave(
    book
  ) {
    try {
      setStatus(
        "Saving book..."
      );

      await saveBook(
        book
      );

      setStatus(
        `Saved “${book.title}.”`
      );
    } catch (error) {
      console.error(
        "Could not save book:",
        error
      );

      if (
        !auth.currentUser
      ) {
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


  return (
    <section className="stack-md">
      <SEO
        title="Search Classic Literature | Random Reads"
        description="Search public-domain books by title, author, or subject and read classic literature free with Random Reads."
        path="/read/search"
        image="https://theliteraturefoundation.org/branding/random-reads-icon.svg"
      />

      <div className="section-heading">
        <p className="eyebrow">
          Library search
        </p>

        <h1>
          Search public domain books
        </h1>
      </div>

      <SearchBar
        onSearch={
          handleSearch
        }
        onQueryChange={
          setPendingQuery
        }
      />

      <p className="status">
        {status}
      </p>

      <div className="results-list">
        {results.map(
          (book) => (
            <BookCard
              key={book.id}
              book={book}
              onSave={
                handleSave
              }
              compact
            />
          )
        )}
      </div>
    </section>
  );
}
