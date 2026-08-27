import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";

import {
  auth,
  db
} from "../firebase";

import {
  getFriends,
  getMyGroups,
  getPublicProfile
} from "./storage.js";


async function requireUser() {
  const user =
    auth.currentUser;

  if (!user) {
    throw new Error(
      "You must be logged in."
    );
  }

  return user;
}


function normalizeChainEntry(
  entry
) {
  if (!entry) {
    return null;
  }

  return {
    ...entry,

    visibility:
      [
        "private",
        "public",
        "group"
      ].includes(
        entry.visibility
      )
        ? entry.visibility
        : "private",

    groupId:
      entry.groupId ||
      null,

    updatedAtISO:
      entry.updatedAtISO ||
      null
  };
}


function chainEntryKey(
  entry
) {
  return [
    entry?.userId ||
      "",
    entry?.id ||
      ""
  ]
    .filter(Boolean)
    .join("_");
}


async function getGroupMemberRecord(
  groupId,
  userId
) {
  if (
    !groupId ||
    !userId
  ) {
    return null;
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        "groups",
        String(
          groupId
        ),
        "members",
        String(
          userId
        )
      )
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


async function requireGroupModerator(
  groupId
) {
  const user =
    await requireUser();

  const membership =
    await getGroupMemberRecord(
      groupId,
      user.uid
    );

  if (
    !membership ||
    ![
      "owner",
      "admin",
      "moderator"
    ].includes(
      membership.role
    ) ||
    [
      "removed",
      "suspended"
    ].includes(
      membership.status
    )
  ) {
    throw new Error(
      "You do not have moderation access."
    );
  }

  return {
    user,
    membership
  };
}


/* ============================================================
   THE CHAIN — PUBLIC FEED
============================================================ */

export async function getChainFeed() {
  const journalRef =
    collectionGroup(
      db,
      "journal"
    );

  const chainQuery =
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
      chainQuery
    );

  const entries =
    snapshot.docs
      .map(
        (entryDoc) =>
          normalizeChainEntry({
            id:
              entryDoc.id,
            ...entryDoc.data()
          })
      )
      .filter(Boolean);

  const userIds = [
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
        async (userId) => {
          try {
            return [
              String(
                userId
              ),
              await getPublicProfile(
                userId
              )
            ];
          } catch (error) {
            console.error(
              `Could not load public profile ${userId}:`,
              error
            );

            return [
              String(
                userId
              ),
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

  return entries
    .map(
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
    )
    .sort(
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
}


/* ============================================================
   THE CHAIN — FRIENDS FEED
============================================================ */

export async function getFriendsChainFeed() {
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
        (friend) =>
          String(
            friend.otherUserId
          )
      )
    );

  const feed =
    await getChainFeed();

  return feed.filter(
    (entry) =>
      friendIds.has(
        String(
          entry.userId
        )
      )
  );
}


/* ============================================================
   THE CHAIN — GROUP FEED
============================================================ */

export async function getGroupsChainFeed() {
  const groups =
    await getMyGroups();

  if (
    !groups.length
  ) {
    return [];
  }

  const feeds =
    await Promise.all(
      groups.map(
        async (group) => {
          const snapshot =
            await getDocs(
              query(
                collectionGroup(
                  db,
                  "journal"
                ),
                where(
                  "groupId",
                  "==",
                  String(
                    group.id
                  )
                ),
                where(
                  "visibility",
                  "==",
                  "group"
                )
              )
            );

          return Promise.all(
            snapshot.docs.map(
              async (
                entryDoc
              ) => {
                const entry =
                  normalizeChainEntry({
                    id:
                      entryDoc.id,
                    ...entryDoc.data()
                  });

                if (!entry) {
                  return null;
                }

                const publicProfile =
                  entry.userId
                    ? await getPublicProfile(
                        entry.userId
                      )
                    : null;

                return {
                  ...entry,

                  reader:
                    publicProfile,

                  publicProfile,

                  group: {
                    id:
                      group.id,
                    name:
                      group.name,
                    type:
                      group.type,
                    avatar:
                      group.avatar ||
                      "",
                    membership:
                      group.membership ||
                      null
                  }
                };
              }
            )
          );
        }
      )
    );

  return feeds
    .flat()
    .filter(Boolean)
    .sort(
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
}


/* ============================================================
   SAVE CHAIN ENTRY
============================================================ */

export async function saveChainEntry(
  entry
) {
  if (
    !entry?.id ||
    !entry?.userId
  ) {
    throw new Error(
      "Missing Chain entry information."
    );
  }

  const user =
    await requireUser();

  const savedId =
    chainEntryKey(
      entry
    );

  const savedRef =
    doc(
      db,
      "users",
      user.uid,
      "savedChainEntries",
      savedId
    );

  const now =
    new Date()
      .toISOString();

  const data = {
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

    visibility:
      entry.visibility ||
      "public",

    groupId:
      entry.groupId ||
      null,

    savedAtISO:
      now
  };

  await setDoc(
    savedRef,
    {
      ...data,
      savedAt:
        serverTimestamp()
    },
    {
      merge:
        true
    }
  );

  return {
    id:
      savedId,
    ...data
  };
}


/* ============================================================
   UNSAVE CHAIN ENTRY
============================================================ */

export async function unsaveChainEntry(
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

  await deleteDoc(
    doc(
      db,
      "users",
      user.uid,
      "savedChainEntries",
      chainEntryKey(
        entry
      )
    )
  );
}


/* ============================================================
   GET SAVED CHAIN ENTRIES
============================================================ */

export async function getSavedChainEntries() {
  const user =
    auth.currentUser;

  if (!user) {
    return [];
  }

  const snapshot =
    await getDocs(
      collection(
        db,
        "users",
        user.uid,
        "savedChainEntries"
      )
    );

  return snapshot.docs
    .map(
      (savedDoc) => ({
        id:
          savedDoc.id,
        ...savedDoc.data()
      })
    )
    .sort(
      (a, b) =>
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
}


/* ============================================================
   REPORT CHAIN ENTRY
============================================================ */

export async function reportChainEntry(
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
      "Missing Chain entry."
    );
  }

  const user =
    await requireUser();

  const reportRef =
    doc(
      collection(
        db,
        "chainReports"
      )
    );

  const now =
    new Date()
      .toISOString();

  const chainEntry = {
    id:
      String(
        entry.id
      ),

    userId:
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

    visibility:
      entry.visibility ||
      "public",

    groupId:
      entry.groupId ||
      null
  };

  const report = {
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

    groupId:
      entry.groupId
        ? String(
            entry.groupId
          )
        : null,

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

    chainEntry,

    createdAtISO:
      now
  };

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
   GROUP CHAIN MODERATION
============================================================ */

export async function getGroupModerationQueue(
  groupId
) {
  await requireGroupModerator(
    groupId
  );

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          "chainReports"
        ),
        where(
          "groupId",
          "==",
          String(
            groupId
          )
        ),
        where(
          "status",
          "==",
          "open"
        )
      )
    );

  const reports =
    await Promise.all(
      snapshot.docs.map(
        async (reportDoc) => {
          const data =
            reportDoc.data();

          return {
            id:
              reportDoc.id,
            ...data,

            reporterProfile:
              data.reporterUserId
                ? await getPublicProfile(
                    data.reporterUserId
                  )
                : null,

            reportedProfile:
              data.reportedUserId
                ? await getPublicProfile(
                    data.reportedUserId
                  )
                : null
          };
        }
      )
    );

  return reports.sort(
    (a, b) =>
      String(
        b.createdAtISO ||
        ""
      ).localeCompare(
        String(
          a.createdAtISO ||
          ""
        )
      )
  );
}


export async function resolveGroupChainReport(
  groupId,
  reportId,
  resolution
) {
  const {
    user
  } =
    await requireGroupModerator(
      groupId
    );

  const reportRef =
    doc(
      db,
      "chainReports",
      String(
        reportId
      )
    );

  const snapshot =
    await getDoc(
      reportRef
    );

  if (
    !snapshot.exists()
  ) {
    return;
  }

  const data =
    snapshot.data();

  if (
    String(
      data.groupId ||
      ""
    ) !==
    String(
      groupId
    )
  ) {
    throw new Error(
      "This report does not belong to that group."
    );
  }

  const normalizedResolution =
    resolution ===
    "dismissed"
      ? "dismissed"
      : "resolved";

  await updateDoc(
    reportRef,
    {
      status:
        normalizedResolution,
      resolvedBy:
        user.uid,
      resolvedAtISO:
        new Date()
          .toISOString(),
      resolvedAt:
        serverTimestamp()
    }
  );
}


export async function deleteReportedGroupChainEntry(
  groupId,
  report
) {
  const {
    user
  } =
    await requireGroupModerator(
      groupId
    );

  const reportId =
    report?.id;

  const entry =
    report?.chainEntry;

  if (
    !reportId ||
    !entry?.id ||
    !entry?.userId
  ) {
    throw new Error(
      "The reported Chain entry is unavailable."
    );
  }

  if (
    String(
      entry.groupId ||
      ""
    ) !==
    String(
      groupId
    )
  ) {
    throw new Error(
      "This Chain entry does not belong to that group."
    );
  }

  await deleteDoc(
    doc(
      db,
      "users",
      String(
        entry.userId
      ),
      "journal",
      String(
        entry.id
      )
    )
  );

  await updateDoc(
    doc(
      db,
      "chainReports",
      String(
        reportId
      )
    ),
    {
      status:
        "resolved",
      resolution:
        "entry_deleted",
      resolvedBy:
        user.uid,
      resolvedAtISO:
        new Date()
          .toISOString(),
      resolvedAt:
        serverTimestamp()
    }
  );
}
