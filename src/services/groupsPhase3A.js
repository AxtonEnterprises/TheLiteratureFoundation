import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
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

  const cleanType = type === "class" ? "class" : "group";
  const cleanVisibility = ["private", "discoverable", "public"].includes(
    visibility
  )
    ? visibility
    : "private";
  const cleanJoinPolicy = [
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
      query(postsRef, orderBy("createdAtISO", "desc"))
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
    return String(b.createdAtISO || "").localeCompare(
      String(a.createdAtISO || "")
    );
  });
}

export async function createGroupForumPost(
  groupId,
  { title, body }
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
    createdAtISO: now,
    updatedAtISO: now
  };

  await setDoc(postRef, {
    ...post,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

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
  const { user, membership } = await requireMembership(groupId);
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
  const canModerate = await canModerateForum(
    groupId,
    membership
  );
  const isAuthor = post.userId === user.uid;

  if (!canModerate && !isAuthor) {
    throw new Error("You cannot edit this topic.");
  }

  const next = {
    updatedAtISO: new Date().toISOString(),
    updatedAt: serverTimestamp()
  };

  if (updates.title !== undefined && isAuthor) {
    const title = String(updates.title || "").trim();
    if (title.length < 2) throw new Error("Add a topic title.");
    next.title = title;
  }

  if (updates.body !== undefined && isAuthor) {
    const body = String(updates.body || "").trim();
    if (!body) throw new Error("A topic cannot be empty.");
    next.body = body;
  }

  if (updates.pinned !== undefined && canModerate) {
    next.pinned = Boolean(updates.pinned);
  }

  if (updates.locked !== undefined && canModerate) {
    next.locked = Boolean(updates.locked);
  }

  await updateDoc(postRef, next);
  return { id: String(postId), ...next };
}

export async function deleteGroupForumPost(groupId, postId) {
  const { user, membership } = await requireMembership(groupId);
  const postRef = doc(
    db,
    "groups",
    String(groupId),
    "forumPosts",
    String(postId)
  );
  const snapshot = await getDoc(postRef);

  if (!snapshot.exists()) return;

  const post = snapshot.data();
  const canModerate = await canModerateForum(
    groupId,
    membership
  );

  if (!canModerate && post.userId !== user.uid) {
    throw new Error("You cannot remove this topic.");
  }

  const repliesSnapshot = await getDocs(
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
    repliesSnapshot.docs.map((replyDoc) =>
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
  const { user, membership } = await requireMembership(groupId);

  const replyRef = doc(
    db,
    "groups",
    String(groupId),
    "forumPosts",
    String(postId),
    "replies",
    String(replyId)
  );

  const snapshot = await getDoc(replyRef);

  if (!snapshot.exists()) {
    return;
  }

  const reply = snapshot.data();
  const canModerate = await canModerateForum(
    groupId,
    membership
  );

  if (!canModerate && reply.userId !== user.uid) {
    throw new Error("You cannot remove this reply.");
  }

  await deleteDoc(replyRef);
}

export async function getGroupForumReplies(groupId, postId) {
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
      query(repliesRef, orderBy("createdAtISO", "asc"))
    );
  } catch {
    snapshot = await getDocs(repliesRef);
  }

  return Promise.all(
    snapshot.docs.map(async (replyDoc) => {
      const data = replyDoc.data();
      return {
        id: replyDoc.id,
        ...data,
        authorProfile: await publicProfile(data.userId)
      };
    })
  );
}

export async function replyToGroupForumPost(
  groupId,
  postId,
  body
) {
  const { user } = await requireMembership(groupId);

  const postRef = doc(
    db,
    "groups",
    String(groupId),
    "forumPosts",
    String(postId)
  );

  const postSnapshot = await getDoc(postRef);

  if (!postSnapshot.exists()) {
    throw new Error("Forum topic not found.");
  }

  if (postSnapshot.data()?.locked) {
    throw new Error("This topic is locked.");
  }

  const cleanBody = String(body || "").trim();

  if (!cleanBody) {
    throw new Error("Write a reply first.");
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

  const now = new Date().toISOString();

  const reply = {
    id: replyRef.id,
    groupId: String(groupId),
    postId: String(postId),
    userId: user.uid,
    body: cleanBody,
    createdAtISO: now,
    updatedAtISO: now
  };

  // The reply itself is the only required write.
  await setDoc(replyRef, {
    ...reply,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Activity metadata is useful but must not turn a successful
  // reply into a false error message for the student.
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
      doc(db, "groups", String(groupId)),
      {
        lastActivityAtISO: now,
        lastActivityAt: serverTimestamp()
      },
      { merge: true }
    )
  ]).then((results) => {
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn(
          "Forum reply metadata update failed:",
          result.reason
        );
      }
    });
  });

  // Notifications are also best-effort. Notification permissions
  // should never make a successfully-posted reply appear to fail.
  const postData = postSnapshot.data();

  if (postData?.userId && postData.userId !== user.uid) {
    (async () => {
      try {
        const groupSnapshot = await getDoc(
          doc(db, "groups", String(groupId))
        );

        await createNotification({
          recipientUserId: postData.userId,
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
