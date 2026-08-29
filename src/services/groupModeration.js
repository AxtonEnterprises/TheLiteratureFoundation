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

const ROLE_RANK = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1
};

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  return user;
}

async function membership(groupId, userId) {
  const snapshot = await getDoc(
    doc(
      db,
      "groups",
      String(groupId),
      "members",
      String(userId)
    )
  );

  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : null;
}

async function groupData(groupId) {
  const snapshot = await getDoc(
    doc(db, "groups", String(groupId))
  );

  return snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : null;
}

async function publicProfile(userId) {
  if (!userId) return null;

  try {
    const snapshot = await getDoc(
      doc(
        db,
        "publicProfiles",
        String(userId)
      )
    );

    return snapshot.exists()
      ? { id: snapshot.id, ...snapshot.data() }
      : null;
  } catch {
    return null;
  }
}

export function canDisciplineRole(
  actorRole,
  targetRole
) {
  const actor = ROLE_RANK[actorRole] || 0;
  const target = ROLE_RANK[targetRole] || 1;

  return (
    actor >= ROLE_RANK.moderator &&
    target < actor &&
    targetRole !== "owner"
  );
}

async function requireModerator(
  groupId,
  targetUserId = null
) {
  const user = requireUser();

  const actorMembership =
    await membership(groupId, user.uid);

  if (
    !actorMembership ||
    !["owner", "admin", "moderator"].includes(
      actorMembership.role
    )
  ) {
    throw new Error(
      "You do not have moderation access."
    );
  }

  if (targetUserId) {
    const targetMembership =
      await membership(
        groupId,
        targetUserId
      );

    const targetRole =
      targetMembership?.role || "member";

    if (
      !canDisciplineRole(
        actorMembership.role,
        targetRole
      )
    ) {
      throw new Error(
        "Your role cannot discipline this member."
      );
    }

    return {
      user,
      actorMembership,
      targetMembership
    };
  }

  return { user, actorMembership };
}

async function logAction(
  groupId,
  {
    action,
    targetUserId = null,
    contentType = null,
    contentId = null,
    reportId = null,
    reason = "",
    details = ""
  }
) {
  const user = requireUser();

  const ref = doc(
    collection(
      db,
      "groups",
      String(groupId),
      "moderationActions"
    )
  );

  const now = new Date().toISOString();

  await setDoc(ref, {
    id: ref.id,
    groupId: String(groupId),
    moderatorUserId: user.uid,
    action: String(action),
    targetUserId:
      targetUserId
        ? String(targetUserId)
        : null,
    contentType:
      contentType
        ? String(contentType)
        : null,
    contentId:
      contentId
        ? String(contentId)
        : null,
    reportId:
      reportId
        ? String(reportId)
        : null,
    reason: String(reason || "").trim(),
    details: String(details || "").trim(),
    createdAtISO: now,
    createdAt: serverTimestamp()
  });
}

export async function reportGroupForumContent(
  groupId,
  {
    contentType,
    postId,
    replyId = null,
    reportedUserId,
    title = "",
    body = "",
    reason = "other",
    details = ""
  }
) {
  const user = requireUser();

  const ownMembership =
    await membership(groupId, user.uid);

  if (
    !ownMembership ||
    ["removed", "suspended"].includes(
      ownMembership.status
    )
  ) {
    throw new Error(
      "Only active group members can report content."
    );
  }

  if (
    !["forum_post", "forum_reply"].includes(
      contentType
    )
  ) {
    throw new Error(
      "Unsupported report type."
    );
  }

  const reportRef = doc(
    collection(
      db,
      "groups",
      String(groupId),
      "moderationReports"
    )
  );

  const now = new Date().toISOString();

  const report = {
    id: reportRef.id,
    groupId: String(groupId),
    reporterUserId: user.uid,
    reportedUserId:
      String(reportedUserId),
    contentType,
    postId: String(postId),
    replyId:
      replyId ? String(replyId) : null,
    contentId:
      contentType === "forum_reply"
        ? String(replyId)
        : String(postId),
    title: String(title || ""),
    body: String(body || ""),
    reason: String(reason || "other"),
    details: String(details || "").trim(),
    status: "open",
    createdAtISO: now
  };

  await setDoc(reportRef, {
    ...report,
    createdAt: serverTimestamp()
  });

  return report;
}

