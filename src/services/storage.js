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

import {
  auth,
  db
} from "../firebase";

import {
  getAuthorName,
  getCoverImageUrl
} from "./booksApi.js";

import {
  getBookById
} from "./booksApi.js";


const LOCAL_SAVED_BOOKS_KEY =
  "randomReads.savedBooks";

const LOCAL_JOURNAL_KEY =
  "randomReads.journal";

const JOURNAL_VISIBILITIES = [
  "private",
  "public",
  "group"
];


/* ============================================================
   AUTH HELPERS
============================================================ */

async function getCurrentUser() {
  if (
    auth.currentUser
  ) {
    return auth.currentUser;
  }

  return new Promise(
    (resolve) => {
      const unsubscribe =
        onAuthStateChanged(
          auth,
          (user) => {
            unsubscribe();

            resolve(
              user
            );
          }
        );
    }
  );
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


/* ============================================================
   DATA CLEANING
============================================================ */

/*
 * Firestore does not accept undefined.
 *
 * Only use this for ordinary JSON-compatible data.
 * Firestore values such as serverTimestamp() are added
 * AFTER cleaning instead of being passed through JSON.
 */
function cleanForFirestore(
  value
) {
  return JSON.parse(
    JSON.stringify(
      value
    )
  );
}


/* ============================================================
   JOURNAL HELPERS
============================================================ */

function normalizeVisibility(
  visibility
) {
  if (
    JOURNAL_VISIBILITIES.includes(
      visibility
    )
  ) {
    return visibility;
  }

  /*
   * All legacy notes are private by default.
   */
  return "private";
}


function normalizeJournalEntry(
  entry
) {
  if (!entry) {
    return null;
  }

  return {
    ...entry,

    visibility:
      normalizeVisibility(
        entry.visibility
      ),

    groupId:
      entry.groupId ||
      null,

    updatedAtISO:
      entry.updatedAtISO ||
      null
  };
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

  const booksRef =
    collection(
      db,
      "users",
      user.uid,
      "savedBooks"
    );

  const snapshot =
    await getDocs(
      booksRef
    );

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

  books.sort(
    (a, b) => {
      const aDate =
        a.savedAt ||
        "";

      const bDate =
        b.savedAt ||
        "";

      return bDate.localeCompare(
        aDate
      );
    }
  );

  return books;
}


export async function saveBook(
  book
) {
  if (
    !book?.id
  ) {
    throw new Error(
      "Cannot save a book without an ID."
    );
  }

  const user =
    await requireUser();

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

  const cleanBook =
    cleanForFirestore(
      book
    );

  await setDoc(
    bookRef,
    {
      ...cleanBook,

      savedAt:
        new Date()
          .toISOString(),

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

  const bookRef =
    doc(
      db,
      "users",
      user.uid,
      "savedBooks",
      String(
        bookId
      )
    );

  await deleteDoc(
    bookRef
  );

  return getSavedBooks();
}


export async function isBookSaved(
  bookId
) {
  const books =
    await getSavedBooks();

  return books.some(
    (book) =>
      String(
        book.id
      ) ===
      String(
        bookId
      )
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

  const journalRef =
    collection(
      db,
      "users",
      user.uid,
      "journal"
    );

  const journalQuery =
    query(
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

  return snapshot.docs
    .map(
      (entryDoc) =>
        normalizeJournalEntry({
          id:
            entryDoc.id,

          ...entryDoc.data()
        })
    )
    .filter(Boolean);
}


export async function getJournalForBook(
  bookId
) {
  if (
    bookId ===
      undefined ||
    bookId ===
      null
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
      String(
        bookId
      )
  );
}


/*
 * New journal records default to PRIVATE.
 *
 * visibility:
 *   private
 *   public
 *   group
 *
 * groupId remains null unless visibility is group.
 */
export async function addJournalEntry(
  entry
) {
  const user =
    await requireUser();

  const journalRef =
    collection(
      db,
      "users",
      user.uid,
      "journal"
    );

  const entryRef =
    doc(
      journalRef
    );

  const now =
    new Date()
      .toISOString();

  const visibility =
    normalizeVisibility(
      entry?.visibility
    );

  const cleanEntry =
    cleanForFirestore({
      ...entry,

      id:
        entryRef.id,

      userId:
        user.uid,

      visibility,

      groupId:
        visibility ===
        "group"
          ? entry?.groupId ||
            null
          : null,

      createdAt:
        now,

      updatedAtISO:
        null
    });

  const journalEntry = {
    ...cleanEntry,

    createdAtServer:
      serverTimestamp()
  };

  await setDoc(
    entryRef,
    journalEntry
  );

  /*
   * Return the client-friendly version rather than the
   * unresolved serverTimestamp sentinel.
   */
  return normalizeJournalEntry(
    cleanEntry
  );
}


/* ============================================================
   UPDATE JOURNAL ENTRY
============================================================ */

export async function updateJournalEntry(
  entryId,
  updates
) {
  if (!entryId) {
    throw new Error(
      "Missing journal entry ID."
    );
  }

  const user =
    await requireUser();

  const entryRef =
    doc(
      db,
      "users",
      user.uid,
      "journal",
      String(
        entryId
      )
    );

  const now =
    new Date()
      .toISOString();

  const updateData = {};


  /*
   * Note text
   */
  if (
    updates?.note !==
      undefined
  ) {
    const cleanedNote =
      String(
        updates.note
      ).trim();

    if (
      !cleanedNote
    ) {
      throw new Error(
        "A journal entry cannot be empty."
      );
    }

    updateData.note =
      cleanedNote;
  }


  /*
   * Visibility
   */
  if (
    updates?.visibility !==
      undefined
  ) {
    const visibility =
      normalizeVisibility(
        updates.visibility
      );

    updateData.visibility =
      visibility;

    updateData.groupId =
      visibility ===
      "group"
        ? updates?.groupId ||
          null
        : null;
  } else if (
    updates?.groupId !==
      undefined
  ) {
    updateData.groupId =
      updates.groupId ||
      null;
  }


  /*
   * Other journal fields can be updated later without
   * changing the Firestore API.
   */
  if (
    updates?.paragraphPreview !==
      undefined
  ) {
    updateData.paragraphPreview =
      String(
        updates.paragraphPreview ||
        ""
      );
  }


  const cleanUpdates =
    cleanForFirestore(
      updateData
    );

  await setDoc(
    entryRef,
    {
      ...cleanUpdates,

      updatedAt:
        serverTimestamp(),

      updatedAtISO:
        now
    },
    {
      merge: true
    }
  );

  return {
    id:
      String(
        entryId
      ),

    ...cleanUpdates,

    updatedAtISO:
      now
  };
}


/* ============================================================
   DELETE JOURNAL ENTRY
============================================================ */

export async function deleteJournalEntry(
  entryId
) {
  if (!entryId) {
    throw new Error(
      "Missing journal entry ID."
    );
  }

  const user =
    await requireUser();

  const entryRef =
    doc(
      db,
      "users",
      user.uid,
      "journal",
      String(
        entryId
      )
    );

  await deleteDoc(
    entryRef
  );

  return {
    deleted: true,
    id:
      String(
        entryId
      )
  };
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

  const progressRef =
    doc(
      db,
      "users",
      user.uid,
      "readingProgress",
      String(
        book.id
      )
    );

  const now =
    new Date()
      .toISOString();

  const safePercent =
    Math.min(
      Math.max(
        Math.round(
          percentComplete ||
          0
        ),
        0
      ),
      100
    );

  const progressData =
    cleanForFirestore({
      bookId:
        String(
          book.id
        ),

      title:
        book.title ||
        "Untitled",

      author:
        book.author ||
        getAuthorName(
          book
        ) ||
        "Unknown author",

      image:
        book.image ||
        book.cover ||
        getCoverImageUrl(
          book
        ) ||
        null,

      paragraphIndex,

      totalParagraphs:
        totalParagraphs ||
        0,

      percentComplete:
        safePercent,

      updatedAtISO:
        now,

      ...(safePercent >=
      100
        ? {
            completedAt:
              now
          }
        : {})
    });

  await setDoc(
    progressRef,
    {
      ...progressData,

      updatedAt:
        serverTimestamp()
    },
    {
      merge: true
    }
  );
}


export async function getReadingProgress(
  bookId
) {
  if (
    bookId ===
      undefined ||
    bookId ===
      null
  ) {
    return null;
  }

  const user =
    await getCurrentUser();

  if (!user) {
    return null;
  }

  const {
    getDoc
  } =
    await import(
      "firebase/firestore"
    );

  const progressRef =
    doc(
      db,
      "users",
      user.uid,
      "readingProgress",
      String(
        bookId
      )
    );

  const snapshot =
    await getDoc(
      progressRef
    );

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


  /*
   * Repair older reading-progress records that
   * were saved before Random Reads stored complete
   * book metadata.
   */
  const repairedRecords =
    await Promise.all(
      records.map(
        async (record) => {
          const needsRepair =
            !record.title ||
            !record.author ||
            record.author ===
              "Unknown author" ||
            !record.image;

          if (
            !needsRepair ||
            !record.bookId
          ) {
            return record;
          }

          try {
            const book =
              await getBookById(
                record.bookId
              );

            if (!book) {
              return record;
            }

            const repairedRecord = {
              ...record,

              title:
                book.title ||
                record.title ||
                "Untitled",

              author:
                book.author ||
                record.author ||
                "Unknown author",

              image:
                book.image ||
                book.cover ||
                record.image ||
                null
            };


            /*
             * Save the repaired metadata back to
             * Firestore so we don't have to repair
             * this record every time.
             */
            const recordRef =
              doc(
                db,
                "users",
                user.uid,
                "readingProgress",
                String(
                  record.bookId
                )
              );

            await setDoc(
              recordRef,
              {
                title:
                  repairedRecord.title,

                author:
                  repairedRecord.author,

                image:
                  repairedRecord.image,

                metadataUpdatedAt:
                  serverTimestamp()
              },
              {
                merge: true
              }
            );

            return repairedRecord;
          } catch (error) {
            /*
             * A Gutendex/network failure should not
             * prevent the reading timeline from loading.
             */
            console.warn(
              `Could not repair metadata for book ${record.bookId}:`,
              error
            );

            return record;
          }
        }
      )
    );


  repairedRecords.sort(
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


  return repairedRecords;
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

  const {
    getDoc
  } =
    await import(
      "firebase/firestore"
    );

  const profileRef =
    doc(
      db,
      "users",
      user.uid
    );

  const snapshot =
    await getDoc(
      profileRef
    );

  const storedProfile =
    snapshot.exists()
      ? snapshot.data()
      : {};

  return {
    uid:
      user.uid,

    displayName:
      storedProfile
        .displayName ||
      user.displayName ||
      user.email
        ?.split("@")[0] ||
      "Reader",

    email:
      user.email ||
      "",

    photoURL:
      storedProfile
        .photoURL ||
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

  const profileRef =
    doc(
      db,
      "users",
      user.uid
    );

  const now =
    new Date()
      .toISOString();

  const cleanProfile =
    cleanForFirestore({
      displayName:
        displayName
          ?.trim() ||
        "Reader",

      photoURL:
        photoURL
          ?.trim() ||
        "",

      about:
        about
          ?.trim() ||
        "",

      updatedAtISO:
        now
    });

  await setDoc(
    profileRef,
    {
      ...cleanProfile,

      updatedAt:
        serverTimestamp()
    },
    {
      merge: true
    }
  );

  return {
    uid:
      user.uid,

    email:
      user.email ||
      "",

    ...cleanProfile
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
      migrated:
        false,

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
      migrated:
        false,

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


  /*
   * Find old reading-progress keys.
   */
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
       * Ignore malformed legacy progress.
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
      if (
        !book?.id
      ) {
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

      /*
       * Old local journal records become private.
       */
      const migratedEntry =
        cleanForFirestore({
          ...entry,

          id:
            entryId,

          userId:
            user.uid,

          visibility:
            normalizeVisibility(
              entry.visibility
            ),

          groupId:
            entry.visibility ===
            "group"
              ? entry.groupId ||
                null
              : null,

          createdAt:
            entry.createdAt ||
            new Date()
              .toISOString(),

          updatedAtISO:
            entry.updatedAtISO ||
            null
        });

      await setDoc(
        entryRef,
        {
          ...migratedEntry,

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

      if (
        oldUpdatedAt
      ) {
        const parsedDate =
          new Date(
            oldUpdatedAt
          );

        if (
          !Number.isNaN(
            parsedDate
              .getTime()
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
      migrated:
        true,

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
     * Leave the original localStorage data untouched
     * if the migration fails.
     */
    throw error;
  }
}
