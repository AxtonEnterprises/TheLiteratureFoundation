const API_BASE = 'https://gutendex.com/books';
const CACHE_KEY = 'randomReadsBooks';
const CACHE_TIME_KEY = 'randomReadsBooksCachedAt';
const CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

const SEARCH_CACHE_KEY = 'litChainSearchCache';
const SEARCH_CACHE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;
const SEARCH_CACHE_LIMIT = 40;

async function fetchBooksFromGutendex() {
  const response = await fetch(`${API_BASE}/?topic=fiction`);

  if (!response.ok) {
    throw new Error('Could not load books');
  }

  const data = await response.json();
  return data.results || [];
}

export async function getCachedBooks() {
  const cachedBooks = localStorage.getItem(CACHE_KEY);
  const cachedAt = localStorage.getItem(CACHE_TIME_KEY);

  const cacheIsFresh =
    cachedBooks &&
    cachedAt &&
    Date.now() - Number(cachedAt) < CACHE_MAX_AGE;

  if (cacheIsFresh) {
    try {
      return JSON.parse(cachedBooks);
    } catch {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIME_KEY);
    }
  }

  const books = await fetchBooksFromGutendex();

  localStorage.setItem(CACHE_KEY, JSON.stringify(books));
  localStorage.setItem(CACHE_TIME_KEY, String(Date.now()));

  return books;
}

export async function getRandomBook() {
  const books = await getCachedBooks();

  if (!books.length) {
    throw new Error('No books found');
  }

  return books[Math.floor(Math.random() * books.length)];
}

function normalizeSearchText(value = '') {
  return String(value)
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getBookAuthorText(book) {
  return (book?.authors || [])
    .map((author) => author?.name || '')
    .filter(Boolean)
    .join(' ');
}

function rankBook(book, normalizedQuery) {
  const title = normalizeSearchText(book?.title);
  const author = normalizeSearchText(getBookAuthorText(book));

  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  if (title.includes(normalizedQuery)) return 2;
  if (author === normalizedQuery) return 3;
  if (author.startsWith(normalizedQuery)) return 4;
  if (author.includes(normalizedQuery)) return 5;
  return 6;
}

function rankBooks(books, query) {
  const normalizedQuery = normalizeSearchText(query);

  return [...books].sort((a, b) => {
    const rankDifference =
      rankBook(a, normalizedQuery) - rankBook(b, normalizedQuery);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    return (b.download_count || 0) - (a.download_count || 0);
  });
}

function readSearchCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || '{}');
    return cached && typeof cached === 'object' ? cached : {};
  } catch {
    localStorage.removeItem(SEARCH_CACHE_KEY);
    return {};
  }
}

function getCachedSearch(query) {
  const key = normalizeSearchText(query);
  const cache = readSearchCache();
  const entry = cache[key];

  if (
    !entry ||
    Date.now() - Number(entry.cachedAt || 0) > SEARCH_CACHE_MAX_AGE
  ) {
    return null;
  }

  return Array.isArray(entry.books) ? entry.books : null;
}

function cacheSearch(query, books) {
  try {
    const key = normalizeSearchText(query);
    const cache = readSearchCache();

    cache[key] = {
      cachedAt: Date.now(),
      books,
    };

    const trimmedEntries = Object.entries(cache)
      .sort(
        ([, a], [, b]) =>
          Number(b.cachedAt || 0) - Number(a.cachedAt || 0)
      )
      .slice(0, SEARCH_CACHE_LIMIT);

    localStorage.setItem(
      SEARCH_CACHE_KEY,
      JSON.stringify(Object.fromEntries(trimmedEntries))
    );
  } catch {
    // Search still works if localStorage is unavailable or full.
  }
}

export function splitSearchResults(books, query) {
  const normalizedQuery = normalizeSearchText(query);
  const ranked = rankBooks(books, query);

  const titleMatches = [];
  const authorMatches = [];
  const otherMatches = [];

  for (const book of ranked) {
    const title = normalizeSearchText(book?.title);
    const author = normalizeSearchText(getBookAuthorText(book));

    if (title.includes(normalizedQuery)) {
      titleMatches.push(book);
    } else if (author.includes(normalizedQuery)) {
      authorMatches.push(book);
    } else {
      otherMatches.push(book);
    }
  }

  return {
    titleMatches,
    authorMatches,
    otherMatches,
  };
}

export async function searchBooks(query = '') {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const cached = getCachedSearch(trimmedQuery);

  if (cached) {
    return rankBooks(cached, trimmedQuery);
  }

  const response = await fetch(
    `${API_BASE}/?search=${encodeURIComponent(trimmedQuery)}`
  );

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const data = await response.json();
  const books = data.results || [];

  cacheSearch(trimmedQuery, books);

  return rankBooks(books, trimmedQuery);
}

export async function getBookById(bookId) {
  const response = await fetch(`${API_BASE}/${bookId}`);

  if (!response.ok) {
    throw new Error('Could not load book');
  }

  return response.json();
}

export function getReadableTextUrl(book) {
  if (!book?.formats) {
    return null;
  }

  const formats = book.formats;

  return (
    formats['text/plain; charset=utf-8'] ||
    formats['text/plain; charset=us-ascii'] ||
    formats['text/plain'] ||
    Object.entries(formats).find(([type, url]) => {
      return type.startsWith('text/plain') && typeof url === 'string';
    })?.[1] ||
    null
  );
}

export function getHtmlUrl(book) {
  if (!book?.formats) {
    return null;
  }

  const formats = book.formats;

  return (
    formats['text/html; charset=utf-8'] ||
    formats['text/html'] ||
    Object.entries(formats).find(([type, url]) => {
      return type.startsWith('text/html') && typeof url === 'string';
    })?.[1] ||
    null
  );
}

export function getCoverImageUrl(book) {
  if (!book?.formats) {
    return null;
  }

  return book.formats['image/jpeg'] || null;
}

export function getAuthorName(book) {
  if (!book?.authors?.length) {
    return 'Unknown author';
  }

  return book.authors
    .map((author) => author.name)
    .filter(Boolean)
    .join(', ');
}

export async function getReadableText(book) {
  if (!book?.id) {
    throw new Error('Missing book ID.');
  }

  const proxyUrl = `/api/book-text?id=${encodeURIComponent(book.id)}`;
  const response = await fetch(proxyUrl);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Could not load book text: ${errorText}`);
  }

  const text = await response.text();

  if (!text || text.trim().length < 100) {
    throw new Error('Book text was empty or too short.');
  }

  return text;
}

export async function getStructuredBookText(book) {
  if (!book?.id) {
    throw new Error('Missing book ID.');
  }

  const response = await fetch(
    `/api/book?id=${encodeURIComponent(book.id)}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      error?.error || 'Could not load structured book text.'
    );
  }

  return response.json();
}
