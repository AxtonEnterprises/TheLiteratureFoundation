import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
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
    bookId === undefined ||
    bookId === null
  ) {
    return [];
  }

  const user =
    auth.currentUser;

  if (!user) {
    return [];
  }

  try {
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
        where(
          "bookId",
          "==",
          String(bookId)
        )
      );

    const snapshot =
      await getDocs(
        journalQuery
      );

    const entries =
      snapshot.docs
        .map(
          (journalDoc) =>
            normalizeJournalEntry({
              id:
                journalDoc.id,

              ...journalDoc.data()
            })
        )
        .filter(Boolean);

    return entries.sort(
      (a, b) => {
        const aDate =
          a.createdAtISO ||
          a.createdAt ||
          "";

        const bDate =
          b.createdAtISO ||
          b.createdAt ||
          "";

        return String(
          bDate
        ).localeCompare(
          String(aDate)
        );
      }
    );
  } catch (error) {
    console.error(
      `Could not load journal for book ${bookId}:`,
      error
    );

    throw error;
  }
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

    avatar:
      storedProfile.avatar ||
      "",

    /*
     * Keep the authenticated account photo as a fallback
     * until the reader chooses a preset avatar.
     */
    photoURL:
      storedProfile
        .photoURL ||
      user.photoURL ||
      "",

    about:
      storedProfile.about ||
      "",

    /*
     * Presence is opt-in.
     */
    showReadingPresence:
      storedProfile
        .showReadingPresence ===
      true
  };
}


export async function saveUserProfile({
  displayName,
  about,
  avatar,
  showReadingPresence = false
}) {
  const user =
    await requireUser();

  const profileRef =
    doc(
      db,
      "users",
      user.uid
    );

  const publicProfileRef =
    doc(
      db,
      "publicProfiles",
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

      avatar:
        avatar
          ?.trim() ||
        "",

      about:
        about
          ?.trim() ||
        "",

      showReadingPresence:
        Boolean(
          showReadingPresence
        ),

      updatedAtISO:
        now
    });

  /*
   * Private account profile.
   */
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

  /*
   * Sanitized public identity.
   *
   * Deliberately does NOT include email, auth-provider
   * information, or other private account data.
   */
  await setDoc(
    publicProfileRef,
    {
      userId:
        user.uid,

      displayName:
        cleanProfile.displayName,

      avatar:
        cleanProfile.avatar,

      about:
        cleanProfile.about,

      updatedAtISO:
        now,

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

    photoURL:
      user.photoURL ||
      "",

    ...cleanProfile
  };
}


/* ============================================================
   PUBLIC PROFILE
============================================================ */

