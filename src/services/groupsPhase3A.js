import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";

import { auth, db } from "../firebase";
import { createNotification } from "./notifications.js";

async function requireUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be logged in.");
  }
  return user;
}

async function requireMembership(groupId) {
  const user = await requireUser();
  const memberRef = doc(
    db,
    "groups",
    String(groupId),
    "members",
    user.uid
  );
  const memberSnapshot = await getDoc(memberRef);

  if (
    !memberSnapshot.exists() ||
    ["removed", "suspended"].includes(memberSnapshot.data()?.status)
  ) {
    throw new Error("You are not an active member of this group.");
  }

  return {
    user,
    membership: {
      id: memberSnapshot.id,
      ...memberSnapshot.data()
    }
  };
}

async function publicProfile(userId) {
  if (!userId) return null;

  const snapshot = await getDoc(
    doc(db, "publicProfiles", String(userId))
  );

  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : null;
}

async function canModerateForum(groupId, membership) {
  if (["owner", "admin"].includes(membership.role)) {
    return true;
  }

  if (membership.role !== "moderator") {
    return false;
  }

  /*
   * Moderators remain valid for ordinary reading groups.
   * Classes intentionally expose only Primary Teacher,
   * Teacher, and Student permissions.
   */
  const groupSnapshot = await getDoc(
    doc(db, "groups", String(groupId))
  );

  return (
    groupSnapshot.exists() &&
    groupSnapshot.data()?.type !== "class"
  );
}

export async function updateGroupProfile(
  groupId,
  {
    name,
    description = "",
    avatar = "",
    type = "group",
    visibility = "private",
    joinPolicy = "invite_only"
  }
) {
  const { membership } = await requireMembership(groupId);

  if (!["owner", "admin"].includes(membership.role)) {
    throw new Error("Only owners and admins can edit group settings.");
  }

  const cleanName = String(name || "").trim();

  if (cleanName.length < 2) {
    throw new Error("Group name must be at least 2 characters.");
  }

  const cleanType =
    type === "class"
      ? "class"
      : "group";

  const cleanVisibility =
    ["private", "discoverable", "public"].includes(visibility)
      ? visibility
      : "private";

  const cleanJoinPolicy =
    [
      "invite_only",
      "request_to_join",
      "open"
    ].includes(joinPolicy)
      ? joinPolicy
      : "invite_only";

  const now = new Date().toISOString();

  await setDoc(
    doc(db, "groups", String(groupId)),
    {
      name: cleanName,
      description: String(description || "").trim(),
      avatar: String(avatar || "").trim(),
      type: cleanType,
      visibility: cleanVisibility,
      joinPolicy: cleanJoinPolicy,
      updatedAtISO: now,
      updatedAt: serverTimestamp(),
      lastActivityAtISO: now,
      lastActivityAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    name: cleanName,
    description: String(description || "").trim(),
    avatar: String(avatar || "").trim(),
    type: cleanType,
    visibility: cleanVisibility,
    joinPolicy: cleanJoinPolicy,
    updatedAtISO: now
  };
}

export async function getGroupForumPosts(groupId) {
  await requireMembership(groupId);

  const postsRef = collection(
    db,
    "groups",
    String(groupId),
    "forumPosts"
  );

  let snapshot;

  try {
    snapshot = await getDocs(
      query(
        postsRef,
        orderBy("createdAtISO", "desc")
      )
    );
  } catch {
    snapshot = await getDocs(postsRef);
  }

  const posts = await Promise.all(
    snapshot.docs.map(async (postDoc) => {
      const data = postDoc.data();

      return {
        id: postDoc.id,
        ...data,
        authorProfile: await publicProfile(data.userId)
      };
    })
  );

  return posts.sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) {
      return a.pinned ? -1 : 1;
    }

    const scoreDifference =
      Number(b.forumScore || 0) - Number(a.forumScore || 0);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const upDifference =
      Number(b.forumUpCount || 0) - Number(a.forumUpCount || 0);

    if (upDifference !== 0) {
      return upDifference;
    }

    return String(b.createdAtISO || "").localeCompare(
      String(a.createdAtISO || "")
    );
  });
}

