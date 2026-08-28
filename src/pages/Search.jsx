import { useRef, useState } from 'react';
import BookCard from '../components/BookCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import {
  searchBooks,
  splitSearchResults,
} from '../services/booksApi.js';
import { saveBook } from '../services/storage.js';

function mergeUniqueBooks(...groups) {
  const seen = new Set();

  return groups.flat().filter((book) => {
    if (!book?.id || seen.has(book.id)) {
      return false;
    }

    seen.add(book.id);
    return true;
  });
}

export default function Search() {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState(
    'Search for a book, author, or subject.'
  );

  const searchRequestRef = useRef(0);

  async function handleSearch(query) {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      searchRequestRef.current += 1;
      setResults([]);
      setStatus('Enter a search term first.');
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;

    setStatus('Searching titles...');

    try {
      const books = await searchBooks(trimmedQuery);

      if (searchRequestRef.current !== requestId) {
        return;
      }

      const {
        titleMatches,
        authorMatches,
        otherMatches,
      } = splitSearchResults(books, trimmedQuery);

      // Paint title matches first.
      setResults(titleMatches);

      const titleCount = titleMatches.length;
      setStatus(
        titleCount
          ? `${titleCount} title match${titleCount === 1 ? '' : 'es'} found. Checking authors...`
          : 'Checking authors...'
      );

      // Give React/browser a chance to paint title results before
      // merging the author and broader matches.
      requestAnimationFrame(() => {
        if (searchRequestRef.current !== requestId) {
          return;
        }

        const merged = mergeUniqueBooks(
          titleMatches,
          authorMatches,
          otherMatches
        );

        setResults(merged);
        setStatus(
          merged.length
            ? `${merged.length} result${merged.length === 1 ? '' : 's'} found.`
            : 'No books found.'
        );
      });
    } catch {
      if (searchRequestRef.current === requestId) {
        setStatus(
          'Search failed. Check your connection and try again.'
        );
      }
    }
  }

  function handleSave(book) {
    saveBook(book);
    setStatus(`Saved “${book.title}.”`);
  }

  return (
    <section className="stack-md">
      <div className="section-heading">
        <p className="eyebrow">Library search</p>
        <h1>Search public domain books</h1>
      </div>

      <SearchBar onSearch={handleSearch} />

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