export async function getForumModerationReports(
  groupId
) {
  await requireModerator(groupId);

  const reportsRef = collection(
    db,
    "groups",
    String(groupId),
    "moderationReports"
  );

  let snapshot;

  try {
    snapshot = await getDocs(
      query(
        reportsRef,
        orderBy("createdAtISO", "desc")
      )
    );
  } catch {
    snapshot = await getDocs(reportsRef);
  }

  const reports = snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data()
    }))
    .filter((item) => item.status === "open");

  return Promise.all(
    reports.map(async (report) => ({
      ...report,
      reporterProfile:
        await publicProfile(
          report.reporterUserId
        ),
      reportedProfile:
        await publicProfile(
          report.reportedUserId
        )
    }))
  );
}

export async function resolveForumModerationReport(
  groupId,
  reportId,
  resolution = "resolved"
) {
  const { user } =
    await requireModerator(groupId);

  const reportRef = doc(
    db,
    "groups",
    String(groupId),
    "moderationReports",
    String(reportId)
  );

  const snapshot = await getDoc(reportRef);

  if (!snapshot.exists()) return;

  const now = new Date().toISOString();

  await updateDoc(reportRef, {
    status:
      resolution === "dismissed"
        ? "dismissed"
        : "resolved",
    resolvedBy: user.uid,
    resolvedAtISO: now,
    resolvedAt: serverTimestamp()
  });

  await logAction(groupId, {
    action:
      resolution === "dismissed"
        ? "report_dismissed"
        : "report_resolved",
    targetUserId:
      snapshot.data()?.reportedUserId,
    contentType:
      snapshot.data()?.contentType,
    contentId:
      snapshot.data()?.contentId,
    reportId
  });
}

export async function removeReportedForumContent(
  groupId,
  report
) {
  await requireModerator(
    groupId,
    report?.reportedUserId
  );

  if (!report?.id || !report?.postId) {
    throw new Error(
      "Invalid moderation report."
    );
  }

  if (
    report.contentType === "forum_reply"
  ) {
    if (!report.replyId) {
      throw new Error("Missing reply ID.");
    }

    await deleteDoc(
      doc(
        db,
        "groups",
        String(groupId),
        "forumPosts",
        String(report.postId),
        "replies",
        String(report.replyId)
      )
    );
  } else {
    const repliesSnapshot =
      await getDocs(
        collection(
          db,
          "groups",
          String(groupId),
          "forumPosts",
          String(report.postId),
          "replies"
        )
      );

    await Promise.all(
      repliesSnapshot.docs.map(
        (reply) => deleteDoc(reply.ref)
      )
    );

    await deleteDoc(
      doc(
        db,
        "groups",
        String(groupId),
        "forumPosts",
        String(report.postId)
      )
    );
  }

  await logAction(groupId, {
    action: "content_removed",
    targetUserId:
      report.reportedUserId,
    contentType:
      report.contentType,
    contentId:
      report.contentId,
    reportId: report.id,
    reason: report.reason,
    details: report.details
  });

  await resolveForumModerationReport(
    groupId,
    report.id,
    "resolved"
  );
}

export async function issueGroupWarning(
  groupId,
  targetUserId,
  reason
) {
  const { user } =
    await requireModerator(
      groupId,
      targetUserId
    );

  const cleanReason =
    String(reason || "").trim();

  if (!cleanReason) {
    throw new Error(
      "Add a reason for the warning."
    );
  }

  const group = await groupData(groupId);

  await logAction(groupId, {
    action: "warning",
    targetUserId,
    reason: cleanReason
  });

  createNotification({
    recipientUserId:
      String(targetUserId),
    type: "group_warning",
    actorUserId: user.uid,
    groupId: String(groupId),
    groupName: group?.name || "",
    targetPath:
      `/read/groups/${groupId}`,
    message:
      `You received a warning in ${
        group?.name || "a group"
      }: ${cleanReason}`
  }).catch((error) => {
    console.warn(
      "Warning notification failed:",
      error
    );
  });
}

