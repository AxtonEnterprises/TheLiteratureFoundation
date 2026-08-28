export const GROUP_ROLES = [
  "owner",
  "admin",
  "moderator",
  "member"
];

export const GROUP_ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Moderator",
  member: "Member"
};

export const GROUP_ROLE_DESCRIPTIONS = {
  owner:
    "Full control of the group, including roles, ownership transfer, settings, moderation, membership, and deletion.",
  admin:
    "Manages group settings and membership and can moderate group content. Cannot change leadership roles, transfer ownership, or delete the group.",
  moderator:
    "Moderates discussions and reported group content. Cannot change settings, membership, or roles.",
  member:
    "Participates in discussions, group reading, and other member activities."
};

export const GROUP_PERMISSIONS = {
  owner: {
    participate: true,
    moderateContent: true,
    manageMembers: true,
    manageJoinRequests: true,
    inviteMembers: true,
    editSettings: true,
    changeRoles: true,
    transferOwnership: true,
    deleteGroup: true
  },
  admin: {
    participate: true,
    moderateContent: true,
    manageMembers: true,
    manageJoinRequests: true,
    inviteMembers: true,
    editSettings: true,
    changeRoles: false,
    transferOwnership: false,
    deleteGroup: false
  },
  moderator: {
    participate: true,
    moderateContent: true,
    manageMembers: false,
    manageJoinRequests: false,
    inviteMembers: false,
    editSettings: false,
    changeRoles: false,
    transferOwnership: false,
    deleteGroup: false
  },
  member: {
    participate: true,
    moderateContent: false,
    manageMembers: false,
    manageJoinRequests: false,
    inviteMembers: false,
    editSettings: false,
    changeRoles: false,
    transferOwnership: false,
    deleteGroup: false
  }
};

export const GROUP_PERMISSION_LABELS = {
  participate: "Participate",
  moderateContent: "Moderate content",
  manageMembers: "Remove members",
  manageJoinRequests: "Manage join requests",
  inviteMembers: "Invite members",
  editSettings: "Edit settings",
  changeRoles: "Change roles",
  transferOwnership: "Transfer ownership",
  deleteGroup: "Delete group"
};

export function normalizeGroupRole(role) {
  return GROUP_ROLES.includes(role)
    ? role
    : "member";
}

export function groupRoleLabel(role) {
  return GROUP_ROLE_LABELS[normalizeGroupRole(role)];
}

export function groupRoleDescription(role) {
  return GROUP_ROLE_DESCRIPTIONS[normalizeGroupRole(role)];
}

export function hasGroupPermission(role, permission) {
  const normalized = normalizeGroupRole(role);
  return Boolean(
    GROUP_PERMISSIONS[normalized]?.[permission]
  );
}

export function canManageTargetMember(
  actorRole,
  targetRole
) {
  const actor = normalizeGroupRole(actorRole);
  const target = normalizeGroupRole(targetRole);

  if (target === "owner") {
    return false;
  }

  if (actor === "owner") {
    return true;
  }

  if (actor === "admin") {
    return !["owner", "admin"].includes(target);
  }

  return false;
}
