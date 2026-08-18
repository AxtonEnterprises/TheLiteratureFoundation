const API_BASE = "https://gutendex.com/books";

const CACHE_KEY =
  "randomReadsBooks";

const CACHE_TIME_KEY =
  "randomReadsBooksCachedAt";

const CACHE_MAX_AGE =
  1000 * 60 * 60 * 24;


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
        typeof url === "string"
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
        typeof url === "string"
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


export function getAuthorName(
  book
) {
  /*
   * Already-normalized books can simply
   * return their existing author string.
   */
  if (
    typeof book?.author ===
      "string" &&
    book.author.trim()
  ) {
    return book.author;
  }

  if (
    !book?.authors?.length
  ) {
    return "Unknown author";
  }

  return book.authors
    .map(
      (author) =>
        author.name
    )
    .filter(Boolean)
    .join(", ");
}


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

  return {
    ...book,

    author,

    /*
     * Keep both properties because different
     * parts of Random Reads currently use
     * cover and image.
     */
    cover,

    image:
      cover,

    htmlUrl
  };
}


function normalizeBooks(
  books
) {
  return (
    Array.isArray(books)
      ? books
      : []
  )
    .map(normalizeBook)
    .filter(Boolean);
}


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

  return normalizeBooks(
    data.results
  );
}


export async function getCachedBooks() {
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
      /*
       * Important:
       * normalize old cached Gutendex records too.
       */
      const parsed =
        JSON.parse(
          cachedBooks
        );

      const normalized =
        normalizeBooks(
          parsed
        );

      /*
       * Upgrade the cached data while we're here.
       */
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify(
          normalized
        )
      );

      return normalized;
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
    JSON.stringify(books)
  );

  localStorage.setItem(
    CACHE_TIME_KEY,
    String(Date.now())
  );

  return books;
}


export async function getRandomBook() {
  const books =
    await getCachedBooks();

  if (!books.length) {
    throw new Error(
      "No books found"
    );
  }

  return books[
    Math.floor(
      Math.random() *
        books.length
    )
  ];
}


export async function searchBooks(
  searchQuery = ""
) {
  const url =
    searchQuery
      ? `${API_BASE}/?search=${encodeURIComponent(
          searchQuery
        )}`
      : API_BASE;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Search failed"
    );
  }

  const data =
    await response.json();

  return normalizeBooks(
    data.results
  );
}


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

  return normalizeBook(
    book
  );
}


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