export async function getPublicProfile(
  userId
) {
  if (!userId) {
    return null;
  }

  const user =
    await getCurrentUser();

  /*
   * Public profiles are currently available only to
   * authenticated Random Reads users, matching the rules.
   */
  if (!user) {
    return null;
  }

  const profileRef =
    doc(
      db,
      "publicProfiles",
      String(
        userId
      )
    );

  const snapshot =
    await getDoc(
      profileRef
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return {
    id:
      snapshot.id,

    ...snapshot.data()
  };
}
export async function getPublicJournalForUser(
  userId
) {
  if (!userId) {
    return [];
  }

  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const journalRef =
    collectionGroup(
      db,
      "journal"
    );

  const journalQuery =
    query(
      journalRef,
      where(
        "userId",
        "==",
        String(userId)
      ),
      where(
        "visibility",
        "==",
        "public"
      )
    );

  const snapshot =
    await getDocs(
      journalQuery
    );

  const entries =
    snapshot.docs
      .map(
        (entryDoc) =>
          normalizeJournalEntry({
            id:
              entryDoc.id,

            ...entryDoc.data()
          })
      )
      .filter(Boolean);

  entries.sort(
    (a, b) =>
      String(
        b.updatedAtISO ||
        b.createdAt ||
        ""
      ).localeCompare(
        String(
          a.updatedAtISO ||
          a.createdAt ||
          ""
        )
      )
  );

  return entries;
}
/* ============================================================
   THE MARGINS — PUBLIC FEED
============================================================ */

export async function getMarginsFeed() {
  const journalRef =
    collectionGroup(
      db,
      "journal"
    );

  const marginsQuery =
    query(
      journalRef,
      where(
        "visibility",
        "==",
        "public"
      )
    );

  const snapshot =
    await getDocs(
      marginsQuery
    );

  const entries =
    snapshot.docs
      .map(
        (entryDoc) =>
          normalizeJournalEntry({
            id:
              entryDoc.id,

            ...entryDoc.data()
          })
      )
      .filter(Boolean);


  /*
   * Resolve each reader's sanitized public profile.
   *
   * We only fetch each profile once even if that reader
   * has multiple entries in the feed.
   */
  const userIds =
    [
      ...new Set(
        entries
          .map(
            (entry) =>
              entry.userId
          )
          .filter(Boolean)
      )
    ];

  const profilePairs =
    await Promise.all(
      userIds.map(
        async (
          userId
        ) => {
          try {
            const profile =
              await getPublicProfile(
                userId
              );

            return [
              String(userId),
              profile
            ];
          } catch (error) {
            console.error(
              `Could not load public profile ${userId}:`,
              error
            );

            return [
              String(userId),
              null
            ];
          }
        }
      )
    );

  const profiles =
    new Map(
      profilePairs
    );


  const feed =
    entries.map(
      (entry) => ({
        ...entry,

        reader:
          profiles.get(
            String(
              entry.userId
            )
          ) ||
          null
      })
    );


  /*
   * Newest entries first.
   */
  feed.sort(
    (a, b) => {
      const aDate =
        a.updatedAtISO ||
        a.createdAt ||
        "";

      const bDate =
        b.updatedAtISO ||
        b.createdAt ||
        "";

      return String(
        bDate
      ).localeCompare(
        String(
          aDate
        )
      );
    }
  );

  return feed;
}
/* ============================================================
   THE MARGINS — INTERACTIONS
============================================================ */

function marginEntryKey(
  entry
) {
  return [
    entry?.userId || "",
    entry?.id || ""
  ]
    .filter(Boolean)
    .join("_");
}


/* ============================================================
   SAVE MARGIN
============================================================ */

export async function saveMarginEntry(
  entry
) {
  if (
    !entry?.id ||
    !entry?.userId
  ) {
    throw new Error(
      "Missing margin entry information."
    );
  }

  const user =
    await requireUser();

  const savedId =
    marginEntryKey(
      entry
    );

  const savedRef =
    doc(
      db,
      "users",
      user.uid,
      "savedMargins",
      savedId
    );

  const now =
    new Date()
      .toISOString();

  const data =
    cleanForFirestore({
      sourceEntryId:
        String(
          entry.id
        ),

      sourceUserId:
        String(
          entry.userId
        ),

      bookId:
        entry.bookId
          ? String(
              entry.bookId
            )
          : null,

      title:
        entry.title ||
        "Untitled",

      author:
        entry.author ||
        "",

      note:
        entry.note ||
        "",

      paragraphNumber:
        entry.paragraphNumber ||
        null,

      paragraphPreview:
        entry.paragraphPreview ||
        "",

      savedAtISO:
        now
    });

  await setDoc(
    savedRef,
    {
      ...data,

      savedAt:
        serverTimestamp()
    },
    {
      merge: true
    }
  );

  return {
    id:
      savedId,

    ...data
  };
}


/* ============================================================
   UNSAVE MARGIN
============================================================ */

export async function unsaveMarginEntry(
  entry
) {
  if (
    !entry?.id ||
    !entry?.userId
  ) {
    return;
  }

  const user =
    await requireUser();

  const savedRef =
    doc(
      db,
      "users",
      user.uid,
      "savedMargins",
      marginEntryKey(
        entry
      )
    );

  await deleteDoc(
    savedRef
  );
}


/* ============================================================
   GET SAVED MARGINS
============================================================ */

export async function getSavedMargins() {
  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const savedRef =
    collection(
      db,
      "users",
      user.uid,
      "savedMargins"
    );

  const snapshot =
    await getDocs(
      savedRef
    );

  const saved =
    snapshot.docs.map(
      (
        savedDoc
      ) => ({
        id:
          savedDoc.id,

        ...savedDoc.data()
      })
    );

  saved.sort(
    (
      a,
      b
    ) =>
      String(
        b.savedAtISO ||
        ""
      ).localeCompare(
        String(
          a.savedAtISO ||
          ""
        )
      )
  );

  return saved;
}


/* ============================================================
   REPLY TO MARGIN
============================================================ */

export async function replyToMargin(
  entry,
  {
    note,
    visibility,
    groupId = null,
    parentReplyId = null
  }
) {
  if (
    !entry?.id ||
    !entry?.userId
  ) {
    throw new Error(
      "Missing parent margin."
    );
  }

  const cleanNote =
    String(
      note || ""
    ).trim();

  if (!cleanNote) {
    throw new Error(
      "A reply cannot be empty."
    );
  }

  const user =
    await requireUser();

  const normalizedVisibility =
    normalizeVisibility(
      visibility
    );

  const repliesRef =
    collection(
      db,
      "marginReplies"
    );

  const replyRef =
    doc(
      repliesRef
    );

  const now =
    new Date()
      .toISOString();

  const reply =
    cleanForFirestore({
      id:
        replyRef.id,

      userId:
        user.uid,

      parentEntryId:
        String(
          entry.id
        ),

      parentUserId:
        String(
          entry.userId
        ),

      parentReplyId:
        parentReplyId
          ? String(
              parentReplyId
            )
          : null,

      bookId:
        entry.bookId
          ? String(
              entry.bookId
            )
          : null,

      title:
        entry.title ||
        "Untitled",

      author:
        entry.author ||
        "",

      note:
        cleanNote,

      visibility:
        normalizedVisibility,

      groupId:
        normalizedVisibility ===
        "group"
          ? groupId || null
          : null,

      createdAtISO:
        now
    });

  await setDoc(
    replyRef,
    {
      ...reply,

      createdAt:
        serverTimestamp()
    }
  );

  return reply;
}


/* ============================================================
   GET REPLIES
============================================================ */

export async function getMarginReplies(
  entry
) {
  if (!entry?.id) {
    return [];
  }

  const parentEntryId =
    String(entry.id);

  const repliesRef =
    collection(
      db,
      "marginReplies"
    );

  const publicQuery =
    query(
      repliesRef,
      where(
        "parentEntryId",
        "==",
        parentEntryId
      ),
      where(
        "visibility",
        "==",
        "public"
      )
    );

  const publicSnapshot =
    await getDocs(
      publicQuery
    );

  const publicReplies =
    publicSnapshot.docs.map(
      (replyDoc) => ({
        id:
          replyDoc.id,

        ...replyDoc.data()
      })
    );

  const user =
    await getCurrentUser();

  let privateReplies = [];

  if (user) {
    const privateQuery =
      query(
        repliesRef,
        where(
          "parentEntryId",
          "==",
          parentEntryId
        ),
        where(
          "visibility",
          "==",
          "private"
        ),
        where(
          "userId",
          "==",
          user.uid
        )
      );

    const privateSnapshot =
      await getDocs(
        privateQuery
      );

    privateReplies =
      privateSnapshot.docs.map(
        (replyDoc) => ({
          id:
            replyDoc.id,

          ...replyDoc.data()
        })
      );
  }

  const replies = [
    ...publicReplies,
    ...privateReplies
  ];

  replies.sort(
    (a, b) =>
      String(
        a.createdAtISO ||
        ""
      ).localeCompare(
        String(
          b.createdAtISO ||
          ""
        )
      )
  );

  return replies;
}


/* ============================================================
   REPORT MARGIN
============================================================ */

export async function reportMarginEntry(
  entry,
  {
    reason,
    details = ""
  }
) {
  if (
    !entry?.id ||
    !entry?.userId
  ) {
    throw new Error(
      "Missing margin entry."
    );
  }

  const user =
    await requireUser();

  const reportsRef =
    collection(
      db,
      "marginReports"
    );

  const reportRef =
    doc(
      reportsRef
    );

  const now =
    new Date()
      .toISOString();

  const report =
    cleanForFirestore({
      id:
        reportRef.id,

      reporterUserId:
        user.uid,

      reportedEntryId:
        String(
          entry.id
        ),

      reportedUserId:
        String(
          entry.userId
        ),

      reason:
        String(
          reason ||
          "other"
        ),

      details:
        String(
          details ||
          ""
        ).trim(),

      status:
        "open",

      createdAtISO:
        now
    });

  await setDoc(
    reportRef,
    {
      ...report,

      createdAt:
        serverTimestamp()
    }
  );

  return report;
}


/* ============================================================
   LIVE READING PRESENCE
============================================================ */

export async function updateReadingPresence({
  book,
  percentComplete = 0
}) {
  const user =
    await getCurrentUser();

  if (
    !user ||
    !book?.id
  ) {
    return null;
  }

  const profile =
    await getUserProfile();

  /*
   * Reading presence is private unless the user
   * explicitly opts in from their profile.
   */
  if (
    !profile
      ?.showReadingPresence
  ) {
    return null;
  }

  const presenceId =
    `${book.id}_${user.uid}`;

  const presenceRef =
    doc(
      db,
      "readingPresence",
      presenceId
    );

  const now =
    new Date()
      .toISOString();

  const safePercent =
    Math.min(
      Math.max(
        Math.round(
          Number(
            percentComplete
          ) ||
          0
        ),
        0
      ),
      100
    );

  const presence =
    cleanForFirestore({
      userId:
        user.uid,

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

      displayName:
        profile.displayName ||
        "Reader",

      avatar:
        profile.avatar ||
        "",

      percentComplete:
        safePercent,

      lastActiveAtISO:
        now
    });

  await setDoc(
    presenceRef,
    {
      ...presence,

      lastActiveAt:
        serverTimestamp()
    },
    {
      merge: true
    }
  );

  return {
    id:
      presenceId,

    ...presence
  };
}


export async function clearReadingPresence(
  bookId
) {
  const user =
    auth.currentUser;

  if (
    !user ||
    bookId === undefined ||
    bookId === null
  ) {
    return;
  }

  const presenceRef =
    doc(
      db,
      "readingPresence",
      `${bookId}_${user.uid}`
    );

  await deleteDoc(
    presenceRef
  );
}


export async function getReadersForBook(
  bookId
) {
  if (
    bookId === undefined ||
    bookId === null
  ) {
    return [];
  }

  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const presenceRef =
    collection(
      db,
      "readingPresence"
    );

  const presenceQuery =
    query(
      presenceRef,
      where(
        "bookId",
        "==",
        String(
          bookId
        )
      )
    );

  const snapshot =
    await getDocs(
      presenceQuery
    );

  const now =
    Date.now();

  /*
   * Presence is considered active for 10 minutes.
   * Old documents can remain in Firestore without showing
   * stale readers in the UI.
   */
  const activeWindow =
    1000 *
    60 *
    10;

  return snapshot.docs
    .map(
      (presenceDoc) => ({
        id:
          presenceDoc.id,

        ...presenceDoc.data()
      })
    )
    .filter(
      (reader) => {
        const activeAt =
          new Date(
            reader
              .lastActiveAtISO ||
            0
          ).getTime();

        return (
          Number.isFinite(
            activeAt
          ) &&
          now -
            activeAt <
            activeWindow
        );
      }
    )
    .sort(
      (a, b) =>
        String(
          b.lastActiveAtISO ||
          ""
        ).localeCompare(
          String(
            a.lastActiveAtISO ||
            ""
          )
        )
    );
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
export async function getReadingTimelineVisibility() {
  const user =
    await getCurrentUser();

  if (!user) {
    return "private";
  }

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

  if (!snapshot.exists()) {
    return "private";
  }

  return snapshot.data()
    ?.readingTimelineVisibility ===
    "public"
      ? "public"
      : "private";
}


export async function setReadingTimelineVisibility(
  visibility
) {
  const user =
    await requireUser();

  const normalized =
    visibility ===
    "public"
      ? "public"
      : "private";

  const now =
    new Date()
      .toISOString();

  const profileRef =
    doc(
      db,
      "users",
      user.uid
    );

  const publicProfileRef =
    doc(
      db,
      "publicProfiles",
      user.uid
    );

  await Promise.all([
    setDoc(
      profileRef,
      {
        readingTimelineVisibility:
          normalized,
        updatedAt:
          serverTimestamp()
      },
      {
        merge: true
      }
    ),

    setDoc(
      publicProfileRef,
      {
        userId:
          user.uid,
        readingTimelineVisibility:
          normalized,
        updatedAtISO:
          now,
        updatedAt:
          serverTimestamp()
      },
      {
        merge: true
      }
    )
  ]);

  return normalized;
}


export async function setReadingProgressVisibility(
  bookId,
  visibility
) {
  if (
    bookId === undefined ||
    bookId === null
  ) {
    throw new Error(
      "Missing book ID."
    );
  }

  const user =
    await requireUser();

  const normalized =
    visibility ===
    "public"
      ? "public"
      : "private";

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

  await setDoc(
    progressRef,
    {
      visibility:
        normalized,
      visibilityUpdatedAt:
        serverTimestamp()
    },
    {
      merge: true
    }
  );

  return {
    bookId:
      String(
        bookId
      ),
    visibility:
      normalized
  };
}

/* ============================================================
   FRIENDS / SOCIAL
============================================================ */

function friendPairId(
  firstUserId,
  secondUserId
) {
  return [
    String(firstUserId),
    String(secondUserId)
  ]
    .sort()
    .join("__");
}


async function getFriendshipRecord(
  otherUserId
) {
  const user =
    await getCurrentUser();

  if (
    !user ||
    !otherUserId
  ) {
    return null;
  }

  const relationshipRef =
    doc(
      db,
      "friendships",
      friendPairId(
        user.uid,
        otherUserId
      )
    );

  const snapshot =
    await getDoc(
      relationshipRef
    );

  if (
    !snapshot.exists()
  ) {
    return null;
  }

  return {
    id:
      snapshot.id,

    ...snapshot.data()
  };
}


export async function getFriendshipStatus(
  otherUserId
) {
  const user =
    await getCurrentUser();

  if (
    !user ||
    !otherUserId
  ) {
    return {
      status:
        "none"
    };
  }

  if (
    String(
      otherUserId
    ) ===
    String(
      user.uid
    )
  ) {
    return {
      status:
        "self"
    };
  }

  const relationship =
    await getFriendshipRecord(
      otherUserId
    );

  if (!relationship) {
    return {
      status:
        "none"
    };
  }

  if (
    relationship.status ===
    "accepted"
  ) {
    return {
      status:
        "friends",

      relationship
    };
  }

  if (
    relationship.status ===
    "pending"
  ) {
    return {
      status:
        relationship.requestedBy ===
        user.uid
          ? "outgoing"
          : "incoming",

      relationship
    };
  }

  return {
    status:
      "none"
  };
}


export async function sendFriendRequest(
  otherUserId
) {
  const user =
    await requireUser();

  if (
    !otherUserId ||
    String(
      otherUserId
    ) ===
    String(
      user.uid
    )
  ) {
    throw new Error(
      "Choose another reader."
    );
  }

  const pairId =
    friendPairId(
      user.uid,
      otherUserId
    );

  const relationshipRef =
    doc(
      db,
      "friendships",
      pairId
    );

  const existing =
    await getDoc(
      relationshipRef
    );

  if (
    existing.exists()
  ) {
    const data =
      existing.data();

    if (
      data.status ===
      "accepted"
    ) {
      return {
        id:
          pairId,

        ...data
      };
    }

    if (
      data.status ===
        "pending" &&
      data.requestedTo ===
        user.uid
    ) {
      const now =
        new Date()
          .toISOString();

      await updateDoc(
        relationshipRef,
        {
          status:
            "accepted",

          acceptedAtISO:
            now,

          updatedAtISO:
            now,

          updatedAt:
            serverTimestamp()
        }
      );

      return {
        id:
          pairId,

        ...data,

        status:
          "accepted",

        acceptedAtISO:
          now
      };
    }
  }

  const now =
    new Date()
      .toISOString();

  const relationship =
    cleanForFirestore({
      users: [
        user.uid,
        String(
          otherUserId
        )
      ].sort(),

      requestedBy:
        user.uid,

      requestedTo:
        String(
          otherUserId
        ),

      status:
        "pending",

      createdAtISO:
        now,

      updatedAtISO:
        now
    });

  await setDoc(
    relationshipRef,
    {
      ...relationship,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp()
    },
    {
      merge:
        true
    }
  );

  return {
    id:
      pairId,

    ...relationship
  };
}


export async function cancelFriendRequest(
  otherUserId
) {
  const user =
    await requireUser();

  const relationship =
    await getFriendshipRecord(
      otherUserId
    );

  if (
    !relationship ||
    relationship.status !==
      "pending" ||
    relationship.requestedBy !==
      user.uid
  ) {
    return;
  }

  await deleteDoc(
    doc(
      db,
      "friendships",
      relationship.id
    )
  );
}


export async function respondToFriendRequest(
  otherUserId,
  accept
) {
  const user =
    await requireUser();

  const relationship =
    await getFriendshipRecord(
      otherUserId
    );

  if (
    !relationship ||
    relationship.status !==
      "pending" ||
    relationship.requestedTo !==
      user.uid
  ) {
    throw new Error(
      "Friend request is no longer available."
    );
  }

  const relationshipRef =
    doc(
      db,
      "friendships",
      relationship.id
    );

  if (!accept) {
    await deleteDoc(
      relationshipRef
    );

    return {
      status:
        "declined"
    };
  }

  const now =
    new Date()
      .toISOString();

  await updateDoc(
    relationshipRef,
    {
      status:
        "accepted",

      acceptedAtISO:
        now,

      updatedAtISO:
        now,

      updatedAt:
        serverTimestamp()
    }
  );

  return {
    ...relationship,

    status:
      "accepted",

    acceptedAtISO:
      now
  };
}


export async function removeFriend(
  otherUserId
) {
  const user =
    await requireUser();

  const relationship =
    await getFriendshipRecord(
      otherUserId
    );

  if (
    !relationship ||
    relationship.status !==
      "accepted" ||
    !relationship.users?.includes(
      user.uid
    )
  ) {
    return;
  }

  await deleteDoc(
    doc(
      db,
      "friendships",
      relationship.id
    )
  );
}


async function getRelationshipRecordsForCurrentUser() {
  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const relationshipsRef =
    collection(
      db,
      "friendships"
    );

  const relationshipsQuery =
    query(
      relationshipsRef,

      where(
        "users",
        "array-contains",
        user.uid
      )
    );

  const snapshot =
    await getDocs(
      relationshipsQuery
    );

  return snapshot.docs.map(
    (
      relationshipDoc
    ) => ({
      id:
        relationshipDoc.id,

      ...relationshipDoc.data()
    })
  );
}


async function attachPublicProfiles(
  relationships,
  currentUserId
) {
  return Promise.all(
    relationships.map(
      async (
        relationship
      ) => {
        const otherUserId =
          relationship.users
            ?.find(
              (
                candidate
              ) =>
                candidate !==
                currentUserId
            ) ||
          (
            relationship.requestedBy ===
            currentUserId
              ? relationship.requestedTo
              : relationship.requestedBy
          );

        const profile =
          otherUserId
            ? await getPublicProfile(
                otherUserId
              )
            : null;

        return {
          ...relationship,

          otherUserId,

          profile
        };
      }
    )
  );
}


export async function getFriends() {
  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const relationships =
    await getRelationshipRecordsForCurrentUser();

  const accepted =
    relationships.filter(
      (
        relationship
      ) =>
        relationship.status ===
        "accepted"
    );

  const hydrated =
    await attachPublicProfiles(
      accepted,
      user.uid
    );

  hydrated.sort(
    (
      a,
      b
    ) =>
      String(
        a.profile
          ?.displayName ||
        ""
      ).localeCompare(
        String(
          b.profile
            ?.displayName ||
          ""
        )
      )
  );

  return hydrated;
}


export async function getIncomingFriendRequests() {
  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const relationships =
    await getRelationshipRecordsForCurrentUser();

  return attachPublicProfiles(
    relationships.filter(
      (
        relationship
      ) =>
        relationship.status ===
          "pending" &&
        relationship.requestedTo ===
          user.uid
    ),

    user.uid
  );
}


export async function getOutgoingFriendRequests() {
  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const relationships =
    await getRelationshipRecordsForCurrentUser();

  return attachPublicProfiles(
    relationships.filter(
      (
        relationship
      ) =>
        relationship.status ===
          "pending" &&
        relationship.requestedBy ===
          user.uid
    ),

    user.uid
  );
}


export async function searchReaders(
  searchTerm
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return [];
  }

  const cleanSearch =
    String(
      searchTerm ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    cleanSearch.length <
    2
  ) {
    return [];
  }

  const profilesRef =
    collection(
      db,
      "publicProfiles"
    );

  const snapshot =
    await getDocs(
      profilesRef
    );

  return snapshot.docs
    .map(
      (
        profileDoc
      ) => ({
        id:
          profileDoc.id,

        ...profileDoc.data()
      })
    )
    .filter(
      (
        profile
      ) =>
        profile.id !==
          user.uid &&
        String(
          profile.displayName ||
          ""
        )
          .toLowerCase()
          .includes(
            cleanSearch
          )
    )
    .slice(
      0,
      20
    );
}


export async function getFriendsMarginsFeed() {
  const friends =
    await getFriends();

  if (
    !friends.length
  ) {
    return [];
  }

  const friendIds =
    new Set(
      friends.map(
        (
          friend
        ) =>
          String(
            friend.otherUserId
          )
      )
    );

  const feed =
    await getMarginsFeed();

  return feed.filter(
    (
      entry
    ) =>
      friendIds.has(
        String(
          entry.userId
        )
      )
  );
}

