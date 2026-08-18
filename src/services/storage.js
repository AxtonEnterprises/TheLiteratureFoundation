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

const LOCAL_SAVED_BOOKS_KEY =
  "randomReads.savedBooks";

const LOCAL_JOURNAL_KEY =
  "randomReads.journal";


/* ============================================================
   AUTH HELPERS
============================================================ */

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
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          unsubscribe();
          resolve(user);
        }
      );
  });
}


async function requireUser() {
  const user =
    await getCurrentUser();

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
 * from Gutendex or other app objects.
 */
function cleanForFirestore(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


/* ============================================================
   SAVED BOOKS
============================================================ */

export async function getSavedBooks() {
  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const booksRef = collection(
    db,
    "users",
    user.uid,
    "savedBooks"
  );

  const snapshot =
    await getDocs(booksRef);

  const books =
    snapshot.docs.map(
      (bookDoc) => {
        const data =
          bookDoc.data();

        return {
          ...data,
          id:
            data.id ??
            bookDoc.id
        };
      }
    );

  books.sort((a, b) => {
    const aDate =
      a.savedAt || "";

    const bDate =
      b.savedAt || "";

    return bDate.localeCompare(
      aDate
    );
  });

  return books;
}


export async function saveBook(book) {
  if (!book?.id) {
    throw new Error(
      "Cannot save a book without an ID."
    );
  }

  const user =
    await requireUser();

  const bookRef = doc(
    db,
    "users",
    user.uid,
    "savedBooks",
    String(book.id)
  );

  const cleanBook =
    cleanForFirestore(book);

  await setDoc(
    bookRef,
    {
      ...cleanBook,

      savedAt:
        new Date().toISOString(),

      updatedAt:
        serverTimestamp()
    },
    {
      merge: true
    }
  );

  return getSavedBooks();
}


export async function removeSavedBook(
  bookId
) {
  const user =
    await requireUser();

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


export async function isBookSaved(
  bookId
) {
  const books =
    await getSavedBooks();

  return books.some(
    (book) =>
      String(book.id) ===
      String(bookId)
  );
}


/* ============================================================
   JOURNAL
============================================================ */

export async function getJournal() {
  const user =
    await getCurrentUser();

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
    orderBy(
      "createdAt",
      "desc"
    )
  );

  const snapshot =
    await getDocs(
      journalQuery
    );

  return snapshot.docs.map(
    (entryDoc) => ({
      id: entryDoc.id,
      ...entryDoc.data()
    })
  );
}

export async function getJournalForBook(
  bookId
) {
  if (
    bookId === undefined ||
    bookId === null
  ) {
    return [];
  }

  const entries =
    await getJournal();

  return entries.filter(
    (entry) =>
      String(
        entry.bookId
      ) ===
      String(bookId)
  );
}
export async function addJournalEntry(
  entry
) {
  const user =
    await requireUser();

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
  const entryRef =
    doc(journalRef);

  const journalEntry = {
    ...cleanForFirestore(
      entry
    ),

    id: entryRef.id,

    createdAt:
      new Date().toISOString(),

    createdAtServer:
      serverTimestamp()
  };

  await setDoc(
    entryRef,
    journalEntry
  );

  return journalEntry;
}


/* ============================================================
   READING PROGRESS
============================================================ */

export async function saveReadingProgress(
  book,
  paragraphIndex,
  totalParagraphs,
  percentComplete
) {
  if (
    !book?.id ||
    paragraphIndex ===
      undefined ||
    paragraphIndex ===
      null
  ) {
    return;
  }

  const user =
    await requireUser();

  const progressRef = doc(
    db,
    "users",
    user.uid,
    "readingProgress",
    String(book.id)
  );

  const now =
    new Date().toISOString();

  const safePercent =
    Math.min(
      Math.max(
        Math.round(
          percentComplete || 0
        ),
        0
      ),
      100
    );

  const progressData = {
    bookId:
      String(book.id),

    title:
      book.title ||
      "Untitled",

    author:
      book.author ||
      "Unknown author",

    image:
      book.image ||
      null,

    paragraphIndex,

    totalParagraphs:
      totalParagraphs ||
      0,

    percentComplete:
      safePercent,

    updatedAt:
      serverTimestamp(),

    updatedAtISO:
      now
  };

  if (
    safePercent >= 100
  ) {
    progressData.completedAt =
      now;
  }

  await setDoc(
    progressRef,
    cleanForFirestore(
      progressData
    ),
    {
      merge: true
    }
  );
}


export async function getReadingProgress(
  bookId
) {
  if (
    bookId === undefined ||
    bookId === null
  ) {
    return null;
  }

  const user =
    await getCurrentUser();

  if (!user) {
    return null;
  }

  /*
   * Import getDoc lazily because this function only
   * needs a single Firestore document.
   */
  const { getDoc } =
    await import(
      "firebase/firestore"
    );

  const progressRef = doc(
    db,
    "users",
    user.uid,
    "readingProgress",
    String(bookId)
  );

  const snapshot =
    await getDoc(progressRef);

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return snapshot.data();
}


export async function getReadingTimeline() {
  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const progressRef =
    collection(
      db,
      "users",
      user.uid,
      "readingProgress"
    );

  const snapshot =
    await getDocs(
      progressRef
    );

  const records =
    snapshot.docs.map(
      (progressDoc) => ({
        id:
          progressDoc.id,

        ...progressDoc.data()
      })
    );

  records.sort(
    (a, b) => {
      const aDate =
        a.updatedAtISO ||
        "";

      const bDate =
        b.updatedAtISO ||
        "";

      return bDate.localeCompare(
        aDate
      );
    }
  );

  return records;
}

/* ============================================================
   USER PROFILE
============================================================ */

export async function getUserProfile() {
  const user =
    await getCurrentUser();

  if (!user) {
    return null;
  }

  const { getDoc } =
    await import(
      "firebase/firestore"
    );

  const profileRef = doc(
    db,
    "users",
    user.uid
  );

  const snapshot =
    await getDoc(profileRef);

  const storedProfile =
    snapshot.exists()
      ? snapshot.data()
      : {};

  return {
    uid: user.uid,

    displayName:
      storedProfile.displayName ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Reader",

    email:
      user.email || "",

    photoURL:
      storedProfile.photoURL ||
      user.photoURL ||
      "",

    about:
      storedProfile.about ||
      ""
  };
}


export async function saveUserProfile({
  displayName,
  photoURL,
  about
}) {
  const user =
    await requireUser();

  const profileRef = doc(
    db,
    "users",
    user.uid
  );

  const profileData = {
    displayName:
      displayName?.trim() ||
      "Reader",

    photoURL:
      photoURL?.trim() ||
      "",

    about:
      about?.trim() ||
      "",

    updatedAt:
      serverTimestamp(),

    updatedAtISO:
      new Date().toISOString()
  };

  await setDoc(
    profileRef,
    cleanForFirestore(
      profileData
    ),
    {
      merge: true
    }
  );

  return {
    uid: user.uid,
    email: user.email || "",
    ...profileData
  };
}

/* ============================================================
   ONE-TIME LOCAL STORAGE MIGRATION
============================================================ */

function readLocalJSON(
  key,
  fallback
) {
  try {
    const raw =
      localStorage.getItem(
        key
      );

    if (!raw) {
      return fallback;
    }

    return JSON.parse(
      raw
    );
  } catch {
    return fallback;
  }
}


export async function migrateLocalDataToFirestore() {
  const user =
    await getCurrentUser();

  if (!user) {
    return {
      migrated: false,
      reason:
        "not-logged-in"
    };
  }

  const migrationKey =
    `randomReads.firestoreMigration.${user.uid}`;

  if (
    localStorage.getItem(
      migrationKey
    )
  ) {
    return {
      migrated: false,
      reason:
        "already-migrated"
    };
  }

  const localBooks =
    readLocalJSON(
      LOCAL_SAVED_BOOKS_KEY,
      []
    );

  const localJournal =
    readLocalJSON(
      LOCAL_JOURNAL_KEY,
      []
    );

  const progressRecords =
    [];

  for (
    let index = 0;
    index <
      localStorage.length;
    index += 1
  ) {
    const key =
      localStorage.key(
        index
      );

    if (
      !key?.startsWith(
        "readingProgress:"
      )
    ) {
      continue;
    }

    try {
      const bookId =
        key.replace(
          "readingProgress:",
          ""
        );

      const rawValue =
        localStorage.getItem(
          key
        );

      const value =
        JSON.parse(
          rawValue
        );

      progressRecords.push({
        key,
        bookId,
        value
      });
    } catch {
      /*
       * Ignore malformed
       * old progress data.
       */
    }
  }

  try {
    /* ========================================================
       SAVED BOOKS MIGRATION
    ======================================================== */

    for (
      const book
      of localBooks
    ) {
      if (!book?.id) {
        continue;
      }

      const bookRef =
        doc(
          db,
          "users",
          user.uid,
          "savedBooks",
          String(
            book.id
          )
        );

      await setDoc(
        bookRef,
        {
          ...cleanForFirestore(
            book
          ),

          savedAt:
            book.savedAt ||
            new Date()
              .toISOString(),

          updatedAt:
            serverTimestamp()
        },
        {
          merge: true
        }
      );
    }


    /* ========================================================
       JOURNAL MIGRATION
    ======================================================== */

    for (
      const entry
      of localJournal
    ) {
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

      const entryRef =
        doc(
          db,
          "users",
          user.uid,
          "journal",
          entryId
        );

      await setDoc(
        entryRef,
        {
          ...cleanForFirestore(
            entry
          ),

          id:
            entryId,

          createdAt:
            entry.createdAt ||
            new Date()
              .toISOString(),

          createdAtServer:
            serverTimestamp()
        },
        {
          merge: true
        }
      );
    }


    /* ========================================================
       READING PROGRESS MIGRATION
    ======================================================== */

    for (
      const record
      of progressRecords
    ) {
      const progressRef =
        doc(
          db,
          "users",
          user.uid,
          "readingProgress",
          String(
            record.bookId
          )
        );

      const oldUpdatedAt =
        record.value
          ?.updatedAt;

      let updatedAtISO =
        new Date()
          .toISOString();

      if (oldUpdatedAt) {
        const parsedDate =
          new Date(
            oldUpdatedAt
          );

        if (
          !Number.isNaN(
            parsedDate.getTime()
          )
        ) {
          updatedAtISO =
            parsedDate
              .toISOString();
        }
      }

      await setDoc(
        progressRef,
        {
          bookId:
            String(
              record.bookId
            ),

          paragraphIndex:
            record.value
              ?.paragraphIndex ??
            0,

          updatedAt:
            serverTimestamp(),

          updatedAtISO
        },
        {
          merge: true
        }
      );
    }


    /* ========================================================
       CLEAN UP OLD LOCAL DATA
    ======================================================== */

    /*
     * Only remove old localStorage data after all
     * Firestore operations above succeed.
     */
    localStorage.removeItem(
      LOCAL_SAVED_BOOKS_KEY
    );

    localStorage.removeItem(
      LOCAL_JOURNAL_KEY
    );

    for (
      const record
      of progressRecords
    ) {
      localStorage.removeItem(
        record.key
      );
    }

    localStorage.setItem(
      migrationKey,
      new Date()
        .toISOString()
    );

    return {
      migrated: true,

      books:
        localBooks.length,

      journalEntries:
        localJournal.length,

      progressRecords:
        progressRecords.length
    };
  } catch (error) {
    console.error(
      "Local data migration failed:",
      error
    );

    /*
     * Deliberately leave old localStorage data untouched
     * if migration fails.
     */
    throw error;
  }
}
