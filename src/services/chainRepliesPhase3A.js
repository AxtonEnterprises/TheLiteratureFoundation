import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
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

async function requireGroupMember(groupId, userId) {
  if (!groupId || !userId) {
    throw new Error("Missing group membership information.");
  }

  const snapshot = await getDoc(
    doc(
      db,
      "groups",
      String(groupId),
      "members",
      String(userId)
    )
  );

  if (
    !snapshot.exists() ||
    ["removed", "suspended"].includes(snapshot.data()?.status)
  ) {
    throw new Error("You are not an active member of this group.");
  }

  return snapshot.data();
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

export async function replyToMargin(
  entry,
  {
    note,
    visibility,
    groupId = null,
    parentReplyId = null
  }
) {
  if (!entry?.id || !entry?.userId) {
    throw new Error("Missing parent margin.");
  }

  const cleanNote = String(note || "").trim();
  if (!cleanNote) {
    throw new Error("A reply cannot be empty.");
  }

  const user = await requireUser();

  // Replies always inherit the parent Margin's visibility.
  const normalizedVisibility =
    entry.visibility === "group"
      ? "group"
      : entry.visibility === "private"
        ? "private"
        : "public";

  const inheritedGroupId =
    normalizedVisibility === "group"
      ? String(entry.groupId || groupId || "")
      : null;

  if (normalizedVisibility === "group") {
    if (!inheritedGroupId) {
      throw new Error("This group Margin is missing its group.");
    }
    await requireGroupMember(inheritedGroupId, user.uid);
  }

  const replyRef = doc(collection(db, "marginReplies"));
  const now = new Date().toISOString();

  const reply = {
    id: replyRef.id,
    userId: user.uid,
    parentEntryId: String(entry.id),
    parentUserId: String(entry.userId),
    parentReplyId: parentReplyId
      ? String(parentReplyId)
      : null,
    bookId: entry.bookId ? String(entry.bookId) : null,
    title: entry.title || "Untitled",
    author: entry.author || "",
    note: cleanNote,
    visibility: normalizedVisibility,
    groupId:
      normalizedVisibility === "group"
        ? inheritedGroupId
        : null,
    createdAtISO: now
  };

  await setDoc(replyRef, {
    ...reply,
    createdAt: serverTimestamp()
  });

  await createNotification({
    recipientUserId: String(entry.userId),
    type:
      normalizedVisibility === "group"
        ? "group_margin_reply"
        : "margin_reply",
    actorUserId: user.uid,
    groupId: inheritedGroupId,
    marginId: String(entry.id),
    targetPath:
      normalizedVisibility === "group"
        ? "/read/margins?tab=groups"
        : "/read/margins"
  });

  return reply;
}

export async function getMarginReplies(entry) {
  if (!entry?.id) {
    return [];
  }

  const parentEntryId = String(entry.id);
  const repliesRef = collection(db, "marginReplies");
  const user = auth.currentUser;
  const replies = [];

  if (entry.visibility === "group" || entry.groupId) {
    if (!user || !entry.groupId) {
      return [];
    }

    await requireGroupMember(entry.groupId, user.uid);

    const snapshot = await getDocs(
      query(
        repliesRef,
        where("parentEntryId", "==", parentEntryId),
        where("visibility", "==", "group"),
        where("groupId", "==", String(entry.groupId))
      )
    );

    replies.push(
      ...snapshot.docs.map((replyDoc) => ({
        id: replyDoc.id,
        ...replyDoc.data()
      }))
    );
  } else {
    const publicSnapshot = await getDocs(
      query(
        repliesRef,
        where("parentEntryId", "==", parentEntryId),
        where("visibility", "==", "public")
      )
    );

    replies.push(
      ...publicSnapshot.docs.map((replyDoc) => ({
        id: replyDoc.id,
        ...replyDoc.data()
      }))
    );

    if (user) {
      const privateSnapshot = await getDocs(
        query(
          repliesRef,
          where("parentEntryId", "==", parentEntryId),
          where("visibility", "==", "private"),
          where("userId", "==", user.uid)
        )
      );

      replies.push(
        ...privateSnapshot.docs.map((replyDoc) => ({
          id: replyDoc.id,
          ...replyDoc.data()
        }))
      );
    }
  }

  const enriched = await Promise.all(
    replies.map(async (reply) => ({
      ...reply,
      reader: await publicProfile(reply.userId)
    }))
  );

  return enriched.sort((a, b) =>
    String(a.createdAtISO || "").localeCompare(
      String(b.createdAtISO || "")
    )
  );
}

export async function deleteMarginReply(reply) {
  if (!reply?.id) {
    throw new Error("Missing reply.");
  }

  const user = await requireUser();
  const replyRef = doc(
    db,
    "marginReplies",
    String(reply.id)
  );

  const snapshot = await getDoc(replyRef);

  if (!snapshot.exists()) {
    return;
  }

  const storedReply = snapshot.data();

  if (storedReply.userId === user.uid) {
    await deleteDoc(replyRef);
    return;
  }

  if (
    storedReply.visibility !== "group" ||
    !storedReply.groupId
  ) {
    throw new Error("You cannot remove this reply.");
  }

  const membership = await requireGroupMember(
    storedReply.groupId,
    user.uid
  );

  if (
    !["owner", "admin", "moderator"].includes(
      membership.role
    )
  ) {
    throw new Error("Only group moderators can remove this reply.");
  }

  await deleteDoc(replyRef);
}

