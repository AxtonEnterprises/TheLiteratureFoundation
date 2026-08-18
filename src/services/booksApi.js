const API_BASE =
  "https://gutendex.com/books";

const CACHE_KEY =
  "randomReadsBooks";

const CACHE_TIME_KEY =
  "randomReadsBooksCachedAt";

const CACHE_MAX_AGE =
  1000 * 60 * 60 * 24;

const SEARCH_CACHE_MAX_AGE =
  1000 * 60 * 30;

const SEARCH_CACHE_PREFIX =
  "randomReads.search.";

let memoryBookPool = null;
let bookPoolPromise = null;
let nextRandomBook = null;


/* ============================================================
   FORMAT HELPERS
============================================================ */

export function getReadableTextUrl(
  book
) {
  if (!book?.formats) {
    return null;
  }

  const formats =
    book.formats;

  return (
    formats[
      "text/plain; charset=utf-8"
    ] ||
    formats[
      "text/plain; charset=us-ascii"
    ] ||
    formats["text/plain"] ||
    Object.entries(
      formats
    ).find(
      ([type, url]) =>
        type.startsWith(
          "text/plain"
        ) &&
        typeof url ===
          "string"
    )?.[1] ||
    null
  );
}


export function getHtmlUrl(
  book
) {
  if (!book?.formats) {
    return null;
  }

  const formats =
    book.formats;

  return (
    formats[
      "text/html; charset=utf-8"
    ] ||
    formats["text/html"] ||
    Object.entries(
      formats
    ).find(
      ([type, url]) =>
        type.startsWith(
          "text/html"
        ) &&
        typeof url ===
          "string"
    )?.[1] ||
    null
  );
}


export function getCoverImageUrl(
  book
) {
  if (!book?.formats) {
    return null;
  }

  return (
    book.formats[
      "image/jpeg"
    ] ||
    null
  );
}


/* ============================================================
   AUTHOR NORMALIZATION
============================================================ */

function normalizeAuthorDisplayName(
  name
) {
  if (
    typeof name !==
      "string" ||
    !name.trim()
  ) {
    return "";
  }

  const trimmed =
    name.trim();

  /*
   * Gutendex commonly uses:
   *
   * Shelley, Mary Wollstonecraft
   *
   * Convert that to:
   *
   * Mary Wollstonecraft Shelley
   *
   * If there are multiple commas, preserve the original
   * because the structure may be more complicated.
   */
  const parts =
    trimmed
      .split(",")
      .map(
        (part) =>
          part.trim()
      )
      .filter(Boolean);

  if (
    parts.length === 2
  ) {
    const [
      lastName,
      givenNames
    ] = parts;

    return `${givenNames} ${lastName}`;
  }

  return trimmed;
}


export function getAuthorName(
  book
) {
  if (
    typeof book?.author ===
      "string" &&
    book.author.trim()
  ) {
    return normalizeAuthorDisplayName(
      book.author
    );
  }

  if (
    !book?.authors?.length
  ) {
    return "Unknown author";
  }

  const authorNames =
    book.authors
      .map(
        (author) =>
          normalizeAuthorDisplayName(
            author?.name
          )
      )
      .filter(Boolean);

  if (
    !authorNames.length
  ) {
    return "Unknown author";
  }

  return authorNames.join(", ");
}


/* ============================================================
   LANGUAGE FILTERING
============================================================ */

function isEnglishBook(
  book
) {
  /*
   * Gutendex normally provides a languages array.
   *
   * If language metadata is missing, keep the book rather
   * than accidentally discarding a valid result.
   */
  if (
    !Array.isArray(
      book?.languages
    ) ||
    !book.languages.length
  ) {
    return true;
  }

  return book.languages.includes(
    "en"
  );
}


/* ============================================================
   BOOK NORMALIZATION
============================================================ */

