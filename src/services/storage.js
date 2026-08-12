import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "firebase/firestore";

import {
  onAuthStateChanged
} from "firebase/auth";

import { auth, db } from "../firebase";

const LOCAL_SAVED_BOOKS_KEY = "randomReads.savedBooks";
const LOCAL_JOURNAL_KEY = "randomReads.journal";

/*
 * Wait for Firebase Authentication to finish initializing.
 *
 * auth.currentUser can briefly be null while Firebase restores
 * a previously saved session. Waiting for onAuthStateChanged
 * prevents Firestore calls from running too early.
 */
async function getCurrentUser() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error(
      "You must be logged in to save books, notes, or reading progress."
    );
  }

  return user;
}

/*
 * Firestore does not accept undefined values.
 * This removes any undefined properties that may come
 * from the Gutendex book object.
 */
function cleanForFirestore(value) {
  return JSON.parse(JSON.stringify(value));
}


/* ============================================================
   SAVED BOOKS
============================================================ */

export async function getSavedBooks() {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const booksRef = collection(
    db,
    "users",
    user.uid,
    "savedBooks"
  );

  const snapshot = await getDocs(booksRef);

  const books = snapshot.docs.map((bookDoc) => {
    const data = bookDoc.data();

    return {
      ...data,
      id: data.id ?? bookDoc.id
    };
  });

  books.sort((a, b) => {
    const aDate = a.savedAt || "";
    const bDate = b.savedAt || "";

    return bDate.localeCompare(aDate);
  });

  return books;
}


export async function saveBook(book) {
  if (!book?.id) {
    throw new Error("Cannot save a book without an ID.");
  }

  const user = await requireUser();

  const bookRef = doc(
    db,
    "users",
    user.uid,
    "savedBooks",
    String(book.id)
  );

  const cleanBook = cleanForFirestore(book);

  await setDoc(
    bookRef,
    {
      ...cleanBook,
      savedAt: new Date().toISOString(),
      updatedAt: serverTimestamp()
    },
    {
      merge: true
    }
  );

  return getSavedBooks();
}


export async function removeSavedBook(bookId) {
  const user = await requireUser();

  const bookRef = doc(
    db,
    "users",
    user.uid,
    "savedBooks",
    String(bookId)
  );

  await deleteDoc(bookRef);

  return getSavedBooks();
}


export async function isBookSaved(bookId) {
  const books = await getSavedBooks();

  return books.some(
    (book) => String(book.id) === String(bookId)
  );
}


/* ============================================================
   JOURNAL
============================================================ */

export async function getJournal() {
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  const journalRef = collection(
    db,
    "users",
    user.uid,
    "journal"
  );

  const journalQuery = query(
    journalRef,
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(journalQuery);

  return snapshot.docs.map((entryDoc) => ({
    id: entryDoc.id,
    ...entryDoc.data()
  }));
}


export async function addJournalEntry(entry) {
  const user = await requireUser();

  const journalRef = collection(
    db,
    "users",
    user.uid,
    "journal"
  );

  /*
   * Create a document reference first so we get an ID
   * without needing a separate addDoc call.
   */
  const entryRef = doc(journalRef);

  const journalEntry = {
    ...cleanForFirestore(entry),
    id: entryRef.id,
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp()
  };

  await setDoc(entryRef, journalEntry);

  return journalEntry;
}


/* ============================================================
   READING PROGRESS
============================================================ */

export async function saveReadingProgress(
  bookId,
  paragraphIndex
) {
  if (
    bookId === undefined ||
    bookId === null
  ) {
    return;
  }

  const user = await requireUser();

  const progressRef = doc(
    db,
    "users",
    user.uid,
    "readingProgress",
    String(bookId)
  );

  await setDoc(
    progressRef,
    {
      bookId: String(bookId),
      paragraphIndex,
      updatedAt: serverTimestamp(),
      updatedAtISO: new Date().toISOString()
    },
    {
      merge: true
    }
  );
}


export async function getReadingProgress(bookId) {
  if (
    bookId === undefined ||
    bookId === null
  ) {
    return null;
  }

  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  /*
   * Import getDoc lazily here only because this function
   * requires a single document.
   */
  const { getDoc } = await import("firebase/firestore");

  const progressRef = doc(
    db,
    "users",
    user.uid,
    "readingProgress",
    String(bookId)
  );

  const snapshot = await getDoc(progressRef);

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data();
}


/* ============================================================
   ONE-TIME LOCAL STORAGE MIGRATION
============================================================ */

function readLocalJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}


