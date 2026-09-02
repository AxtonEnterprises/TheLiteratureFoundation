import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
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

import {
  reportPlatformContent
} from "./platformModeration.js";


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

  /*
   * Public Chain posts are platform content and go to the
   * global moderation queue. Group-only Chain posts keep
   * using the existing Phase 4.2 group moderation system.
   */
  if (
    entry.visibility === "public" &&
    !entry.groupId
  ) {
    return reportPlatformContent({
      targetType:
        "chain_entry",
      targetId:
        String(
          entry.id
        ),
      targetUserId:
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
      title:
        entry.title ||
        "Untitled",
      body:
        entry.note ||
        "",
      bookId:
        entry.bookId
          ? String(
              entry.bookId
            )
          : null
    });
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


/* ============================================================
   PHASE 5C — PROVENANCE / IDEA CHAIN
============================================================ */


/* ========================================================
   PHASE 5C — CHAIN VOTING
   ======================================================== */

function voteDocumentId(entry, voterUserId) {
  return [
    entry?.userId || "",
    entry?.id || "",
    voterUserId || ""
  ].join("_");
}

export function chainVoteScore(entry) {
  const score = Number(entry?.chainScore);
  return Number.isFinite(score) ? score : 0;
}

export function chainUpCount(entry) {
  const count = Number(entry?.chainUpCount);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export function chainDownCount(entry) {
  const count = Number(entry?.chainDownCount);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}

export function sortChainEntriesByVote(entries = []) {
  return [...entries].sort((a, b) => {
    const scoreDifference = chainVoteScore(b) - chainVoteScore(a);
    if (scoreDifference !== 0) return scoreDifference;

    const upDifference = chainUpCount(b) - chainUpCount(a);
    if (upDifference !== 0) return upDifference;

    const aDate = String(a?.updatedAtISO || a?.createdAt || "");
    const bDate = String(b?.updatedAtISO || b?.createdAt || "");
    return bDate.localeCompare(aDate);
  });
}

export async function getMyChainVotes(entries = []) {
  const user = auth.currentUser;
  if (!user || !entries.length) return {};

  const result = {};

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry?.id || !entry?.userId) return;

      try {
        const voteRef = doc(
          db,
          "chainVotes",
          voteDocumentId(entry, user.uid)
        );
        const snapshot = await getDoc(voteRef);

        if (snapshot.exists()) {
          const direction = Number(snapshot.data()?.direction);
          if (direction === 1 || direction === -1) {
            result[chainEntryKey(entry)] = direction;
          }
        }
      } catch (error) {
        console.warn("Could not load Chain vote:", error);
      }
    })
  );

  return result;
}

export async function voteOnChainEntry(entry, requestedDirection) {
  const user = await requireUser();

  const direction = Number(requestedDirection);
  if (direction !== 1 && direction !== -1) {
    throw new Error("Invalid Chain vote.");
  }

  if (!entry?.id || !entry?.userId) {
    throw new Error("This Chain entry cannot be voted on.");
  }

  const entryRef = doc(
    db,
    "users",
    String(entry.userId),
    "journal",
    String(entry.id)
  );

  const voteId = voteDocumentId(entry, user.uid);
  const voteRef = doc(db, "chainVotes", voteId);

  return runTransaction(db, async (transaction) => {
    const [entrySnapshot, voteSnapshot] = await Promise.all([
      transaction.get(entryRef),
      transaction.get(voteRef)
    ]);

    if (!entrySnapshot.exists()) {
      throw new Error("This Chain entry no longer exists.");
    }

    const currentEntry = entrySnapshot.data();
    const previousDirection = voteSnapshot.exists()
      ? Number(voteSnapshot.data()?.direction) || 0
      : 0;

    // Tapping the same vote again clears it.
    const nextDirection =
      previousDirection === direction
        ? 0
        : direction;

    let upCount = Number(currentEntry.chainUpCount) || 0;
    let downCount = Number(currentEntry.chainDownCount) || 0;
    let score = Number(currentEntry.chainScore) || 0;

    if (previousDirection === 1) {
      upCount = Math.max(0, upCount - 1);
      score -= 1;
    } else if (previousDirection === -1) {
      downCount = Math.max(0, downCount - 1);
      score += 1;
    }

    if (nextDirection === 1) {
      upCount += 1;
      score += 1;
    } else if (nextDirection === -1) {
      downCount += 1;
      score -= 1;
    }

    transaction.update(entryRef, {
      chainUpCount: upCount,
      chainDownCount: downCount,
      chainScore: score
    });

    if (nextDirection === 0) {
      if (voteSnapshot.exists()) {
        transaction.delete(voteRef);
      }
    } else {
      transaction.set(voteRef, {
        id: voteId,
        voterUserId: user.uid,
        targetUserId: String(entry.userId),
        targetEntryId: String(entry.id),
        direction: nextDirection,
        createdAtISO:
          voteSnapshot.exists()
            ? voteSnapshot.data()?.createdAtISO || new Date().toISOString()
            : new Date().toISOString(),
        createdAt:
          voteSnapshot.exists()
            ? voteSnapshot.data()?.createdAt || serverTimestamp()
            : serverTimestamp(),
        updatedAtISO: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });
    }

    return {
      direction: nextDirection,
      chainUpCount: upCount,
      chainDownCount: downCount,
      chainScore: score
    };
  });
}