export async function removeGroupMemberModerated(
  groupId,
  targetUserId,
  reason = ""
) {
  const { user } =
    await requireModerator(
      groupId,
      targetUserId
    );

  const group = await groupData(groupId);

  await deleteDoc(
    doc(
      db,
      "groups",
      String(groupId),
      "members",
      String(targetUserId)
    )
  );

  await logAction(groupId, {
    action: "member_removed",
    targetUserId,
    reason
  });

  createNotification({
    recipientUserId:
      String(targetUserId),
    type: "group_removed",
    actorUserId: user.uid,
    groupId: String(groupId),
    groupName: group?.name || "",
    targetPath:
      "/read/profile?tab=groups",
    message:
      `You were removed from ${
        group?.name || "a group"
      }${
        reason ? `: ${reason}` : "."
      }`
  }).catch(() => {});
}

export async function banGroupMember(
  groupId,
  targetUserId,
  reason
) {
  const { user } =
    await requireModerator(
      groupId,
      targetUserId
    );

  const cleanReason =
    String(reason || "").trim();

  if (!cleanReason) {
    throw new Error(
      "Add a reason for the ban."
    );
  }

  const group = await groupData(groupId);

  const banRef = doc(
    db,
    "groups",
    String(groupId),
    "bans",
    String(targetUserId)
  );

  const now = new Date().toISOString();

  await setDoc(banRef, {
    groupId: String(groupId),
    userId: String(targetUserId),
    bannedBy: user.uid,
    reason: cleanReason,
    createdAtISO: now,
    createdAt: serverTimestamp()
  });

  const memberRef = doc(
    db,
    "groups",
    String(groupId),
    "members",
    String(targetUserId)
  );

  const memberSnapshot =
    await getDoc(memberRef);

  if (memberSnapshot.exists()) {
    await deleteDoc(memberRef);
  }

  await logAction(groupId, {
    action: "member_banned",
    targetUserId,
    reason: cleanReason
  });

  createNotification({
    recipientUserId:
      String(targetUserId),
    type: "group_banned",
    actorUserId: user.uid,
    groupId: String(groupId),
    groupName: group?.name || "",
    targetPath:
      "/read/profile?tab=groups",
    message:
      `You were banned from ${
        group?.name || "a group"
      }: ${cleanReason}`
  }).catch(() => {});
}

export async function getGroupBans(
  groupId
) {
  await requireModerator(groupId);

  const snapshot = await getDocs(
    collection(
      db,
      "groups",
      String(groupId),
      "bans"
    )
  );

  return Promise.all(
    snapshot.docs.map(async (item) => {
      const data = item.data();

      return {
        id: item.id,
        ...data,
        profile:
          await publicProfile(
            data.userId
          )
      };
    })
  );
}

export async function unbanGroupMember(
  groupId,
  targetUserId,
  reason = ""
) {
  await requireModerator(groupId);

  await deleteDoc(
    doc(
      db,
      "groups",
      String(groupId),
      "bans",
      String(targetUserId)
    )
  );

  await logAction(groupId, {
    action: "member_unbanned",
    targetUserId,
    reason
  });
}

export async function getModerationActions(
  groupId
) {
  await requireModerator(groupId);

  const ref = collection(
    db,
    "groups",
    String(groupId),
    "moderationActions"
  );

  let snapshot;

  try {
    snapshot = await getDocs(
      query(
        ref,
        orderBy("createdAtISO", "desc")
      )
    );
  } catch {
    snapshot = await getDocs(ref);
  }

  const actions =
    snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

  return Promise.all(
    actions.map(async (action) => ({
      ...action,
      moderatorProfile:
        await publicProfile(
          action.moderatorUserId
        ),
      targetProfile:
        action.targetUserId
          ? await publicProfile(
              action.targetUserId
            )
          : null
    }))
  );
}