export function normalizeBook(
  book
) {
  if (!book) {
    return null;
  }

  const author =
    getAuthorName(book);

  const cover =
    book.cover ||
    book.image ||
    getCoverImageUrl(
      book
    ) ||
    null;

  const htmlUrl =
    book.htmlUrl ||
    getHtmlUrl(book) ||
    null;

  const textUrl =
    book.textUrl ||
    getReadableTextUrl(
      book
    ) ||
    null;

  return {
    ...book,

    author,

    /*
     * Keep both properties because existing parts of
     * Random Reads currently use both cover and image.
     */
    cover,

    image:
      cover,

    htmlUrl,

    textUrl
  };
}


function normalizeBooks(
  books
) {
  return (
    Array.isArray(
      books
    )
      ? books
      : []
  )
    .map(
      normalizeBook
    )
    .filter(Boolean);
}


/* ============================================================
   SEARCH DEDUPLICATION
============================================================ */

function normalizeTitleForKey(
  title
) {
  return String(
    title || ""
  )
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /&/g,
      " and "
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


function normalizeAuthorForKey(
  author
) {
  return String(
    author ||
    "unknown author"
  )
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/*
 * Gutenberg often has several records for the same work
 * with slightly different subtitles or punctuation.
 *
 * This creates a simpler comparison title while leaving
 * the actual displayed title unchanged.
 */
function getPrimaryTitle(
  title
) {
  const normalized =
    normalizeTitleForKey(
      title
    );

  const separators = [
    " or ",
    " a novel ",
    " a tale "
  ];

  for (
    const separator
    of separators
  ) {
    const index =
      normalized.indexOf(
        separator
      );

    if (
      index > 4
    ) {
      return normalized
        .slice(
          0,
          index
        )
        .trim();
    }
  }

  return normalized;
}


function makeBookDedupKey(
  book
) {
  const title =
    getPrimaryTitle(
      book?.title
    );

  const author =
    normalizeAuthorForKey(
      book?.author
    );

  return `${title}::${author}`;
}


/*
 * Prefer the Gutenberg edition most useful to Random Reads.
 *
 * Highest priorities:
 * - usable plain text
 * - cover art
 * - HTML source
 * - useful metadata
 * - download count as a small tie breaker
 */
function getEditionScore(
  book
) {
  let score = 0;

  if (
    book?.textUrl
  ) {
    score += 100;
  }

  if (
    book?.cover ||
    book?.image
  ) {
    score += 50;
  }

  if (
    book?.htmlUrl
  ) {
    score += 20;
  }

  if (
    Array.isArray(
      book?.subjects
    )
  ) {
    score += Math.min(
      book.subjects.length,
      10
    );
  }

  const downloadCount =
    Number(
      book?.download_count
    );

  if (
    Number.isFinite(
      downloadCount
    )
  ) {
    score += Math.min(
      downloadCount /
        100000,
      10
    );
  }

  return score;
}


function chooseBetterEdition(
  current,
  candidate
) {
  if (!current) {
    return candidate;
  }

  if (!candidate) {
    return current;
  }

  const currentScore =
    getEditionScore(
      current
    );

  const candidateScore =
    getEditionScore(
      candidate
    );

  if (
    candidateScore >
    currentScore
  ) {
    return candidate;
  }

  return current;
}


function deduplicateBooks(
  books
) {
  const groups =
    new Map();

  for (
    const book
    of books
  ) {
    if (
      !book?.title
    ) {
      continue;
    }

    const key =
      makeBookDedupKey(
        book
      );

    const safeKey =
      key === "::"
        ? `id:${book.id}`
        : key;

    const existing =
      groups.get(
        safeKey
      );

    groups.set(
      safeKey,
      chooseBetterEdition(
        existing,
        book
      )
    );
  }

  return [
    ...groups.values()
  ];
}


/* ============================================================
   STANDARD BOOK PIPELINE
============================================================ */

function prepareBooks(
  books
) {
  const normalized =
    normalizeBooks(
      books
    );

  const englishBooks =
    normalized.filter(
      isEnglishBook
    );

  return deduplicateBooks(
    englishBooks
  );
}


/* ============================================================
   GUTENDEX REQUESTS
============================================================ */

async function fetchBooksFromGutendex() {
  const response =
    await fetch(
      `${API_BASE}/?topic=fiction`
    );

  if (!response.ok) {
    throw new Error(
      "Could not load books"
    );
  }

  const data =
    await response.json();

  return prepareBooks(
    data.results
  );
}


/* ============================================================
   CACHE
============================================================ */

export async function getCachedBooks() {
  if (memoryBookPool?.length) {
    return memoryBookPool;
  }

  if (bookPoolPromise) {
    return bookPoolPromise;
  }

  bookPoolPromise =
    (async () => {
      const cachedBooks =
        localStorage.getItem(
          CACHE_KEY
        );

      const cachedAt =
        localStorage.getItem(
          CACHE_TIME_KEY
        );

      const cacheIsFresh =
        cachedBooks &&
        cachedAt &&
        Date.now() -
          Number(cachedAt) <
          CACHE_MAX_AGE;

      if (cacheIsFresh) {
        try {
          const parsed =
            JSON.parse(
              cachedBooks
            );

          const prepared =
            prepareBooks(
              parsed
            );

          memoryBookPool =
            prepared;

          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify(
              prepared
            )
          );

          return prepared;
        } catch {
          localStorage.removeItem(
            CACHE_KEY
          );

          localStorage.removeItem(
            CACHE_TIME_KEY
          );
        }
      }

      const books =
        await fetchBooksFromGutendex();

      memoryBookPool =
        books;

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify(
          books
        )
      );

      localStorage.setItem(
        CACHE_TIME_KEY,
        String(
          Date.now()
        )
      );

      return books;
    })();

  try {
    return await bookPoolPromise;
  } finally {
    bookPoolPromise =
      null;
  }
}

  const cachedAt =
    localStorage.getItem(
      CACHE_TIME_KEY
    );

  const cacheIsFresh =
    cachedBooks &&
    cachedAt &&
    Date.now() -
      Number(cachedAt) <
      CACHE_MAX_AGE;

  if (
    cacheIsFresh
  ) {
    try {
      const parsed =
        JSON.parse(
          cachedBooks
        );

      /*
       * Re-run the entire preparation pipeline against
       * existing cached records.
       *
       * This means users automatically receive:
       * - normalized authors
       * - English filtering
       * - deduplication
       * - normalized cover/image fields
       */
      const prepared =
        prepareBooks(
          parsed
        );

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify(
          prepared
        )
      );

      return prepared;
    } catch {
      localStorage.removeItem(
        CACHE_KEY
      );

      localStorage.removeItem(
        CACHE_TIME_KEY
      );
    }
  }

  const books =
    await fetchBooksFromGutendex();

  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify(
      books
    )
  );

  localStorage.setItem(
    CACHE_TIME_KEY,
    String(
      Date.now()
    )
  );

  return books;
}


