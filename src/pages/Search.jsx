import { useState } from 'react';
import BookCard from '../components/BookCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import { searchBooks } from '../services/booksApi.js';
import { saveBook } from '../services/storage.js';
import { auth } from "../firebase";
import SEO from "../components/SEO.jsx";

export default function Search() {
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('Search for a book, author, or subject.');

  async function handleSearch(query) {
    if (!query.trim()) {
      setStatus('Enter a search term first.');
      return;
    }

    setStatus('Searching...');
    try {
      const books = await searchBooks(query);
      setResults(books);
      setStatus(books.length ? `${books.length} result${books.length === 1 ? '' : 's'} found.` : 'No books found.');
    } catch {
      setStatus('Search failed. Check your connection and try again.');
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
      <div className="section-heading">
        <p className="eyebrow">Library search</p>
        <h1>Search public domain books</h1>
      </div>
      <SearchBar onSearch={handleSearch} />
      <p className="status">{status}</p>
      <div className="results-list">
        {results.map((book) => <BookCard key={book.id} book={book} onSave={handleSave} compact />)}
      </div>
      <SEO
  title="Search Classic Literature | Random Reads"
  description="Search public-domain books by title, author, or subject and read classic literature free with Random Reads."
  path="/read/search"
  image="https://theliteraturefoundation.org/branding/random-reads-icon.svg"
/>
    </section>
  );
}
