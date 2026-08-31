import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch
} from "firebase/firestore";

import {
  auth,
  db
} from "../firebase";

export const PLATFORM_ROLES = {
  MODERATOR: "platform_moderator",
  ADMIN: "platform_admin",
  FOUNDATION_ADMIN: "foundation_admin"
};

export const PLATFORM_ROLE_RANK = {
  user: 0,
  [PLATFORM_ROLES.MODERATOR]: 1,
  [PLATFORM_ROLES.ADMIN]: 2,
  [PLATFORM_ROLES.FOUNDATION_ADMIN]: 3
};


function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You must be logged in."
    );
  }

  return user;
}


async function publicProfile(
  userId
) {
  if (!userId) {
    return null;
  }

  try {
    const snapshot =
      await getDoc(
        doc(
          db,
          "publicProfiles",
          String(userId)
        )
      );

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id:
        snapshot.id,
      ...snapshot.data()
    };
  } catch {
    return null;
  }
}


export function platformRoleRank(role) {
  return PLATFORM_ROLE_RANK[role] || 0;
}


export function isPlatformModeratorRole(role) {
  return (
    platformRoleRank(role) >=
    PLATFORM_ROLE_RANK[
      PLATFORM_ROLES.MODERATOR
    ]
  );
}


export function isPlatformAdminRole(role) {
  return (
    platformRoleRank(role) >=
    PLATFORM_ROLE_RANK[
      PLATFORM_ROLES.ADMIN
    ]
  );
}


export function isFoundationAdminRole(role) {
  return (
    role ===
    PLATFORM_ROLES.FOUNDATION_ADMIN
  );
}


export function canPlatformDisciplineRole(
  actorRole,
  targetRole = "user"
) {
  return (
    isPlatformModeratorRole(
      actorRole
    ) &&
    platformRoleRank(
      actorRole
    ) >
      platformRoleRank(
        targetRole
      )
  );
}


export async function getPlatformRole(
  userId = null
) {
  const currentUser =
    requireUser();

  const targetUserId =
    userId ||
    currentUser.uid;

  const snapshot =
    await getDoc(
      doc(
        db,
        "platformRoles",
        String(
          targetUserId
        )
      )
    );

  if (!snapshot.exists()) {
    return {
      userId:
        String(
          targetUserId
        ),
      role:
        "user",
      isPlatformModerator:
        false,
      isPlatformAdmin:
        false,
      isFoundationAdmin:
        false
    };
  }

  const data =
    snapshot.data();

  const role =
    data.role ||
    "user";

  return {
    id:
      snapshot.id,
    ...data,
    userId:
      data.userId ||
      String(
        targetUserId
      ),
    role,
    isPlatformModerator:
      isPlatformModeratorRole(
        role
      ),
    isPlatformAdmin:
      isPlatformAdminRole(
        role
      ),
    isFoundationAdmin:
      isFoundationAdminRole(
        role
      )
  };
}


export async function getMyPlatformRole() {
  const user =
    requireUser();

  return getPlatformRole(
    user.uid
  );
}


export async function requirePlatformModerator() {
  const role =
    await getMyPlatformRole();

  if (
    !role.isPlatformModerator
  ) {
    throw new Error(
      "You do not have platform moderation access."
    );
  }

  return role;
}


export async function requirePlatformAdmin() {
  const role =
    await getMyPlatformRole();

  if (
    !role.isPlatformAdmin
  ) {
    throw new Error(
      "You do not have platform administrator access."
    );
  }

  return role;
}


export async function requireFoundationAdmin() {
  const role =
    await getMyPlatformRole();

  if (
    !role.isFoundationAdmin
  ) {
    throw new Error(
      "You do not have Foundation administrator access."
    );
  }

  return role;
}


/* ============================================================
   GLOBAL REPORTING
============================================================ */