export async function createGroupForumPost(
  groupId,
  {
    title,
    body,
    sourceChainEntry = null,
    sourceAssignment = null
  }
) {
  const { user } = await requireMembership(groupId);

  const cleanTitle = String(title || "").trim();
  const cleanBody = String(body || "").trim();

  if (cleanTitle.length < 2) {
    throw new Error("Add a topic title.");
  }

  if (!cleanBody) {
    throw new Error("Write something for the group.");
  }

  const postRef = doc(
    collection(
      db,
      "groups",
      String(groupId),
      "forumPosts"
    )
  );

  const now = new Date().toISOString();

  const post = {
    id: postRef.id,
    groupId: String(groupId),
    userId: user.uid,
    title: cleanTitle,
    body: cleanBody,
    pinned: false,
    locked: false,
    forumUpCount: 0,
    forumDownCount: 0,
    forumScore: 0,

    /*
     * Optional provenance for discussions created
     * from a Lit Chain post.
     */
    sourceChainEntryId:
      sourceChainEntry?.id
        ? String(sourceChainEntry.id)
        : null,

    sourceUserId:
      sourceChainEntry?.userId
        ? String(sourceChainEntry.userId)
        : null,

    sourceBookId:
      sourceChainEntry?.bookId
        ? String(sourceChainEntry.bookId)
        : null,

    sourceParagraphIndex:
      sourceChainEntry?.paragraphIndex !== undefined &&
      sourceChainEntry?.paragraphIndex !== null
        ? Math.max(
            Number(sourceChainEntry.paragraphIndex) || 0,
            0
          )
        : null,

    sourceParagraphNumber:
      sourceChainEntry?.paragraphNumber !== undefined &&
      sourceChainEntry?.paragraphNumber !== null
        ? Math.max(
            Number(sourceChainEntry.paragraphNumber) || 1,
            1
          )
        : null,

    sourceTitle:
      sourceChainEntry?.title
        ? String(sourceChainEntry.title).slice(0, 300)
        : null,

    sourceAuthor:
      sourceChainEntry?.author
        ? String(sourceChainEntry.author).slice(0, 300)
        : null,

    sourceNotePreview:
      sourceChainEntry?.note
        ? String(sourceChainEntry.note).slice(0, 1000)
        : null,

    sourceParagraphPreview:
      sourceChainEntry?.paragraphPreview
        ? String(sourceChainEntry.paragraphPreview).slice(0, 1000)
        : null,

    /*
     * Optional classroom provenance. This keeps discussions
     * attached to the assignment that created their Level 1.
     */
    sourceAssignmentId:
      sourceAssignment?.id
        ? String(sourceAssignment.id)
        : null,

    sourceAssignmentTitle:
      sourceAssignment?.title
        ? String(sourceAssignment.title).slice(0, 300)
        : null,

    sourceAssignmentBookId:
      sourceAssignment?.bookId
        ? String(sourceAssignment.bookId)
        : null,

    createdAtISO: now,
    updatedAtISO: now
  };

  await setDoc(
    postRef,
    {
      ...post,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  await setDoc(
    doc(db, "groups", String(groupId)),
    {
      lastActivityAtISO: now,
      lastActivityAt: serverTimestamp()
    },
    { merge: true }
  );

  return post;
}

export async function updateGroupForumPost(
  groupId,
  postId,
  updates
) {
  const {
    user,
    membership
  } = await requireMembership(groupId);

  const postRef = doc(
    db,
    "groups",
    String(groupId),
    "forumPosts",
    String(postId)
  );

  const snapshot = await getDoc(postRef);

  if (!snapshot.exists()) {
    throw new Error("Forum topic not found.");
  }

  const post = snapshot.data();

  const canModerate =
    await canModerateForum(
      groupId,
      membership
    );

  const isAuthor =
    post.userId === user.uid;

  if (!canModerate && !isAuthor) {
    throw new Error("You cannot edit this topic.");
  }

  const next = {
    updatedAtISO: new Date().toISOString(),
    updatedAt: serverTimestamp()
  };

  if (
    updates.title !== undefined &&
    isAuthor
  ) {
    const title =
      String(updates.title || "").trim();

    if (title.length < 2) {
      throw new Error("Add a topic title.");
    }

    next.title = title;
  }

  if (
    updates.body !== undefined &&
    isAuthor
  ) {
    const body =
      String(updates.body || "").trim();

    if (!body) {
      throw new Error("A topic cannot be empty.");
    }

    next.body = body;
  }

  if (
    updates.pinned !== undefined &&
    canModerate
  ) {
    next.pinned =
      Boolean(updates.pinned);
  }

  if (
    updates.locked !== undefined &&
    canModerate
  ) {
    next.locked =
      Boolean(updates.locked);
  }

  await updateDoc(
    postRef,
    next
  );

  return {
    id: String(postId),
    ...next
  };
}

export async function deleteGroupForumPost(
  groupId,
  postId
) {
  const {
    user,
    membership
  } = await requireMembership(groupId);

  const postRef = doc(
    db,
    "groups",
    String(groupId),
    "forumPosts",
    String(postId)
  );

  const snapshot =
    await getDoc(postRef);

  if (!snapshot.exists()) {
    return;
  }

  const post =
    snapshot.data();

  const canModerate =
    await canModerateForum(
      groupId,
      membership
    );

  if (
    !canModerate &&
    post.userId !== user.uid
  ) {
    throw new Error(
      "You cannot remove this topic."
    );
  }

  const repliesSnapshot =
    await getDocs(
      collection(
        db,
        "groups",
        String(groupId),
        "forumPosts",
        String(postId),
        "replies"
      )
    );

  await Promise.all(
    repliesSnapshot.docs.map(
      (replyDoc) =>
        deleteDoc(replyDoc.ref)
    )
  );

  await deleteDoc(postRef);
}

export async function deleteGroupForumReply(
  groupId,
  postId,
  replyId
) {
  const {
    user,
    membership
  } = await requireMembership(groupId);

  const replyRef = doc(
    db,
    "groups",
    String(groupId),
    "forumPosts",
    String(postId),
    "replies",
    String(replyId)
  );

  const snapshot =
    await getDoc(replyRef);

  if (!snapshot.exists()) {
    return;
  }

  const reply =
    snapshot.data();

  const canModerate =
    await canModerateForum(
      groupId,
      membership
    );

  if (
    !canModerate &&
    reply.userId !== user.uid
  ) {
    throw new Error(
      "You cannot remove this reply."
    );
  }

  await deleteDoc(replyRef);
}

export async function getGroupForumReplies(
  groupId,
  postId
) {
  await requireMembership(groupId);

  const repliesRef = collection(
    db,
    "groups",
    String(groupId),
    "forumPosts",
    String(postId),
    "replies"
  );

  let snapshot;

  try {
    snapshot = await getDocs(
      query(
        repliesRef,
        orderBy("createdAtISO", "asc")
      )
    );
  } catch {
    snapshot = await getDocs(repliesRef);
  }

  const replies = await Promise.all(
    snapshot.docs.map(
      async (replyDoc) => {
        const data = replyDoc.data();

        return {
          id: replyDoc.id,
          ...data,
          parentReplyId:
            data.parentReplyId || null,
          forumUpCount:
            Number(data.forumUpCount || 0),
          forumDownCount:
            Number(data.forumDownCount || 0),
          forumScore:
            Number(data.forumScore || 0),
          authorProfile:
            await publicProfile(data.userId)
        };
      }
    )
  );

  return replies.sort((a, b) => {
    const scoreDifference =
      Number(b.forumScore || 0) - Number(a.forumScore || 0);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const upDifference =
      Number(b.forumUpCount || 0) - Number(a.forumUpCount || 0);

    if (upDifference !== 0) {
      return upDifference;
    }

    return String(a.createdAtISO || "").localeCompare(
      String(b.createdAtISO || "")
    );
  });
}

export async function replyToGroupForumPost(
  groupId,
  postId,
  body,
  {
    parentReplyId = null
  } = {}
) {
  const { user } =
    await requireMembership(groupId);

  const postRef = doc(
    db,
    "groups",
    String(groupId),
    "forumPosts",
    String(postId)
  );

  const postSnapshot =
    await getDoc(postRef);

  if (!postSnapshot.exists()) {
    throw new Error(
      "Forum topic not found."
    );
  }

  if (postSnapshot.data()?.locked) {
    throw new Error(
      "This topic is locked."
    );
  }

  const cleanBody =
    String(body || "").trim();

  if (!cleanBody) {
    throw new Error(
      "Write a reply first."
    );
  }

  let parentReply = null;

  if (parentReplyId) {
    const parentSnapshot = await getDoc(
      doc(
        db,
        "groups",
        String(groupId),
        "forumPosts",
        String(postId),
        "replies",
        String(parentReplyId)
      )
    );

    if (!parentSnapshot.exists()) {
      throw new Error("That reply is no longer available.");
    }

    parentReply = {
      id: parentSnapshot.id,
      ...parentSnapshot.data()
    };
  }

  const replyRef = doc(
    collection(
      db,
      "groups",
      String(groupId),
      "forumPosts",
      String(postId),
      "replies"
    )
  );

  const now =
    new Date().toISOString();

  const reply = {
    id: replyRef.id,
    groupId: String(groupId),
    postId: String(postId),
    userId: user.uid,
    body: cleanBody,
    parentReplyId:
      parentReplyId ? String(parentReplyId) : null,
    forumUpCount: 0,
    forumDownCount: 0,
    forumScore: 0,
    createdAtISO: now,
    updatedAtISO: now
  };

  await setDoc(
    replyRef,
    {
      ...reply,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
  );

  Promise.allSettled([
    setDoc(
      postRef,
      {
        lastReplyAtISO: now,
        lastReplyAt: serverTimestamp(),
        updatedAtISO: now,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    ),

    setDoc(
      doc(
        db,
        "groups",
        String(groupId)
      ),
      {
        lastActivityAtISO: now,
        lastActivityAt: serverTimestamp()
      },
      { merge: true }
    )
  ]).then((results) => {
    results.forEach(
      (result) => {
        if (result.status === "rejected") {
          console.warn(
            "Forum reply metadata update failed:",
            result.reason
          );
        }
      }
    );
  });

  const postData = postSnapshot.data();
  const notificationRecipient =
    parentReply?.userId || postData?.userId || null;

  if (
    notificationRecipient &&
    notificationRecipient !== user.uid
  ) {
    (async () => {
      try {
        const groupSnapshot = await getDoc(
          doc(db, "groups", String(groupId))
        );

        await createNotification({
          recipientUserId: notificationRecipient,
          type: "forum_reply",
          actorUserId: user.uid,
          groupId: String(groupId),
          groupName: groupSnapshot.exists()
            ? groupSnapshot.data()?.name || ""
            : "",
          postId: String(postId),
          targetPath: `/read/groups/${groupId}`
        });
      } catch (error) {
        console.warn(
          "Forum reply notification failed:",
          error
        );
      }
    })();
  }

  return reply;
}

function groupForumVoteId(targetType, targetId, voterUserId) {
  return `${targetType}_${targetId}_${voterUserId}`;
}

export async function getMyGroupForumVote(
  groupId,
  {
    targetType,
    targetId
  }
) {
  const { user } = await requireMembership(groupId);

  const cleanType = targetType === "reply" ? "reply" : "post";
  const voteId = groupForumVoteId(
    cleanType,
    String(targetId),
    user.uid
  );

  const snapshot = await getDoc(
    doc(
      db,
      "groups",
      String(groupId),
      "forumVotes",
      voteId
    )
  );

  return snapshot.exists()
    ? Number(snapshot.data()?.direction || 0)
    : 0;
}

export async function voteOnGroupForumNode(
  groupId,
  postId,
  {
    replyId = null,
    direction
  }
) {
  const { user } = await requireMembership(groupId);

  const requestedDirection =
    direction === -1 ? -1 : 1;

  const targetType = replyId ? "reply" : "post";
  const targetId = String(replyId || postId);
  const voteId = groupForumVoteId(
    targetType,
    targetId,
    user.uid
  );

  const targetRef = replyId
    ? doc(
        db,
        "groups",
        String(groupId),
        "forumPosts",
        String(postId),
        "replies",
        String(replyId)
      )
    : doc(
        db,
        "groups",
        String(groupId),
        "forumPosts",
        String(postId)
      );

  const voteRef = doc(
    db,
    "groups",
    String(groupId),
    "forumVotes",
    voteId
  );

  const result = await runTransaction(
    db,
    async (transaction) => {
      const [targetSnapshot, voteSnapshot] = await Promise.all([
        transaction.get(targetRef),
        transaction.get(voteRef)
      ]);

      if (!targetSnapshot.exists()) {
        throw new Error("That discussion item is no longer available.");
      }

      const target = targetSnapshot.data();
      const oldDirection = voteSnapshot.exists()
        ? Number(voteSnapshot.data()?.direction || 0)
        : 0;
      const newDirection =
        oldDirection === requestedDirection
          ? 0
          : requestedDirection;

      let up = Number(target.forumUpCount || 0);
      let down = Number(target.forumDownCount || 0);

      if (oldDirection === 1) up -= 1;
      if (oldDirection === -1) down -= 1;
      if (newDirection === 1) up += 1;
      if (newDirection === -1) down += 1;

      up = Math.max(0, up);
      down = Math.max(0, down);
      const score = up - down;

      transaction.update(targetRef, {
        forumUpCount: up,
        forumDownCount: down,
        forumScore: score
      });

      if (newDirection === 0) {
        transaction.delete(voteRef);
      } else if (voteSnapshot.exists()) {
        transaction.update(voteRef, {
          direction: newDirection,
          updatedAtISO: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });
      } else {
        transaction.set(voteRef, {
          id: voteId,
          groupId: String(groupId),
          postId: String(postId),
          replyId: replyId ? String(replyId) : null,
          targetType,
          targetId,
          voterUserId: user.uid,
          direction: newDirection,
          createdAtISO: new Date().toISOString(),
          createdAt: serverTimestamp(),
          updatedAtISO: new Date().toISOString(),
          updatedAt: serverTimestamp()
        });
      }

      return {
        direction: newDirection,
        forumUpCount: up,
        forumDownCount: down,
        forumScore: score
      };
    }
  );

  return result;
}