function sameEntry(entry, userId, entryId) {
  return (
    String(entry?.userId || "") === String(userId || "") &&
    String(entry?.id || "") === String(entryId || "")
  );
}

function isDerivedFrom(entry, sourceEntry) {
  if (!entry || !sourceEntry) return false;

  const sourceEntryId = String(sourceEntry.id || "");
  const sourceUserId = String(sourceEntry.userId || "");

  return (
    String(entry.sourceChainEntryId || "") === sourceEntryId &&
    (
      !entry.sourceUserId ||
      !sourceUserId ||
      String(entry.sourceUserId) === sourceUserId
    )
  );
}

async function enrichChainEntries(entries) {
  const userIds = [
    ...new Set(
      entries
        .map((entry) => entry?.userId)
        .filter(Boolean)
        .map(String)
    )
  ];

  const profilePairs = await Promise.all(
    userIds.map(async (userId) => {
      try {
        return [userId, await getPublicProfile(userId)];
      } catch (error) {
        console.error(`Could not load public profile ${userId}:`, error);
        return [userId, null];
      }
    })
  );

  const profiles = new Map(profilePairs);

  return entries.map((entry) => ({
    ...entry,
    reader: profiles.get(String(entry.userId || "")) || null
  }));
}

export async function getChainEntry(userId, entryId) {
  if (!userId || !entryId) return null;

  const snapshot = await getDoc(
    doc(
      db,
      "users",
      String(userId),
      "journal",
      String(entryId)
    )
  );

  if (!snapshot.exists()) return null;

  const entry = normalizeChainEntry({
    id: snapshot.id,
    ...snapshot.data()
  });

  if (!entry) return null;

  const viewer = auth.currentUser;
  const isOwner = viewer?.uid === String(entry.userId || userId);

  if (entry.visibility === "private" && !isOwner) {
    return null;
  }

  if (entry.visibility === "group" && !isOwner) {
    if (!viewer || !entry.groupId) return null;

    const membership = await getGroupMemberRecord(
      entry.groupId,
      viewer.uid
    );

    if (
      !membership ||
      ["removed", "suspended"].includes(membership.status)
    ) {
      return null;
    }
  }

  const [enriched] = await enrichChainEntries([entry]);
  return enriched || null;
}

const CHAIN_BRANCH_CACHE_TTL_MS = 90_000;
const chainBranchCache = new Map();
const chainBranchInFlight = new Map();

function chainBranchCacheKey(sourceEntry) {
  return [
    auth.currentUser?.uid || "guest",
    sourceEntry?.userId || "",
    sourceEntry?.id || ""
  ].join("_");
}

function readChainBranchCache(sourceEntry) {
  const key = chainBranchCacheKey(sourceEntry);
  const cached = chainBranchCache.get(key);

  if (!cached) return null;

  if (Date.now() - cached.savedAt > CHAIN_BRANCH_CACHE_TTL_MS) {
    chainBranchCache.delete(key);
    return null;
  }

  return cached.value;
}

function writeChainBranchCache(sourceEntry, value) {
  chainBranchCache.set(chainBranchCacheKey(sourceEntry), {
    savedAt: Date.now(),
    value
  });
  return value;
}

export function prefetchChainBranches(sourceEntry) {
  if (!sourceEntry?.id) return Promise.resolve(null);

  return getChainBranches(sourceEntry).catch((error) => {
    console.warn("Could not prefetch Chain branches:", error);
    return null;
  });
}

