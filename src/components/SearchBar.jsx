import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 300;

export default function SearchBar({ onSearch, initialValue = '' }) {
  const [query, setQuery] = useState(initialValue);
  const firstRenderRef = useRef(true);
  const timeoutRef = useRef(null);
  const onSearchRef = useRef(onSearch);

  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return undefined;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return undefined;
    }

    timeoutRef.current = window.setTimeout(() => {
      onSearchRef.current(trimmedQuery);
      timeoutRef.current = null;
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [query]);

  function handleSubmit(event) {
    event.preventDefault();

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    onSearchRef.current(query);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <Search size={20} />

      <input
        type="search"
        placeholder="Search title, author, or subject"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <button type="submit">Search</button>
    </form>
  );
}