export async function reportPlatformContent({
  targetType,
  targetId,
  targetUserId,
  reason = "other",
  details = "",
  groupId = null,
  title = "",
  body = "",
  bookId = null
}) {
  const user =
    requireUser();

  const allowedTypes = [
    "profile",
    "chain_entry",
    "chain_reply",
    "group",
    "group_forum_post",
    "group_forum_reply"
  ];

  if (
    !allowedTypes.includes(
      targetType
    )
  ) {
    throw new Error(
      "Unsupported platform report type."
    );
  }

  if (
    !targetId ||
    !targetUserId
  ) {
    throw new Error(
      "Missing report target."
    );
  }

  const cleanReason =
    String(
      reason ||
      "other"
    ).trim();

  if (!cleanReason) {
    throw new Error(
      "Choose a reason for the report."
    );
  }

  const reportRef =
    doc(
      collection(
        db,
        "moderationReports"
      )
    );

  const now =
    new Date()
      .toISOString();

  const report = {
    id:
      reportRef.id,
    reporterUserId:
      user.uid,
    targetType:
      String(
        targetType
      ),
    targetId:
      String(
        targetId
      ),
    targetUserId:
      String(
        targetUserId
      ),
    reason:
      cleanReason,
    details:
      String(
        details ||
        ""
      ).trim(),
    status:
      "open",
    createdAtISO:
      now
  };

  if (groupId) {
    report.groupId =
      String(
        groupId
      );
  }

  if (title) {
    report.title =
      String(
        title
      );
  }

  if (body) {
    report.body =
      String(
        body
      );
  }

  if (bookId) {
    report.bookId =
      String(
        bookId
      );
  }

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


async function hydrateReportTarget(
  report
) {
  if (!report) {
    return {
      targetExists: false,
      targetPath: null,
      targetPreview: null
    };
  }

  try {
    if (
      report.targetType ===
      "profile"
    ) {
      const snapshot =
        await getDoc(
          doc(
            db,
            "publicProfiles",
            String(
              report.targetUserId
            )
          )
        );

      return {
        targetExists:
          snapshot.exists(),
        targetPath:
          snapshot.exists()
            ? `/read/public/${report.targetUserId}`
            : null,
        targetProfilePath:
          snapshot.exists()
            ? `/read/public/${report.targetUserId}`
            : null,
        targetPreview:
          snapshot.exists()
            ? {
                id:
                  snapshot.id,
                ...snapshot.data()
              }
            : null
      };
    }

    if (
      report.targetType ===
      "chain_entry"
    ) {
      const snapshot =
        await getDoc(
          doc(
            db,
            "users",
            String(
              report.targetUserId
            ),
            "journal",
            String(
              report.targetId
            )
          )
        );

      const data =
        snapshot.exists()
          ? snapshot.data()
          : null;

      const bookId =
        report.bookId ||
        data?.bookId ||
        null;

      return {
        targetExists:
          snapshot.exists(),
        targetPath:
          bookId
            ? `/read/reader/${bookId}`
            : null,
        targetProfilePath:
          report.targetUserId
            ? `/read/public/${report.targetUserId}`
            : null,
        targetPreview:
          snapshot.exists()
            ? {
                id:
                  snapshot.id,
                ...data
              }
            : null
      };
    }

    if (
      report.targetType ===
      "chain_reply"
    ) {
      const snapshot =
        await getDoc(
          doc(
            db,
            "marginReplies",
            String(
              report.targetId
            )
          )
        );

      return {
        targetExists:
          snapshot.exists(),
        targetPath:
          report.bookId
            ? `/read/reader/${report.bookId}`
            : null,
        targetProfilePath:
          report.targetUserId
            ? `/read/public/${report.targetUserId}`
            : null,
        targetPreview:
          snapshot.exists()
            ? {
                id:
                  snapshot.id,
                ...snapshot.data()
              }
            : null
      };
    }

    return {
      targetExists: true,
      targetPath: null,
      targetProfilePath:
        report.targetUserId
          ? `/read/public/${report.targetUserId}`
          : null,
      targetPreview: null
    };
  } catch {
    return {
      targetExists: null,
      targetPath: null,
      targetProfilePath:
        report.targetUserId
          ? `/read/public/${report.targetUserId}`
          : null,
      targetPreview: null
    };
  }
}


export async function getPlatformModerationReports() {
  await requirePlatformModerator();

  const reportsRef =
    collection(
      db,
      "moderationReports"
    );

  let snapshot;

  try {
    snapshot =
      await getDocs(
        query(
          reportsRef,
          where(
            "status",
            "==",
            "open"
          ),
          orderBy(
            "createdAtISO",
            "desc"
          )
        )
      );
  } catch {
    snapshot =
      await getDocs(
        reportsRef
      );
  }

  const reports =
    snapshot.docs
      .map(
        (item) => ({
          id:
            item.id,
          ...item.data()
        })
      )
      .filter(
        (item) =>
          item.status ===
          "open"
      )
      .sort(
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

  return Promise.all(
    reports.map(
      async (report) => {
        const [
          reporterProfile,
          targetProfile,
          targetState
        ] =
          await Promise.all([
            publicProfile(
              report.reporterUserId
            ),
            publicProfile(
              report.targetUserId
            ),
            hydrateReportTarget(
              report
            )
          ]);

        return {
          ...report,
          reporterProfile,
          targetProfile,
          ...targetState
        };
      }
    )
  );
}


export async function resolvePlatformModerationReport(
  reportId,
  resolution = "resolved"
) {
  const moderator =
    requireUser();

  await requirePlatformModerator();

  const reportRef =
    doc(
      db,
      "moderationReports",
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
    throw new Error(
      "This report is no longer available."
    );
  }

  const report =
    snapshot.data();

  if (
    report.status !==
    "open"
  ) {
    throw new Error(
      "This report has already been reviewed."
    );
  }

  const normalizedResolution =
    resolution ===
    "dismissed"
      ? "dismissed"
      : "resolved";

  const actionRef =
    doc(
      collection(
        db,
        "moderationActions"
      )
    );

  const now =
    new Date()
      .toISOString();

  const batch =
    writeBatch(
      db
    );

  batch.update(
    reportRef,
    {
      status:
        normalizedResolution,
      resolvedBy:
        moderator.uid,
      resolvedAtISO:
        now,
      resolvedAt:
        serverTimestamp()
    }
  );

  batch.set(
    actionRef,
    {
      id:
        actionRef.id,
      moderatorUserId:
        moderator.uid,
      action:
        normalizedResolution ===
        "dismissed"
          ? "report_dismissed"
          : "report_resolved",
      targetUserId:
        String(
          report.targetUserId
        ),
      targetType:
        String(
          report.targetType ||
          ""
        ),
      targetId:
        String(
          report.targetId ||
          ""
        ),
      bookId:
        report.bookId
          ? String(
              report.bookId
            )
          : null,
      reportId:
        String(
          reportId
        ),
      reason:
        String(
          report.reason ||
          ""
        ),
      details:
        String(
          report.details ||
          ""
        ),
      createdAtISO:
        now,
      createdAt:
        serverTimestamp()
    }
  );

  await batch.commit();
}


export async function getPlatformEnforcementSummary() {
  const role =
    await requirePlatformModerator();

  if (!role.isPlatformAdmin) {
    return {
      available: false,
      count: null
    };
  }

  try {
    const snapshot =
      await getDocs(
        collection(
          db,
          "platformEnforcement"
        )
      );

    return {
      available: true,
      count:
        snapshot.docs.filter(
          (item) => {
            const status =
              item.data()?.status;

            return [
              "warning",
              "suspended",
              "banned"
            ].includes(
              status
            );
          }
        ).length
    };
  } catch {
    return {
      available: false,
      count: null
    };
  }
}


export async function getPlatformRoleSummary() {
  const role =
    await requirePlatformModerator();

  if (!role.isFoundationAdmin) {
    return {
      available: false,
      count: null
    };
  }

  try {
    const snapshot =
      await getDocs(
        collection(
          db,
          "platformRoles"
        )
      );

    return {
      available: true,
      count:
        snapshot.docs.length
    };
  } catch {
    return {
      available: false,
      count: null
    };
  }
}


export function subscribeToMyPlatformEnforcement(
  callback
) {
  const user =
    auth.currentUser;

  if (!user) {
    callback(null);
    return () => {};
  }

  const enforcementRef =
    doc(
      db,
      "platformEnforcement",
      user.uid
    );

  return onSnapshot(
    enforcementRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      const data = {
        id:
          snapshot.id,
        ...snapshot.data()
      };

      if (
        data.status ===
        "cleared"
      ) {
        callback(null);
        return;
      }

      if (
        data.status ===
          "suspended" &&
        data.endsAtISO
      ) {
        const end =
          new Date(
            data.endsAtISO
          ).getTime();

        if (
          Number.isFinite(end) &&
          end <= Date.now()
        ) {
          callback(null);
          return;
        }
      }

      callback(data);
    },
    (error) => {
      console.error(
        "Could not subscribe to platform enforcement:",
        error
      );

      callback(null);
    }
  );
}


export async function clearPlatformEnforcement(
  targetUserId
) {
  const moderator =
    requireUser();

  const actorRole =
    await requirePlatformAdmin();

  const cleanTargetUserId =
    String(
      targetUserId ||
      ""
    ).trim();

  if (!cleanTargetUserId) {
    throw new Error(
      "Missing enforcement target."
    );
  }

  if (
    cleanTargetUserId ===
    moderator.uid
  ) {
    throw new Error(
      "You cannot change enforcement on your own account."
    );
  }

  const targetRole =
    await getPlatformRole(
      cleanTargetUserId
    );

  if (
    !canPlatformDisciplineRole(
      actorRole.role,
      targetRole.role
    )
  ) {
    throw new Error(
      "You cannot change enforcement for an account with the same or a higher platform role."
    );
  }

  const enforcementRef =
    doc(
      db,
      "platformEnforcement",
      cleanTargetUserId
    );

  const snapshot =
    await getDoc(
      enforcementRef
    );

  if (!snapshot.exists()) {
    throw new Error(
      "No active enforcement record was found."
    );
  }

  const existing =
    snapshot.data();

  if (
    ![
      "warning",
      "suspended",
      "banned"
    ].includes(
      existing.status
    )
  ) {
    throw new Error(
      "This enforcement record is already cleared."
    );
  }

  const now =
    new Date()
      .toISOString();

  const actionRef =
    doc(
      collection(
        db,
        "moderationActions"
      )
    );

  const batch =
    writeBatch(
      db
    );

  batch.update(
    enforcementRef,
    {
      status:
        "cleared",
      enforcedBy:
        moderator.uid,
      clearedBy:
        moderator.uid,
      clearedAtISO:
        now,
      durationHours:
        null,
      endsAtISO:
        null,
      endsAt:
        null,
      updatedAtISO:
        now,
      updatedAt:
        serverTimestamp()
    }
  );

  batch.set(
    actionRef,
    {
      id:
        actionRef.id,
      moderatorUserId:
        moderator.uid,
      action:
        "platform_enforcement_cleared",
      targetUserId:
        cleanTargetUserId,
      targetRole:
        targetRole.role,
      targetType:
        "profile",
      targetId:
        cleanTargetUserId,
      previousEnforcementStatus:
        existing.status,
      reason:
        existing.reason ||
        "Platform enforcement cleared.",
      details:
        existing.details ||
        "",
      createdAtISO:
        now,
      createdAt:
        serverTimestamp()
    }
  );

  await batch.commit();

  return true;
}


export async function getPlatformEnforcements() {
  await requirePlatformAdmin();

  const snapshot =
    await getDocs(
      collection(
        db,
        "platformEnforcement"
      )
    );

  const records =
    snapshot.docs
      .map(
        (item) => ({
          id:
            item.id,
          ...item.data()
        })
      )
      .filter(
        (item) => {
          if (
            ![
              "warning",
              "suspended",
              "banned"
            ].includes(
              item.status
            )
          ) {
            return false;
          }

          if (
            item.status ===
              "suspended" &&
            item.endsAtISO
          ) {
            const end =
              new Date(
                item.endsAtISO
              ).getTime();

            if (
              Number.isFinite(end) &&
              end <= Date.now()
            ) {
              return false;
            }
          }

          return true;
        }
      )
      .sort(
        (a, b) =>
          String(
            b.updatedAtISO ||
            b.startedAtISO ||
            ""
          ).localeCompare(
            String(
              a.updatedAtISO ||
              a.startedAtISO ||
              ""
            )
          )
      );

  return Promise.all(
    records.map(
      async (record) => ({
        ...record,
        targetProfile:
          await publicProfile(
            record.userId ||
            record.id
          ),
        targetRole:
          (
            await getPlatformRole(
              record.userId ||
              record.id
            )
          ).role
      })
    )
  );
}


export async function applyPlatformEnforcement({
  targetUserId,
  status,
  reason,
  details = "",
  durationHours = null,
  reportId = null,
  targetType = "",
  targetId = "",
  bookId = null
}) {
  const moderator =
    requireUser();

  const actorRole =
    await requirePlatformAdmin();

  const cleanTargetUserId =
    String(
      targetUserId ||
      ""
    ).trim();

  if (!cleanTargetUserId) {
    throw new Error(
      "Missing enforcement target."
    );
  }

  if (
    cleanTargetUserId ===
    moderator.uid
  ) {
    throw new Error(
      "You cannot apply platform enforcement to your own account."
    );
  }

  const targetRole =
    await getPlatformRole(
      cleanTargetUserId
    );

  if (
    !canPlatformDisciplineRole(
      actorRole.role,
      targetRole.role
    )
  ) {
    throw new Error(
      "You cannot discipline an account with the same or a higher platform role."
    );
  }

  const normalizedStatus =
    String(
      status ||
      ""
    ).trim();

  if (
    ![
      "warning",
      "suspended",
      "banned"
    ].includes(
      normalizedStatus
    )
  ) {
    throw new Error(
      "Unsupported enforcement status."
    );
  }

  const cleanReason =
    String(
      reason ||
      ""
    ).trim();

  if (!cleanReason) {
    throw new Error(
      "An enforcement reason is required."
    );
  }

  let normalizedDurationHours = null;
  let endsAtISO = null;
  let endsAtDate = null;

  if (normalizedStatus === "suspended") {
    normalizedDurationHours = Number(durationHours);

    if (![24, 168, 720].includes(normalizedDurationHours)) {
      throw new Error(
        "Choose a 24-hour, 7-day, or 30-day suspension."
      );
    }

    endsAtDate = new Date(
      Date.now() + normalizedDurationHours * 60 * 60 * 1000
    );

    endsAtISO = endsAtDate.toISOString();
  }

  const now = new Date().toISOString();

  const enforcementRef = doc(
    db,
    "platformEnforcement",
    cleanTargetUserId
  );

  const existingSnapshot = await getDoc(
    enforcementRef
  );

  const existingEnforcement =
    existingSnapshot.exists()
      ? existingSnapshot.data()
      : null;

  const enforcementRank = {
    cleared: 0,
    warning: 1,
    suspended: 2,
    banned: 3
  };

  let existingStatus =
    existingEnforcement?.status || "cleared";

  if (
    existingStatus === "suspended" &&
    existingEnforcement?.endsAtISO
  ) {
    const existingEnd = new Date(
      existingEnforcement.endsAtISO
    ).getTime();

    if (
      Number.isFinite(existingEnd) &&
      existingEnd <= Date.now()
    ) {
      existingStatus = "cleared";
    }
  }

  const shouldReplaceActiveEnforcement =
    (enforcementRank[normalizedStatus] || 0) >=
    (enforcementRank[existingStatus] || 0);

  const actionRef = doc(
    collection(
      db,
      "moderationActions"
    )
  );

  const batch = writeBatch(db);

  if (shouldReplaceActiveEnforcement) {
    batch.set(
      enforcementRef,
      {
        userId: cleanTargetUserId,
        status: normalizedStatus,
        reason: cleanReason,
        details: String(details || "").trim(),
        enforcedBy: moderator.uid,
        targetRole: targetRole.role,
        durationHours: normalizedDurationHours,
        startedAtISO: now,
        endsAtISO,
        endsAt:
          endsAtDate
            ? Timestamp.fromDate(endsAtDate)
            : null,
        reportId: reportId ? String(reportId) : null,
        updatedAtISO: now,
        updatedAt: serverTimestamp()
      }
    );
  }

  batch.set(
    actionRef,
    {
      id: actionRef.id,
      moderatorUserId: moderator.uid,
      action:
        normalizedStatus === "warning"
          ? "platform_warning"
          : normalizedStatus === "suspended"
            ? "platform_suspension"
            : "platform_ban",
      targetUserId: cleanTargetUserId,
      targetRole: targetRole.role,
      targetType: String(targetType || "profile"),
      targetId: String(targetId || cleanTargetUserId),
      bookId: bookId ? String(bookId) : null,
      reportId: reportId ? String(reportId) : null,
      reason: cleanReason,
      details: String(details || "").trim(),
      enforcementStatus: normalizedStatus,
      durationHours: normalizedDurationHours,
      endsAtISO,
      endsAt:
        endsAtDate
          ? Timestamp.fromDate(endsAtDate)
          : null,
      createdAtISO: now,
      createdAt: serverTimestamp()
    }
  );

  if (reportId) {
    const reportRef = doc(
      db,
      "moderationReports",
      String(reportId)
    );

    const reportSnapshot = await getDoc(reportRef);

    if (
      reportSnapshot.exists() &&
      reportSnapshot.data()?.status === "open"
    ) {
      batch.update(
        reportRef,
        {
          status: "resolved",
          resolvedBy: moderator.uid,
          resolvedAtISO: now,
          resolvedAt: serverTimestamp(),
          enforcementAction: normalizedStatus
        }
      );
    }
  }

  await batch.commit();

  return {
    userId: cleanTargetUserId,
    requestedStatus: normalizedStatus,
    effectiveStatus:
      shouldReplaceActiveEnforcement
        ? normalizedStatus
        : existingStatus,
    endsAtISO:
      shouldReplaceActiveEnforcement
        ? endsAtISO
        : existingEnforcement?.endsAtISO || null
  };
}



/* ============================================================
   PHASE 4.3C.3 APPEALS
============================================================ */

export async function submitPlatformAppeal(
  explanation
) {
  const user =
    requireUser();

  const cleanExplanation =
    String(
      explanation || ""
    ).trim();

  if (!cleanExplanation) {
    throw new Error(
      "Explain why you believe this enforcement should be reviewed."
    );
  }

  const enforcementRef =
    doc(
      db,
      "platformEnforcement",
      user.uid
    );

  const lockRef =
    doc(
      db,
      "moderationAppealLocks",
      user.uid
    );

  const [
    enforcementSnapshot,
    lockSnapshot
  ] =
    await Promise.all([
      getDoc(enforcementRef),
      getDoc(lockRef)
    ]);

  if (!enforcementSnapshot.exists()) {
    throw new Error(
      "There is no active suspension or ban to appeal."
    );
  }

  const enforcement =
    enforcementSnapshot.data();

  if (
    ![
      "suspended",
      "banned"
    ].includes(
      enforcement.status
    )
  ) {
    throw new Error(
      "Only an active suspension or ban can be appealed."
    );
  }

  if (lockSnapshot.exists()) {
    throw new Error(
      "You already have an open appeal."
    );
  }

  if (
    enforcement.status === "suspended" &&
    enforcement.endsAtISO
  ) {
    const end =
      new Date(
        enforcement.endsAtISO
      ).getTime();

    if (
      Number.isFinite(end) &&
      end <= Date.now()
    ) {
      throw new Error(
        "This suspension has already expired."
      );
    }
  }

  const appealRef =
    doc(
      collection(
        db,
        "moderationAppeals"
      )
    );

  const now =
    new Date()
      .toISOString();

  const batch =
    writeBatch(
      db
    );

  batch.set(
    appealRef,
    {
      id:
        appealRef.id,
      appellantUserId:
        user.uid,
      enforcementStatus:
        enforcement.status,
      enforcementReason:
        String(
          enforcement.reason ||
          ""
        ),
      enforcementStartedAtISO:
        enforcement.startedAtISO ||
        null,
      enforcementEndsAtISO:
        enforcement.endsAtISO ||
        null,
      explanation:
        cleanExplanation,
      status:
        "open",
      createdAtISO:
        now,
      createdAt:
        serverTimestamp()
    }
  );

  batch.set(
    lockRef,
    {
      userId:
        user.uid,
      appealId:
        appealRef.id,
      createdAtISO:
        now,
      createdAt:
        serverTimestamp()
    }
  );

  await batch.commit();

  return {
    id:
      appealRef.id,
    status:
      "open"
  };
}


export async function getPlatformAppeals() {
  await requirePlatformModerator();

  const snapshot =
    await getDocs(
      collection(
        db,
        "moderationAppeals"
      )
    );

  const appeals =
    snapshot.docs
      .map(
        (item) => ({
          id:
            item.id,
          ...item.data()
        })
      )
      .sort(
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

  return Promise.all(
    appeals.map(
      async (appeal) => ({
        ...appeal,
        appellantProfile:
          await publicProfile(
            appeal.appellantUserId
          ),
        appellantRole:
          (
            await getPlatformRole(
              appeal.appellantUserId
            )
          ).role
      })
    )
  );
}


export async function reviewPlatformAppeal({
  appealId,
  decision,
  reviewReason
}) {
  const moderator =
    requireUser();

  const actorRole =
    await requirePlatformAdmin();

  const normalizedDecision =
    decision === "approved"
      ? "approved"
      : decision === "denied"
        ? "denied"
        : "";

  if (!normalizedDecision) {
    throw new Error(
      "Choose whether to approve or deny the appeal."
    );
  }

  const cleanReviewReason =
    String(
      reviewReason || ""
    ).trim();

  if (!cleanReviewReason) {
    throw new Error(
      "A review reason is required."
    );
  }

  const appealRef =
    doc(
      db,
      "moderationAppeals",
      String(
        appealId
      )
    );

  const appealSnapshot =
    await getDoc(
      appealRef
    );

  if (!appealSnapshot.exists()) {
    throw new Error(
      "This appeal is no longer available."
    );
  }

  const appeal =
    appealSnapshot.data();

  if (
    appeal.status !== "open"
  ) {
    throw new Error(
      "This appeal has already been reviewed."
    );
  }

  const targetRole =
    await getPlatformRole(
      appeal.appellantUserId
    );

  if (
    !canPlatformDisciplineRole(
      actorRole.role,
      targetRole.role
    )
  ) {
    throw new Error(
      "You cannot review an appeal for an account with the same or a higher platform role."
    );
  }

  const enforcementRef =
    doc(
      db,
      "platformEnforcement",
      appeal.appellantUserId
    );

  const enforcementSnapshot =
    await getDoc(
      enforcementRef
    );

  if (
    normalizedDecision === "approved" &&
    !enforcementSnapshot.exists()
  ) {
    throw new Error(
      "The enforcement record is no longer available."
    );
  }

  const now =
    new Date()
      .toISOString();

  const lockRef =
    doc(
      db,
      "moderationAppealLocks",
      appeal.appellantUserId
    );

  const actionRef =
    doc(
      collection(
        db,
        "moderationActions"
      )
    );

  const batch =
    writeBatch(
      db
    );

  batch.update(
    appealRef,
    {
      status:
        normalizedDecision,
      reviewedBy:
        moderator.uid,
      reviewReason:
        cleanReviewReason,
      reviewedAtISO:
        now,
      reviewedAt:
        serverTimestamp()
    }
  );

  batch.delete(
    lockRef
  );

  if (
    normalizedDecision ===
    "approved"
  ) {
    const enforcement =
      enforcementSnapshot.data();

    batch.update(
      enforcementRef,
      {
        status:
          "cleared",
        enforcedBy:
          moderator.uid,
        clearedBy:
          moderator.uid,
        clearedAtISO:
          now,
        durationHours:
          null,
        endsAtISO:
          null,
        endsAt:
          null,
        updatedAtISO:
          now,
        updatedAt:
          serverTimestamp(),
        reason:
          enforcement.reason ||
          "Enforcement cleared after approved appeal."
      }
    );
  }

  batch.set(
    actionRef,
    {
      id:
        actionRef.id,
      moderatorUserId:
        moderator.uid,
      action:
        normalizedDecision ===
        "approved"
          ? "platform_appeal_approved"
          : "platform_appeal_denied",
      targetUserId:
        appeal.appellantUserId,
      targetRole:
        targetRole.role,
      targetType:
        "profile",
      targetId:
        appeal.appellantUserId,
      appealId:
        String(
          appealId
        ),
      reason:
        cleanReviewReason,
      details:
        appeal.explanation ||
        "",
      createdAtISO:
        now,
      createdAt:
        serverTimestamp()
    }
  );

  await batch.commit();

  return true;
}


export async function getPlatformModerationActions() {
  await requirePlatformModerator();

  const actionsRef =
    collection(
      db,
      "moderationActions"
    );

  let snapshot;

  try {
    snapshot =
      await getDocs(
        query(
          actionsRef,
          orderBy(
            "createdAtISO",
            "desc"
          )
        )
      );
  } catch {
    snapshot =
      await getDocs(
        actionsRef
      );
  }

  const actions =
    snapshot.docs
      .map(
        (item) => ({
          id:
            item.id,
          ...item.data()
        })
      )
      .sort(
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

  return Promise.all(
    actions.map(
      async (action) => ({
        ...action,
        moderatorProfile:
          await publicProfile(
            action.moderatorUserId
          ),
        targetProfile:
          await publicProfile(
            action.targetUserId
          )
      })
    )
  );
}
