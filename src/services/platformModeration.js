import {
  doc,
  getDoc
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

export function platformRoleRank(role) {
  return PLATFORM_ROLE_RANK[role] || 0;
}

export function isPlatformModeratorRole(role) {
  return platformRoleRank(role) >=
    PLATFORM_ROLE_RANK[
      PLATFORM_ROLES.MODERATOR
    ];
}

export function isPlatformAdminRole(role) {
  return platformRoleRank(role) >=
    PLATFORM_ROLE_RANK[
      PLATFORM_ROLES.ADMIN
    ];
}

export function isFoundationAdminRole(role) {
  return role ===
    PLATFORM_ROLES.FOUNDATION_ADMIN;
}

export function canPlatformDisciplineRole(
  actorRole,
  targetRole = "user"
) {
  return (
    isPlatformModeratorRole(actorRole) &&
    platformRoleRank(actorRole) >
      platformRoleRank(targetRole)
  );
}

export async function getPlatformRole(
  userId = null
) {
  const currentUser = requireUser();

  const targetUserId =
    userId || currentUser.uid;

  const snapshot = await getDoc(
    doc(
      db,
      "platformRoles",
      String(targetUserId)
    )
  );

  if (!snapshot.exists()) {
    return {
      userId: String(targetUserId),
      role: "user",
      isPlatformModerator: false,
      isPlatformAdmin: false,
      isFoundationAdmin: false
    };
  }

  const data = snapshot.data();
  const role = data.role || "user";

  return {
    id: snapshot.id,
    ...data,
    userId:
      data.userId ||
      String(targetUserId),
    role,
    isPlatformModerator:
      isPlatformModeratorRole(role),
    isPlatformAdmin:
      isPlatformAdminRole(role),
    isFoundationAdmin:
      isFoundationAdminRole(role)
  };
}

export async function getMyPlatformRole() {
  const user = requireUser();

  return getPlatformRole(user.uid);
}

export async function requirePlatformModerator() {
  const role =
    await getMyPlatformRole();

  if (!role.isPlatformModerator) {
    throw new Error(
      "You do not have platform moderation access."
    );
  }

  return role;
}

export async function requirePlatformAdmin() {
  const role =
    await getMyPlatformRole();

  if (!role.isPlatformAdmin) {
    throw new Error(
      "You do not have platform administrator access."
    );
  }

  return role;
}

export async function requireFoundationAdmin() {
  const role =
    await getMyPlatformRole();

  if (!role.isFoundationAdmin) {
    throw new Error(
      "You do not have Foundation administrator access."
    );
  }

  return role;
}