/* ============================================================
   RANDOM BOOK
============================================================ */

function chooseRandomBook(
  books,
  excludeId = null
) {
  if (!books.length) {
    return null;
  }

  const candidates =
    books.length > 1 &&
    excludeId !== null
      ? books.filter(
          (book) =>
            String(book.id) !==
            String(excludeId)
        )
      : books;

  return candidates[
    Math.floor(
      Math.random() *
        candidates.length
    )
  ];
}


export async function preloadRandomBook() {
  const books =
    await getCachedBooks();

  if (!books.length) {
    return null;
  }

  if (!nextRandomBook) {
    nextRandomBook =
      chooseRandomBook(
        books
      );
  }

  return nextRandomBook;
}


export async function getRandomBook() {
  const books =
    await getCachedBooks();

  if (!books.length) {
    throw new Error(
      "No books found"
    );
  }

  if (!nextRandomBook) {
    nextRandomBook =
      chooseRandomBook(
        books
      );
  }

  const selectedBook =
    nextRandomBook;

  /*
   * Prepare the NEXT click immediately.
   */
  nextRandomBook =
    chooseRandomBook(
      books,
      selectedBook?.id
    );

  return selectedBook;
}


/* ============================================================
   SEARCH
============================================================ */

function normalizeSearchQuery(
  searchQuery
) {
  return String(
    searchQuery || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}


function getSearchCacheKey(
  searchQuery
) {
  return (
    SEARCH_CACHE_PREFIX +
    encodeURIComponent(
      normalizeSearchQuery(
        searchQuery
      )
    )
  );
}


function readSearchCache(
  searchQuery
) {
  const normalizedQuery =
    normalizeSearchQuery(
      searchQuery
    );

  if (!normalizedQuery) {
    return null;
  }

  const key =
    getSearchCacheKey(
      normalizedQuery
    );

  try {
    const raw =
      localStorage.getItem(
        key
      );

    if (!raw) {
      return null;
    }

    const cached =
      JSON.parse(raw);

    if (
      !cached?.createdAt ||
      Date.now() -
        cached.createdAt >
        SEARCH_CACHE_MAX_AGE
    ) {
      localStorage.removeItem(
        key
      );

      return null;
    }

    return prepareBooks(
      cached.books
    );
  } catch {
    localStorage.removeItem(
      key
    );

    return null;
  }
}


function saveSearchCache(
  searchQuery,
  books
) {
  const normalizedQuery =
    normalizeSearchQuery(
      searchQuery
    );

  if (!normalizedQuery) {
    return;
  }

  try {
    localStorage.setItem(
      getSearchCacheKey(
        normalizedQuery
      ),
      JSON.stringify({
        createdAt:
          Date.now(),

        books
      })
    );
  } catch {
    /*
     * A full localStorage cache should never
     * prevent search itself from working.
     */
  }
}


export async function searchBooks(
  searchQuery = ""
) {
  const normalizedQuery =
    normalizeSearchQuery(
      searchQuery
    );

  if (normalizedQuery) {
    const cached =
      readSearchCache(
        normalizedQuery
      );

    if (cached) {
      return cached;
    }
  }

  const url =
    normalizedQuery
      ? `${API_BASE}/?search=${encodeURIComponent(
          normalizedQuery
        )}`
      : API_BASE;

  const response =
    await fetch(
      url
    );

  if (!response.ok) {
    throw new Error(
      "Search failed"
    );
  }

  const data =
    await response.json();

  const books =
    prepareBooks(
      data.results
    );

  if (normalizedQuery) {
    saveSearchCache(
      normalizedQuery,
      books
    );
  }

  return books;
}


export async function prefetchSearchBooks(
  searchQuery
) {
  const normalizedQuery =
    normalizeSearchQuery(
      searchQuery
    );

  if (
    normalizedQuery.length <
    3
  ) {
    return;
  }

  try {
    await searchBooks(
      normalizedQuery
    );
  } catch {
    /*
     * Background prefetch failures are silent.
     * Normal Search still reports errors.
     */
  }
}


/* ============================================================
   INDIVIDUAL BOOK
============================================================ */

export async function getBookById(
  bookId
) {
  const response =
    await fetch(
      `${API_BASE}/${bookId}`
    );

  if (!response.ok) {
    throw new Error(
      "Could not load book"
    );
  }

  const book =
    await response.json();

  /*
   * Do not reject an individual book based on language here.
   *
   * If someone already has a direct Gutenberg ID or saved
   * record, the Reader should still be able to open it.
   * Language filtering belongs to discovery/search.
   */
  return normalizeBook(
    book
  );
}


/* ============================================================
   READER TEXT
============================================================ */

export async function getReadableText(
  book
) {
  if (!book?.id) {
    throw new Error(
      "Missing book ID."
    );
  }

  const proxyUrl =
    `/api/book-text?id=${encodeURIComponent(
      book.id
    )}`;

  const response =
    await fetch(
      proxyUrl
    );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `Could not load book text: ${errorText}`
    );
  }

  const text =
    await response.text();

  if (
    !text ||
    text.trim().length <
      100
  ) {
    throw new Error(
      "Book text was empty or too short."
    );
  }

  return text;
}


export async function getStructuredBookText(
  book
) {
  if (!book?.id) {
    throw new Error(
      "Missing book ID."
    );
  }

  const response =
    await fetch(
      `/api/book?id=${encodeURIComponent(
        book.id
      )}`
    );

  if (!response.ok) {
    const error =
      await response
        .json()
        .catch(
          () => null
        );

    throw new Error(
      error?.error ||
      "Could not load structured book text."
    );
  }

  return response.json();
}