export async function getChainBranches(sourceEntry) {
  if (!sourceEntry?.id) {
    return {
      notes: [],
      noteCount: 0,
      groupDiscussions: [],
      groupDiscussionCount: 0
    };
  }

  const cached = readChainBranchCache(sourceEntry);
  if (cached) return cached;

  const cacheKey = chainBranchCacheKey(sourceEntry);
  if (chainBranchInFlight.has(cacheKey)) {
    return chainBranchInFlight.get(cacheKey);
  }

  const loadPromise = (async () => {
  const sourceId = String(sourceEntry.id);
  const viewer = auth.currentUser;

  /*
   * Firestore security rules are not post-query filters.
   * We therefore query only datasets the viewer is already
   * authorized to read instead of querying every matching
   * sourceChainEntryId across all journal documents.
   */

  const visibleNotesByKey = new Map();

  // Public branches: this query shape is already authorized by
  // the public collection-group journal rule.
  try {
    const publicSnapshot = await getDocs(
      query(
        collectionGroup(db, "journal"),
        where("visibility", "==", "public")
      )
    );

    for (const entryDoc of publicSnapshot.docs) {
      const entry = normalizeChainEntry({
        id: entryDoc.id,
        ...entryDoc.data()
      });

      if (
        entry &&
        String(entry.sourceChainEntryId || "") === sourceId &&
        !sameEntry(entry, sourceEntry.userId, sourceEntry.id) &&
        isDerivedFrom(entry, sourceEntry)
      ) {
        visibleNotesByKey.set(
          `${entry.userId || ""}_${entry.id}`,
          entry
        );
      }
    }
  } catch (error) {
    console.warn("Could not load public Chain branches:", error);
  }

  let viewerGroups = [];

  if (viewer) {
    try {
      viewerGroups = await getMyGroups();
    } catch (error) {
      console.warn("Could not load Chain group memberships:", error);
      viewerGroups = [];
    }

    // The viewer's own journal can be queried directly and safely,
    // including private notes.
    try {
      const ownSnapshot = await getDocs(
        query(
          collection(db, "users", viewer.uid, "journal"),
          where("sourceChainEntryId", "==", sourceId)
        )
      );

      for (const entryDoc of ownSnapshot.docs) {
        const entry = normalizeChainEntry({
          id: entryDoc.id,
          ...entryDoc.data()
        });

        if (
          entry &&
          !sameEntry(entry, sourceEntry.userId, sourceEntry.id) &&
          isDerivedFrom(entry, sourceEntry)
        ) {
          visibleNotesByKey.set(
            `${entry.userId || viewer.uid}_${entry.id}`,
            entry
          );
        }
      }
    } catch (error) {
      console.warn("Could not load personal Chain branches:", error);
    }

    // Resolve visible group branches in parallel across known memberships.
    await Promise.all(
      viewerGroups.map(async (group) => {
        const groupId = String(group.id || group.groupId || "");
        if (!groupId) return;

        try {
          const groupJournalSnapshot = await getDocs(
            query(
              collectionGroup(db, "journal"),
              where("groupId", "==", groupId),
              where("visibility", "==", "group")
            )
          );

          for (const entryDoc of groupJournalSnapshot.docs) {
            const entry = normalizeChainEntry({
              id: entryDoc.id,
              ...entryDoc.data()
            });

            if (
              entry &&
              String(entry.sourceChainEntryId || "") === sourceId &&
              !sameEntry(entry, sourceEntry.userId, sourceEntry.id) &&
              isDerivedFrom(entry, sourceEntry)
            ) {
              visibleNotesByKey.set(
                `${entry.userId || ""}_${entry.id}`,
                {
                  ...entry,
                  group: {
                    id: groupId,
                    name: group.name || "Reading Group",
                    type: group.type || "group",
                    avatar: group.avatar || "",
                    membership: group.membership || null
                  }
                }
              );
            }
          }
        } catch (error) {
          console.warn(
            `Could not load Chain branches for group ${groupId}:`,
            error
          );
        }
      })
    );
  }

  const enrichedNotes = sortChainEntriesByVote(
    await enrichChainEntries(
      [...visibleNotesByKey.values()]
    )
  );

  const groupDiscussions = [];

  if (viewer) {
    await Promise.all(
      viewerGroups.map(async (group) => {
        const groupId = String(group.id || group.groupId || "");
        if (!groupId) return;

        try {
          const forumSnapshot = await getDocs(
            query(
              collection(db, "groups", groupId, "forumPosts"),
              where("sourceChainEntryId", "==", sourceId)
            )
          );

          for (const postDoc of forumSnapshot.docs) {
            groupDiscussions.push({
              id: postDoc.id,
              ...postDoc.data(),
              nodeType: "group",
              groupId,
              group: {
                id: groupId,
                name: group.name || "Reading Group",
                type: group.type || "group",
                avatar: group.avatar || ""
              }
            });
          }
        } catch (error) {
          console.warn(
            `Could not load Chain discussion branches for group ${groupId}:`,
            error
          );
        }
      })
    );
  }

  const result = {
    notes: enrichedNotes,
    noteCount: enrichedNotes.length,
    groupDiscussions,
    groupDiscussionCount: groupDiscussions.length
  };

  return writeChainBranchCache(sourceEntry, result);
  })();

  chainBranchInFlight.set(cacheKey, loadPromise);

  try {
    return await loadPromise;
  } finally {
    chainBranchInFlight.delete(cacheKey);
  }
}

export async function getChainProvenance(entry) {
  if (!entry) {
    return {
      source: null,
      branches: {
        notes: [],
        noteCount: 0,
        groupDiscussions: [],
        groupDiscussionCount: 0
      }
    };
  }

  const source =
    entry.sourceChainEntryId && entry.sourceUserId
      ? await getChainEntry(
          entry.sourceUserId,
          entry.sourceChainEntryId
        )
      : null;

  const branches = await getChainBranches(entry);

  return {
    source,
    branches
  };
}