export async function migrateLocalDataToFirestore() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      migrated: false,
      reason: "not-logged-in"
    };
  }

  const migrationKey =
    `randomReads.firestoreMigration.${user.uid}`;

  if (localStorage.getItem(migrationKey)) {
    return {
      migrated: false,
      reason: "already-migrated"
    };
  }

  const localBooks =
    readLocalJSON(LOCAL_SAVED_BOOKS_KEY, []);

  const localJournal =
    readLocalJSON(LOCAL_JOURNAL_KEY, []);

  const progressRecords = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (!key?.startsWith("readingProgress:")) {
      continue;
    }

    try {
      const bookId = key.replace(
        "readingProgress:",
        ""
      );

      const value = JSON.parse(
        localStorage.getItem(key)
      );

      progressRecords.push({
        key,
        bookId,
        value
      });
    } catch {
      // Ignore malformed old progress data.
    }
  }

  try {
    /*
     * Saved books
     */
    for (const book of localBooks) {
      if (!book?.id) continue;

      const bookRef = doc(
        db,
        "users",
        user.uid,
        "savedBooks",
        String(book.id)
      );

      await setDoc(
        bookRef,
        {
          ...cleanForFirestore(book),
          savedAt:
            book.savedAt ||
            new Date().toISOString(),
          updatedAt: serverTimestamp()
        },
        {
          merge: true
        }
      );
    }

    /*
     * Journal entries
     */
    for (const entry of localJournal) {
      const entryId =
        entry.id ||
        doc(
          collection(
            db,
            "users",
            user.uid,
            "journal"
          )
        ).id;

      const entryRef = doc(
        db,
        "users",
        user.uid,
        "journal",
        entryId
      );

      await setDoc(
        entryRef,
        {
          ...cleanForFirestore(entry),
          id: entryId,
          createdAt:
            entry.createdAt ||
            new Date().toISOString(),
          createdAtServer: serverTimestamp()
        },
        {
          merge: true
        }
      );
    }

    /*
     * Reading progress
     */
    for (const record of progressRecords) {
      const progressRef = doc(
        db,
        "users",
        user.uid,
        "readingProgress",
        String(record.bookId)
      );

      await setDoc(
        progressRef,
        {
          bookId: String(record.bookId),
          paragraphIndex:
            record.value?.paragraphIndex ?? 0,
          updatedAt: serverTimestamp(),
          updatedAtISO:
            record.value?.updatedAt
              ? new Date(
                  record.value.updatedAt
                ).toISOString()
              : new Date().toISOString()
        },
        {
          merge: true
        }
      );
    }

    /*
     * Only remove the old local data after every
     * Firestore operation above succeeds.
     */
    localStorage.removeItem(
      LOCAL_SAVED_BOOKS_KEY
    );

    localStorage.removeItem(
      LOCAL_JOURNAL_KEY
    );

    for (const record of progressRecords) {
      localStorage.removeItem(record.key);
    }

    localStorage.setItem(
      migrationKey,
      new Date().toISOString()
    );

    return {
      migrated: true,
      books: localBooks.length,
      journalEntries: localJournal.length,
      progressRecords: progressRecords.length
    };
  } catch (error) {
    console.error(
      "Local data migration failed:",
      error
    );

    /*
     * We deliberately leave the old localStorage
     * data untouched if migration fails.
     */
    throw error;
  }
}
