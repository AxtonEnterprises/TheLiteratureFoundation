import {
  useEffect,
  useMemo,
  useState
} from "react";

import { onAuthStateChanged } from "firebase/auth";
import {
  Link,
  useNavigate,
  useParams
} from "react-router-dom";

import {
  ArrowLeft,
  Check,
  Crown,
  Lock,
  LogOut,
  MessageCircle,
  Pin,
  Send,
  Settings,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
  Flag,
  Ban,
  BookOpen,
  AlertTriangle,
  History,
  RotateCcw
} from "lucide-react";

import { auth } from "../firebase";

import {
  deleteReportedGroupChainEntry,
  getGroupModerationQueue,
  resolveGroupChainReport
} from "../services/chainStorage.js";

import {
  deleteGroupPermanently,
  getFriends,
  getGroup,
  getGroupJoinRequests,
  getGroupMembers,
  inviteFriendToGroup,
  leaveGroup,
  respondToGroupJoinRequest,
  setGroupMemberRole,
  transferGroupOwnership
} from "../services/storage.js";

import {
  createGroupForumPost,
  deleteGroupForumPost,
  deleteGroupForumReply,
  getGroupForumPosts,
  getGroupForumReplies,
  replyToGroupForumPost,
  updateGroupForumPost,
  updateGroupProfile
} from "../services/groupsPhase3A.js";

import {
  GROUP_AVATARS,
  getGroupAvatar
} from "../data/groupAvatars.js";

import {
  GROUP_PERMISSION_LABELS,
  GROUP_PERMISSIONS,
  GROUP_ROLES,
  groupRoleDescription,
  groupRoleLabel,
  hasGroupPermission
} from "../services/groupPermissions.js";

import {
  assertCanModerateTarget,
  banGroupMember,
  canDisciplineRole,
  getForumModerationReports,
  getGroupBans,
  getModerationActions,
  issueGroupWarning,
  removeGroupMemberModerated,
  removeReportedForumContent,
  reportGroupForumContent,
  resolveForumModerationReport,
  recordGroupModerationAction,
  unbanGroupMember
} from "../services/groupModeration.js";

import SEO from "../components/SEO.jsx";

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}

function memberName(member) {
  return (
    member?.profile?.displayName ||
    member?.profile?.username ||
    "Reader"
  );
}

function GroupAvatar({
  group,
  size = 92
}) {
  const preset =
    getGroupAvatar(group?.avatar);

  const src =
    preset?.image ||
    group?.avatar ||
    "";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
        background: "#eef4f3",
        border: "1px solid var(--line)"
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover"
          }}
        />
      ) : (
        <Users
          size={Math.round(size * 0.42)}
        />
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  const isOwner = role === "owner";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem"
      }}
    >
      {isOwner ? (
        <Crown size={14} />
      ) : ["admin", "moderator"].includes(role) ? (
        <Shield size={14} />
      ) : null}

      {groupRoleLabel(role)}
    </span>
  );
}

function PermissionMatrix() {
  const permissionKeys =
    Object.keys(
      GROUP_PERMISSION_LABELS
    );

  return (
    <div
      style={{
        overflowX: "auto"
      }}
    >
      <table
        style={{
          width: "100%",
          minWidth: 650,
          borderCollapse: "collapse"
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "0.6rem"
              }}
            >
              Permission
            </th>

            {GROUP_ROLES.map((role) => (
              <th
                key={role}
                style={{
                  textAlign: "center",
                  padding: "0.6rem"
                }}
              >
                {groupRoleLabel(role)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {permissionKeys.map(
            (permission) => (
              <tr key={permission}>
                <td
                  style={{
                    padding: "0.6rem",
                    borderTop:
                      "1px solid var(--line)"
                  }}
                >
                  {
                    GROUP_PERMISSION_LABELS[
                      permission
                    ]
                  }
                </td>

                {GROUP_ROLES.map(
                  (role) => {
                    const allowed =
                      GROUP_PERMISSIONS[
                        role
                      ][permission];

                    return (
                      <td
                        key={role}
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "0.6rem",
                          borderTop:
                            "1px solid var(--line)"
                        }}
                        aria-label={
                          allowed
                            ? "Allowed"
                            : "Not allowed"
                        }
                      >
                        {allowed ? (
                          <Check
                            size={17}
                          />
                        ) : (
                          <X
                            size={17}
                            style={{
                              opacity: 0.35
                            }}
                          />
                        )}
                      </td>
                    );
                  }
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Group() {
  const { groupId } =
    useParams();

  const navigate =
    useNavigate();

  const [user, setUser] =
    useState(null);

  const [group, setGroup] =
    useState(null);

  const [members, setMembers] =
    useState([]);

  const [friends, setFriends] =
    useState([]);

  const [
    joinRequests,
    setJoinRequests
  ] = useState([]);

  const [
    moderationQueue,
    setModerationQueue
  ] = useState([]);

  const [
    forumModerationReports,
    setForumModerationReports
  ] = useState([]);

  const [
    moderationActions,
    setModerationActions
  ] = useState([]);

  const [
    groupBans,
    setGroupBans
  ] = useState([]);

  const [
    transferOwnerId,
    setTransferOwnerId
  ] = useState("");

  const [
    dangerBusy,
    setDangerBusy
  ] = useState(false);

  const [
    forumPosts,
    setForumPosts
  ] = useState([]);

  const [
    forumReplies,
    setForumReplies
  ] = useState({});

  const [
    openTopicId,
    setOpenTopicId
  ] = useState(null);

  const [
    topicTitle,
    setTopicTitle
  ] = useState("");

  const [
    topicBody,
    setTopicBody
  ] = useState("");

  const [
    replyText,
    setReplyText
  ] = useState("");

  const [
    activeTab,
    setActiveTab
  ] = useState("overview");

  const [
    groupSwipeStartX,
    setGroupSwipeStartX
  ] = useState(null);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    status,
    setStatus
  ] = useState("");

  const [
    busyUserId,
    setBusyUserId
  ] = useState(null);

  const [
    busyTopicId,
    setBusyTopicId
  ] = useState(null);

  const [
    settings,
    setSettings
  ] = useState({
    name: "",
    description: "",
    avatar: "",
    type: "group",
    visibility: "private",
    joinPolicy: "invite_only"
  });

  async function refresh() {
    const [
      loadedGroup,
      loadedMembers,
      loadedFriends,
      loadedForumPosts
    ] = await Promise.all([
      getGroup(groupId),
      getGroupMembers(groupId),
      getFriends(),
      getGroupForumPosts(groupId)
    ]);

    setGroup(loadedGroup);
    setMembers(loadedMembers);
    setFriends(loadedFriends);
    setForumPosts(loadedForumPosts);

    if (loadedGroup) {
      setSettings({
        name:
          loadedGroup.name || "",
        description:
          loadedGroup.description ||
          "",
        avatar:
          loadedGroup.avatar || "",
        type:
          loadedGroup.type ===
          "class"
            ? "class"
            : "group",
        visibility:
          loadedGroup.visibility ||
          "private",
        joinPolicy:
          loadedGroup.joinPolicy ||
          "invite_only"
      });
    }
  }

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);

        if (!firebaseUser) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setStatus("");
          await refresh();
        } catch (error) {
          console.error(
            "Could not load group:",
            error
          );

          setStatus(
            error?.message ||
              "We couldn't load this group."
          );
        } finally {
          setLoading(false);
        }
      }
    );
  }, [groupId]);

  const memberIds =
    useMemo(
      () =>
        new Set(
          members.map((member) =>
            String(member.userId)
          )
        ),
      [members]
    );

  const inviteableFriends =
    friends.filter(
      (friend) =>
        !memberIds.has(
          String(
            friend.otherUserId
          )
        )
    );

  const myRole =
    group?.membership?.role ||
    "member";

  const memberRoleByUserId =
    useMemo(
      () =>
        new Map(
          members.map(
            (member) => [
              String(
                member.userId
              ),
              member.role ||
                "member"
            ]
          )
        ),
      [members]
    );

  function canModerateUserContent(
    targetUserId
  ) {
    if (
      String(targetUserId) ===
      String(user?.uid)
    ) {
      return true;
    }

    const targetRole =
      memberRoleByUserId.get(
        String(targetUserId)
      ) ||
      "member";

    return canDisciplineRole(
      myRole,
      targetRole
    );
  }


  const canManageJoinRequests =
    hasGroupPermission(
      myRole,
      "manageJoinRequests"
    );

  const canInvite =
    hasGroupPermission(
      myRole,
      "inviteMembers"
    );

  const canEditSettings =
    hasGroupPermission(
      myRole,
      "editSettings"
    );

  const canChangeRoles =
    hasGroupPermission(
      myRole,
      "changeRoles"
    );

  const canModerate =
    hasGroupPermission(
      myRole,
      "moderateContent"
    );

  const canTransferOwnership =
    hasGroupPermission(
      myRole,
      "transferOwnership"
    );

  const canDeleteGroup =
    hasGroupPermission(
      myRole,
      "deleteGroup"
    );

  useEffect(() => {
    let active = true;

    async function load() {
      if (!canManageJoinRequests) {
        setJoinRequests([]);
        return;
      }

      try {
        const requests =
          await getGroupJoinRequests(
            groupId
          );

        if (active) {
          setJoinRequests(
            requests
          );
        }
      } catch (error) {
        console.error(
          "Could not load join requests:",
          error
        );
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [
    groupId,
    canManageJoinRequests
  ]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!canModerate) {
        setModerationQueue([]);
        return;
      }

      try {
        const [
          reports,
          forumReports,
          actions,
          bans
        ] = await Promise.all([
          getGroupModerationQueue(
            groupId
          ),
          getForumModerationReports(
            groupId
          ),
          getModerationActions(
            groupId
          ),
          getGroupBans(
            groupId
          )
        ]);

        if (active) {
          setModerationQueue(
            reports
          );
          setForumModerationReports(
            forumReports
          );
          setModerationActions(
            actions
          );
          setGroupBans(
            bans
          );
        }
      } catch (error) {
        console.error(
          "Could not load moderation queue:",
          error
        );
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [
    groupId,
    canModerate
  ]);

  async function refreshModeration() {
    if (!canModerate) {
      return;
    }

    const [
      forumReports,
      actions,
      bans
    ] = await Promise.all([
      getForumModerationReports(
        groupId
      ),
      getModerationActions(
        groupId
      ),
      getGroupBans(
        groupId
      )
    ]);

    setForumModerationReports(
      forumReports
    );
    setModerationActions(
      actions
    );
    setGroupBans(
      bans
    );
  }

  async function reportForumPost(
    post
  ) {
    const reason =
      window.prompt(
        "Why are you reporting this discussion?"
      );

    if (!reason?.trim()) {
      return;
    }

    try {
      setStatus("");

      await reportGroupForumContent(
        groupId,
        {
          contentType:
            "forum_post",
          postId:
            post.id,
          reportedUserId:
            post.userId,
          title:
            post.title,
          body:
            post.body,
          reason
        }
      );

      setStatus(
        "Discussion reported to the group moderators."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't submit that report."
      );
    }
  }

  async function reportForumReply(
    post,
    reply
  ) {
    const reason =
      window.prompt(
        "Why are you reporting this reply?"
      );

    if (!reason?.trim()) {
      return;
    }

    try {
      setStatus("");

      await reportGroupForumContent(
        groupId,
        {
          contentType:
            "forum_reply",
          postId:
            post.id,
          replyId:
            reply.id,
          reportedUserId:
            reply.userId,
          title:
            post.title,
          body:
            reply.body,
          reason
        }
      );

      setStatus(
        "Reply reported to the group moderators."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't submit that report."
      );
    }
  }

  async function warnMember(
    member
  ) {
    const reason =
      window.prompt(
        `Warning for ${memberName(
          member
        )}:`
      );

    if (!reason?.trim()) {
      return;
    }

    try {
      setBusyUserId(
        member.userId
      );
      setStatus("");

      await issueGroupWarning(
        groupId,
        member.userId,
        reason
      );

      await refreshModeration();

      setStatus(
        `Warning sent to ${memberName(
          member
        )}.`
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't issue that warning."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function moderatedRemove(
    member
  ) {
    const reason =
      window.prompt(
        `Reason for removing ${memberName(
          member
        )}:`
      );

    if (reason === null) {
      return;
    }

    if (
      !window.confirm(
        `Remove ${memberName(
          member
        )} from the group? They may rejoin later unless banned.`
      )
    ) {
      return;
    }

    try {
      setBusyUserId(
        member.userId
      );
      setStatus("");

      await removeGroupMemberModerated(
        groupId,
        member.userId,
        reason
      );

      await refresh();
      await refreshModeration();

      setStatus(
        `${memberName(
          member
        )} was removed.`
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't remove that member."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function banMember(
    member
  ) {
    const reason =
      window.prompt(
        `Reason for banning ${memberName(
          member
        )}:`
      );

    if (!reason?.trim()) {
      return;
    }

    if (
      !window.confirm(
        `Ban ${memberName(
          member
        )}? They will be removed and blocked from rejoining until the ban is lifted.`
      )
    ) {
      return;
    }

    try {
      setBusyUserId(
        member.userId
      );
      setStatus("");

      await banGroupMember(
        groupId,
        member.userId,
        reason
      );

      await refresh();
      await refreshModeration();

      setStatus(
        `${memberName(
          member
        )} was banned.`
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't ban that member."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function liftBan(
    ban
  ) {
    if (
      !window.confirm(
        `Lift the ban for ${
          ban.profile
            ?.displayName ||
          "this reader"
        }?`
      )
    ) {
      return;
    }

    try {
      setStatus("");

      await unbanGroupMember(
        groupId,
        ban.userId
      );

      await refreshModeration();

      setStatus(
        "Ban lifted."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't lift that ban."
      );
    }
  }

  async function resolveForumReport(
    report,
    resolution
  ) {
    try {
      setStatus("");

      await resolveForumModerationReport(
        groupId,
        report.id,
        resolution
      );

      await refreshModeration();

      setStatus(
        resolution ===
        "dismissed"
          ? "Report dismissed."
          : "Report resolved."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't update that report."
      );
    }
  }

  async function removeForumReportContent(
    report
  ) {
    if (
      !window.confirm(
        "Remove the reported content? The moderation history will be preserved."
      )
    ) {
      return;
    }

    try {
      setStatus("");

      await removeReportedForumContent(
        groupId,
        report
      );

      await refresh();
      await refreshModeration();

      setStatus(
        "Reported content removed."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't remove that content."
      );
    }
  }

  async function handleJoinRequest(
    request,
    accept
  ) {
    try {
      setBusyUserId(
        request.userId
      );

      setStatus("");

      await respondToGroupJoinRequest(
        groupId,
        request.userId,
        accept
      );

      setJoinRequests(
        await getGroupJoinRequests(
          groupId
        )
      );

      await refresh();

      setStatus(
        accept
          ? "Join request approved."
          : "Join request declined."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't update that join request."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function invite(friend) {
    try {
      setBusyUserId(
        friend.otherUserId
      );

      setStatus("");

      await inviteFriendToGroup(
        groupId,
        friend.otherUserId
      );

      setStatus(
        `Invitation sent to ${
          friend.profile
            ?.displayName ||
          "reader"
        }.`
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't send that invitation."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function changeRole(
    member,
    role
  ) {
    const oldRole =
      member.role || "member";

    if (oldRole === role) {
      return;
    }

    const confirmed =
      window.confirm(
        `Change ${memberName(
          member
        )} from ${groupRoleLabel(
          oldRole
        )} to ${groupRoleLabel(
          role
        )}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setBusyUserId(
        member.userId
      );

      setStatus("");

      await setGroupMemberRole(
        groupId,
        member.userId,
        role
      );

      await refresh();

      setStatus(
        `${memberName(
          member
        )} is now a ${groupRoleLabel(
          role
        )}.`
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't update that role."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function leave() {
    if (
      !window.confirm(
        "Leave this group?"
      )
    ) {
      return;
    }

    try {
      await leaveGroup(
        groupId
      );

      navigate(
        "/read/profile?tab=groups"
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't leave this group."
      );
    }
  }

  async function handleTransferOwnership() {
    if (!transferOwnerId) {
      setStatus(
        "Choose a member to receive ownership."
      );
      return;
    }

    const nextOwner =
      members.find(
        (member) =>
          member.userId ===
          transferOwnerId
      );

    if (!nextOwner) {
      setStatus(
        "That member is no longer available."
      );
      return;
    }

    const confirmation =
      window.prompt(
        `Transfer "${group.name}" to ${memberName(
          nextOwner
        )}?\n\nYou will become an Admin. Type TRANSFER to confirm.`
      );

    if (confirmation !== "TRANSFER") {
      setStatus(
        "Ownership transfer canceled."
      );
      return;
    }

    try {
      setDangerBusy(true);
      setStatus("");

      await transferGroupOwnership(
        groupId,
        transferOwnerId
      );

      await refresh();

      setTransferOwnerId("");

      setStatus(
        "Ownership transferred. You are now an Admin."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't transfer ownership."
      );
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleDeleteGroup() {
    const confirmed =
      window.confirm(
        `Permanently delete "${
          group?.name ||
          "this group"
        }"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    const secondConfirmation =
      window.prompt(
        "Type DELETE to permanently remove this group."
      );

    if (
      secondConfirmation !==
      "DELETE"
    ) {
      setStatus(
        "Group deletion canceled."
      );
      return;
    }

    try {
      setDangerBusy(true);
      setStatus("");

      await deleteGroupPermanently(
        groupId
      );

      navigate(
        "/read/profile?tab=groups"
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't delete this group."
      );
    } finally {
      setDangerBusy(false);
    }
  }

  async function saveSettings(
    event
  ) {
    event.preventDefault();

    try {
      setStatus("");

      await updateGroupProfile(
        groupId,
        settings
      );

      await refresh();

      setStatus(
        "Group settings saved."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't save group settings."
      );
    }
  }

  async function createTopic(
    event
  ) {
    event.preventDefault();

    if (
      !topicTitle.trim() ||
      !topicBody.trim()
    ) {
      setStatus(
        "Add a discussion title and message."
      );
      return;
    }

    try {
      setStatus("");

      await createGroupForumPost(
        groupId,
        {
          title: topicTitle,
          body: topicBody
        }
      );

      setTopicTitle("");
      setTopicBody("");

      setForumPosts(
        await getGroupForumPosts(
          groupId
        )
      );

      setStatus(
        "Discussion posted."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't post that discussion."
      );
    }
  }

  async function openTopic(post) {
    if (
      openTopicId === post.id
    ) {
      setOpenTopicId(null);
      setReplyText("");
      return;
    }

    try {
      setBusyTopicId(
        post.id
      );

      setStatus("");

      const replies =
        await getGroupForumReplies(
          groupId,
          post.id
        );

      setForumReplies(
        (current) => ({
          ...current,
          [post.id]: replies
        })
      );

      setOpenTopicId(
        post.id
      );

      setReplyText("");
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't load that discussion."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function sendForumReply(
    post
  ) {
    if (!replyText.trim()) {
      return;
    }

    try {
      setBusyTopicId(
        post.id
      );

      setStatus("");

      await replyToGroupForumPost(
        groupId,
        post.id,
        replyText
      );

      const replies =
        await getGroupForumReplies(
          groupId,
          post.id
        );

      setForumReplies(
        (current) => ({
          ...current,
          [post.id]: replies
        })
      );

      setReplyText("");

      setForumPosts(
        await getGroupForumPosts(
          groupId
        )
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't post that reply."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function toggleTopic(
    post,
    field
  ) {
    try {
      setBusyTopicId(
        post.id
      );

      setStatus("");

      await updateGroupForumPost(
        groupId,
        post.id,
        {
          [field]:
            !post[field]
        }
      );

      setForumPosts(
        await getGroupForumPosts(
          groupId
        )
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't update that discussion."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function deleteTopic(
    post
  ) {
    if (
      !window.confirm(
        "Delete this discussion?"
      )
    ) {
      return;
    }

    try {
      setBusyTopicId(
        post.id
      );

      setStatus("");

      await deleteGroupForumPost(
        groupId,
        post.id
      );

      setForumPosts(
        await getGroupForumPosts(
          groupId
        )
      );

      if (
        openTopicId === post.id
      ) {
        setOpenTopicId(null);
      }

      setStatus(
        "Discussion removed."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't remove that discussion."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function deleteForumReply(
    post,
    reply
  ) {
    if (
      !window.confirm(
        "Delete this reply? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      setBusyTopicId(
        post.id
      );

      setStatus("");

      await deleteGroupForumReply(
        groupId,
        post.id,
        reply.id
      );

      const replies =
        await getGroupForumReplies(
          groupId,
          post.id
        );

      setForumReplies(
        (current) => ({
          ...current,
          [post.id]: replies
        })
      );

      setStatus(
        "Reply removed."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't remove that reply."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function handleResolveReport(
    report,
    resolution
  ) {
    try {
      setStatus("");

      if (report.reportedUserId) {
        await assertCanModerateTarget(
          groupId,
          report.reportedUserId
        );
      }

      await resolveGroupChainReport(
        groupId,
        report.id,
        resolution
      );

      await recordGroupModerationAction(
        groupId,
        {
          action:
            resolution === "dismissed"
              ? "chain_report_dismissed"
              : "chain_report_resolved",
          targetUserId:
            report.reportedUserId ||
            null,
          contentType:
            "chain_post",
          contentId:
            report.reportedEntryId ||
            report.chainEntry?.id ||
            null,
          reportId:
            report.id,
          reason:
            report.reason || "",
          details:
            report.details || ""
        }
      );

      setModerationQueue(
        await getGroupModerationQueue(
          groupId
        )
      );

      setStatus(
        resolution ===
        "dismissed"
          ? "Report dismissed."
          : "Report resolved."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't update that report."
      );
    }
  }

  async function handleDeleteReportedChainEntry(
    report
  ) {
    if (
      !window.confirm(
        "Delete this reported group Chain post? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      setStatus("");

      if (report.reportedUserId) {
        await assertCanModerateTarget(
          groupId,
          report.reportedUserId
        );
      }

      await deleteReportedGroupChainEntry(
        groupId,
        report
      );

      await recordGroupModerationAction(
        groupId,
        {
          action:
            "chain_content_removed",
          targetUserId:
            report.reportedUserId ||
            null,
          contentType:
            "chain_post",
          contentId:
            report.reportedEntryId ||
            report.chainEntry?.id ||
            null,
          reportId:
            report.id,
          reason:
            report.reason || "",
          details:
            report.details || ""
        }
      );

      setModerationQueue(
        await getGroupModerationQueue(
          groupId
        )
      );

      setStatus(
        "Reported Chain post removed."
      );
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't remove that Chain post."
      );
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <section className="hero-card small">
          <h1>Loading group...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-wrap">
        <section className="hero-card small">
          <h1>
            Log in to view groups.
          </h1>

          <Link
            to="/read/login"
            className="button primary"
          >
            Log In
          </Link>
        </section>
      </main>
    );
  }

  if (!group) {
    return (
      <main className="page-wrap">
        <section className="hero-card small">
          <h1>
            Group not found.
          </h1>

          {status && (
            <p className="status">
              {status}
            </p>
          )}

          <Link
            to="/read/profile?tab=groups"
            className="button secondary"
          >
            Back to Groups
          </Link>
        </section>
      </main>
    );
  }

  const tabs = [
    ["overview", "Overview"],
    ["forum", "Forum"],
    ["members", "Members"],
    ...(canModerate
      ? [["moderation", "Moderation"]]
      : []),
    ...(canEditSettings
      ? [["settings", "Settings"]]
      : [])
  ];

  const activeDepthIndex = Math.max(
    0,
    tabs.findIndex(([value]) => value === activeTab)
  );

  function moveGroupDepth(direction) {
    const nextIndex = Math.max(
      0,
      Math.min(
        tabs.length - 1,
        activeDepthIndex + direction
      )
    );

    if (nextIndex !== activeDepthIndex) {
      setActiveTab(tabs[nextIndex][0]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleGroupTouchStart(event) {
    setGroupSwipeStartX(
      event.touches?.[0]?.clientX ?? null
    );
  }

  function handleGroupTouchEnd(event) {
    if (groupSwipeStartX === null) return;

    const endX =
      event.changedTouches?.[0]?.clientX;

    if (typeof endX !== "number") {
      setGroupSwipeStartX(null);
      return;
    }

    const deltaX = endX - groupSwipeStartX;
    setGroupSwipeStartX(null);

    if (Math.abs(deltaX) < 70) return;

    // Same grammar as The Chain:
    // left = deeper, right = back.
    moveGroupDepth(deltaX < 0 ? 1 : -1);
  }

  return (
    <main
      className="page-wrap group-spatial-page"
      onTouchStart={handleGroupTouchStart}
      onTouchEnd={handleGroupTouchEnd}
    >
      <SEO
        title={`${group.name} | Lit Chain`}
        description={
          group.description ||
          "Lit Chain reading group"
        }
        path={`/read/groups/${group.id}`}
        noindex
      />

      <div className="stack-lg">
        <section className="group-spatial-header">
          <div className="group-spatial-heading">
            <GroupAvatar
              group={group}
              size={68}
            />

            <div className="group-spatial-heading-copy">
              <p className="eyebrow">
                {group.type === "class"
                  ? "Class"
                  : "Reading Group"}
              </p>

              <h1>{group.name}</h1>

              <p className="muted">
                {members.length} member
                {members.length === 1 ? "" : "s"}
                {" · "}
                <RoleBadge role={myRole} />
              </p>
            </div>
          </div>

          <div
            className="group-depth-dots"
            aria-label={`Group level ${activeDepthIndex + 1} of ${tabs.length}`}
          >
            {tabs.map(([value, label], index) => (
              <button
                key={value}
                type="button"
                className={
                  index === activeDepthIndex
                    ? "group-depth-dot active"
                    : "group-depth-dot"
                }
                aria-label={label}
                title={label}
                onClick={() => setActiveTab(value)}
              />
            ))}
          </div>
        </section>

        {status && (
          <p className="status group-spatial-status">
            {status}
          </p>
        )}

        {activeTab === "overview" && (
          <section className="group-overview-card">
            <div className="group-overview-avatar">
              <GroupAvatar group={group} size={112} />
            </div>

            <p className="eyebrow">
              Level 0
            </p>

            <h2>{group.name}</h2>

            {group.description && (
              <p className="group-overview-description">
                {group.description}
              </p>
            )}

            <div className="group-overview-meta">
              <span>
                <Users size={16} />
                {members.length} member
                {members.length === 1 ? "" : "s"}
              </span>

              <span>
                <RoleBadge role={myRole} />
              </span>
            </div>

            <p className="muted group-overview-role">
              {groupRoleDescription(myRole)}
            </p>

            <button
              type="button"
              className="button primary group-enter-forum"
              onClick={() => setActiveTab("forum")}
            >
              Enter Forum
              <MessageCircle size={17} />
            </button>

            <div className="group-overview-actions">
              <Link
                to="/read/profile?tab=groups"
                className="button secondary"
              >
                <ArrowLeft size={16} />
                My Groups
              </Link>

              {myRole !== "owner" && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={leave}
                >
                  <LogOut size={16} />
                  Leave
                </button>
              )}
            </div>

            <p className="group-depth-hint">
              Swipe left to go deeper
            </p>
          </section>
        )}

        {activeTab === "forum" && (
          <>
            <section className="group-depth-section-heading">
              <div>
                <p className="eyebrow">Level 1</p>
                <h2>Forum</h2>
              </div>
              <span>Swipe right for overview</span>
            </section>

            <section className="panel profile-panel">
              <h2>
                Start a Discussion
              </h2>

              <form
                onSubmit={
                  createTopic
                }
                className="stack-md profile-edit-form"
              >
                <label>
                  Topic
                  <input
                    value={
                      topicTitle
                    }
                    onChange={(
                      event
                    ) =>
                      setTopicTitle(
                        event.target
                          .value
                      )
                    }
                    placeholder="What should the group discuss?"
                  />
                </label>

                <label>
                  Message
                  <textarea
                    value={
                      topicBody
                    }
                    onChange={(
                      event
                    ) =>
                      setTopicBody(
                        event.target
                          .value
                      )
                    }
                    rows={4}
                    placeholder="Write to the group..."
                  />
                </label>

                <button
                  type="submit"
                  className="button primary"
                >
                  <MessageCircle
                    size={16}
                  />
                  Post Discussion
                </button>
              </form>
            </section>

            <section className="panel profile-panel">
              <h2>Group Forum</h2>

              {forumPosts.length ===
              0 ? (
                <p className="muted">
                  No discussions yet.
                  Start the first
                  one.
                </p>
              ) : (
                <div className="public-profile-entry-list">
                  {forumPosts.map(
                    (post) => {
                      const isAuthor =
                        post.userId ===
                        user.uid;

                      const canModeratePost =
                        canModerateUserContent(
                          post.userId
                        );

                      const replies =
                        forumReplies[
                          post.id
                        ] || [];

                      const isOpen =
                        openTopicId ===
                        post.id;

                      return (
                        <article
                          key={
                            post.id
                          }
                          className="public-profile-entry"
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: "1rem",
                              alignItems:
                                "flex-start"
                            }}
                          >
                            <div>
                              <h3>
                                {post.pinned && (
                                  <Pin
                                    size={
                                      15
                                    }
                                  />
                                )}{" "}
                                {
                                  post.title
                                }
                              </h3>

                              <p className="muted">
                                {post
                                  .authorProfile
                                  ?.displayName ||
                                  "Reader"}
                                {post.createdAtISO
                                  ? ` · ${formatDate(
                                      post.createdAtISO
                                    )}`
                                  : ""}
                                {post.locked
                                  ? " · Locked"
                                  : ""}
                              </p>
                            </div>

                            <div className="button-row">
                              {canModeratePost && (
                                <>
                                  <button
                                    type="button"
                                    className="button secondary"
                                    disabled={
                                      busyTopicId ===
                                      post.id
                                    }
                                    onClick={() =>
                                      toggleTopic(
                                        post,
                                        "pinned"
                                      )
                                    }
                                    title={
                                      post.pinned
                                        ? "Unpin"
                                        : "Pin"
                                    }
                                  >
                                    <Pin
                                      size={
                                        14
                                      }
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    className="button secondary"
                                    disabled={
                                      busyTopicId ===
                                      post.id
                                    }
                                    onClick={() =>
                                      toggleTopic(
                                        post,
                                        "locked"
                                      )
                                    }
                                    title={
                                      post.locked
                                        ? "Unlock"
                                        : "Lock"
                                    }
                                  >
                                    <Lock
                                      size={
                                        14
                                      }
                                    />
                                  </button>
                                </>
                              )}

                              {(canModeratePost ||
                                isAuthor) && (
                                <button
                                  type="button"
                                  className="button secondary"
                                  disabled={
                                    busyTopicId ===
                                    post.id
                                  }
                                  onClick={() =>
                                    deleteTopic(
                                      post
                                    )
                                  }
                                >
                                  <Trash2
                                    size={
                                      14
                                    }
                                  />
                                </button>
                              )}

                              {!isAuthor && (
                                <button
                                  type="button"
                                  className="button secondary"
                                  onClick={() =>
                                    reportForumPost(
                                      post
                                    )
                                  }
                                  title="Report discussion"
                                >
                                  <Flag
                                    size={14}
                                  />
                                </button>
                              )}
                            </div>
                          </div>

                          <p>
                            {post.body}
                          </p>

                          {post.sourceChainEntryId && (
                            <div className="chain-discussion-source">
                              <small>From The Chain</small>
                              <strong>{post.sourceTitle || "Reading note"}</strong>
                              {post.sourceAuthor && <span>{post.sourceAuthor}</span>}
                              {post.sourceParagraphNumber && (
                                <span>Paragraph {post.sourceParagraphNumber}</span>
                              )}
                              {post.sourceParagraphPreview && (
                                <p>“{post.sourceParagraphPreview}”</p>
                              )}
                              {post.sourceNotePreview && (
                                <p>{post.sourceNotePreview}</p>
                              )}
                              {post.sourceBookId && (
                                <Link
                                  to={`/read/reader/${post.sourceBookId}?paragraph=${Math.max(
                                    Number(post.sourceParagraphIndex) || 0,
                                    0
                                  )}&note=${encodeURIComponent(post.sourceChainEntryId)}`}
                                  state={{
                                    book: {
                                      id: post.sourceBookId,
                                      bookId: post.sourceBookId,
                                      title: post.sourceTitle,
                                      author: post.sourceAuthor
                                    }
                                  }}
                                  className="button secondary"
                                >
                                  <BookOpen size={15} />
                                  Read Context
                                </Link>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            className="button secondary"
                            disabled={
                              busyTopicId ===
                              post.id
                            }
                            onClick={() =>
                              openTopic(
                                post
                              )
                            }
                          >
                            <MessageCircle
                              size={15}
                            />
                            {isOpen
                              ? "Hide Replies"
                              : "Replies"}
                          </button>

                          {isOpen && (
                            <div
                              style={{
                                marginTop:
                                  "1rem",
                                paddingTop:
                                  "1rem",
                                borderTop:
                                  "1px solid var(--line)"
                              }}
                            >
                              {replies.map(
                                (
                                  reply
                                ) => {
                                  const isReplyAuthor =
                                    reply.userId ===
                                    user.uid;

                                  const canModerateReply =
                                    canModerateUserContent(
                                      reply.userId
                                    );

                                  return (
                                    <div
                                      key={
                                        reply.id
                                      }
                                      style={{
                                        display:
                                          "grid",
                                        gridTemplateColumns:
                                          "1fr auto",
                                        gap: "0.75rem"
                                      }}
                                    >
                                      <div>
                                        <strong>
                                          {reply
                                            .authorProfile
                                            ?.displayName ||
                                            "Reader"}
                                        </strong>

                                        <small className="muted">
                                          {" · "}
                                          {formatDate(
                                            reply.createdAtISO
                                          )}
                                        </small>

                                        <p>
                                          {
                                            reply.body
                                          }
                                        </p>
                                      </div>

                                      <div className="button-row">
                                        {(canModerateReply ||
                                          isReplyAuthor) && (
                                          <button
                                            type="button"
                                            className="button secondary"
                                            onClick={() =>
                                              deleteForumReply(
                                                post,
                                                reply
                                              )
                                            }
                                          >
                                            <Trash2
                                              size={14}
                                            />
                                          </button>
                                        )}

                                        {!isReplyAuthor && (
                                          <button
                                            type="button"
                                            className="button secondary"
                                            onClick={() =>
                                              reportForumReply(
                                                post,
                                                reply
                                              )
                                            }
                                            title="Report reply"
                                          >
                                            <Flag
                                              size={14}
                                            />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                }
                              )}

                              {!post.locked && (
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    gap: "0.65rem",
                                    marginTop:
                                      "1rem",
                                    alignItems:
                                      "flex-end"
                                  }}
                                >
                                  <textarea
                                    value={
                                      replyText
                                    }
                                    onChange={(
                                      event
                                    ) =>
                                      setReplyText(
                                        event
                                          .target
                                          .value
                                      )
                                    }
                                    rows={
                                      2
                                    }
                                    placeholder="Reply to the group..."
                                    style={{
                                      flex: 1
                                    }}
                                  />

                                  <button
                                    type="button"
                                    className="button primary"
                                    onClick={() =>
                                      sendForumReply(
                                        post
                                      )
                                    }
                                  >
                                    <Send
                                      size={
                                        15
                                      }
                                    />
                                    Reply
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab ===
          "members" && (
          <>
            <section className="panel profile-panel">
              <p className="eyebrow">
                Governance
              </p>

              <h2>
                Roles & Permissions
              </h2>

              <p className="muted">
                Group permissions
                are fixed by role.
                Only the Owner can
                change leadership
                roles or transfer
                ownership.
              </p>

              <PermissionMatrix />
            </section>

            {canManageJoinRequests &&
              joinRequests.length >
                0 && (
                <section className="panel profile-panel">
                  <h2>
                    Join Requests (
                    {
                      joinRequests.length
                    }
                    )
                  </h2>

                  <div className="public-profile-entry-list">
                    {joinRequests.map(
                      (
                        request
                      ) => (
                        <article
                          key={
                            request.userId
                          }
                          className="public-profile-entry"
                        >
                          <Link
                            to={`/read/public/${request.userId}`}
                            className="public-entry-book-title"
                          >
                            {request
                              .profile
                              ?.displayName ||
                              "Reader"}
                          </Link>

                          <div className="button-row">
                            <button
                              type="button"
                              className="button primary"
                              disabled={
                                busyUserId ===
                                request.userId
                              }
                              onClick={() =>
                                handleJoinRequest(
                                  request,
                                  true
                                )
                              }
                            >
                              Accept
                            </button>

                            <button
                              type="button"
                              className="button secondary"
                              disabled={
                                busyUserId ===
                                request.userId
                              }
                              onClick={() =>
                                handleJoinRequest(
                                  request,
                                  false
                                )
                              }
                            >
                              Decline
                            </button>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                </section>
              )}

            <section className="panel profile-panel">
              <h2>
                Members (
                {members.length})
              </h2>

              <div className="public-profile-entry-list">
                {members.map(
                  (member) => {
                    return (
                      <article
                        key={
                          member.userId
                        }
                        className="public-profile-entry"
                      >
                        <Link
                          to={`/read/public/${member.userId}`}
                          className="public-entry-book-title"
                        >
                          {memberName(
                            member
                          )}
                        </Link>

                        {member
                          .profile
                          ?.username && (
                          <p className="muted">
                            @
                            {
                              member
                                .profile
                                .username
                            }
                          </p>
                        )}

                        <p className="muted">
                          <RoleBadge
                            role={
                              member.role
                            }
                          />
                          {member.joinedAtISO
                            ? ` · Joined ${formatDate(
                                member.joinedAtISO
                              )}`
                            : ""}
                        </p>

                        <p className="muted">
                          {groupRoleDescription(
                            member.role
                          )}
                        </p>

                        {canChangeRoles &&
                          member.role !==
                            "owner" && (
                            <label
                              style={{
                                maxWidth:
                                  240
                              }}
                            >
                              Role
                              <select
                                value={
                                  member.role ||
                                  "member"
                                }
                                disabled={
                                  busyUserId ===
                                  member.userId
                                }
                                onChange={(
                                  event
                                ) =>
                                  changeRole(
                                    member,
                                    event
                                      .target
                                      .value
                                  )
                                }
                              >
                                <option value="admin">
                                  Admin
                                </option>
                                <option value="moderator">
                                  Moderator
                                </option>
                                <option value="member">
                                  Member
                                </option>
                              </select>
                            </label>
                          )}

                        {member.userId !==
                          user.uid &&
                          canDisciplineRole(
                            myRole,
                            member.role ||
                              "member"
                          ) && (
                            <div className="button-row">
                              <button
                                type="button"
                                className="button secondary"
                                disabled={
                                  busyUserId ===
                                  member.userId
                                }
                                onClick={() =>
                                  warnMember(
                                    member
                                  )
                                }
                              >
                                <AlertTriangle
                                  size={15}
                                />
                                Warn
                              </button>

                              <button
                                type="button"
                                className="button secondary"
                                disabled={
                                  busyUserId ===
                                  member.userId
                                }
                                onClick={() =>
                                  moderatedRemove(
                                    member
                                  )
                                }
                              >
                                <UserMinus
                                  size={15}
                                />
                                Remove
                              </button>

                              <button
                                type="button"
                                className="button danger"
                                disabled={
                                  busyUserId ===
                                  member.userId
                                }
                                onClick={() =>
                                  banMember(
                                    member
                                  )
                                }
                              >
                                <Ban
                                  size={15}
                                />
                                Ban
                              </button>
                            </div>
                          )}
                      </article>
                    );
                  }
                )}
              </div>
            </section>

            {canInvite && (
              <section className="panel profile-panel">
                <h2>
                  Invite Friends
                </h2>

                {inviteableFriends.length ===
                0 ? (
                  <p className="muted">
                    No friends are
                    currently
                    available to
                    invite.
                  </p>
                ) : (
                  <div className="public-profile-entry-list">
                    {inviteableFriends.map(
                      (
                        friend
                      ) => (
                        <article
                          key={
                            friend.otherUserId
                          }
                          className="public-profile-entry"
                        >
                          <Link
                            to={`/read/public/${friend.otherUserId}`}
                            className="public-entry-book-title"
                          >
                            {friend
                              .profile
                              ?.displayName ||
                              "Reader"}
                          </Link>

                          <button
                            type="button"
                            className="button primary"
                            disabled={
                              busyUserId ===
                              friend.otherUserId
                            }
                            onClick={() =>
                              invite(
                                friend
                              )
                            }
                          >
                            <UserPlus
                              size={
                                16
                              }
                            />
                            Invite
                          </button>
                        </article>
                      )
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {activeTab ===
          "moderation" &&
          canModerate && (
            <>
              <section className="panel profile-panel">
                <p className="eyebrow">
                  Group Moderation
                </p>

                <h2>
                  Reported Discussions & Replies
                </h2>

                {forumModerationReports.length ===
                0 ? (
                  <p className="muted">
                    No open discussion or reply reports.
                  </p>
                ) : (
                  <div className="public-profile-entry-list">
                    {forumModerationReports.map(
                      (
                        report
                      ) => (
                        <article
                          key={
                            report.id
                          }
                          className="public-profile-entry"
                        >
                          <strong>
                            {report.contentType ===
                            "forum_reply"
                              ? "Reported Reply"
                              : "Reported Discussion"}
                          </strong>

                          <p className="muted">
                            By{" "}
                            {report
                              .reportedProfile
                              ?.displayName ||
                              "Reader"}
                            {" · Reported by "}
                            {report
                              .reporterProfile
                              ?.displayName ||
                              "a member"}
                          </p>

                          {report.title && (
                            <h3>
                              {
                                report.title
                              }
                            </h3>
                          )}

                          <p>
                            {report.body}
                          </p>

                          <p>
                            <strong>
                              Reason:
                            </strong>{" "}
                            {report.reason ||
                              "Other"}
                          </p>

                          {report.details && (
                            <p>
                              <strong>
                                Details:
                              </strong>{" "}
                              {
                                report.details
                              }
                            </p>
                          )}

                          <div className="button-row">
                            <button
                              type="button"
                              className="button danger"
                              onClick={() =>
                                removeForumReportContent(
                                  report
                                )
                              }
                            >
                              <Trash2
                                size={16}
                              />
                              Remove Content
                            </button>

                            <button
                              type="button"
                              className="button secondary"
                              onClick={() =>
                                resolveForumReport(
                                  report,
                                  "dismissed"
                                )
                              }
                            >
                              Dismiss
                            </button>

                            <button
                              type="button"
                              className="button secondary"
                              onClick={() =>
                                resolveForumReport(
                                  report,
                                  "resolved"
                                )
                              }
                            >
                              Resolve
                            </button>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                )}
              </section>

              <section className="panel profile-panel">
                <p className="eyebrow">
                  Chain Moderation
                </p>

                <h2>
                  Reported Chain Posts
                </h2>

                {moderationQueue.length ===
                0 ? (
                  <p className="muted">
                    No open group Chain post reports.
                  </p>
                ) : (
                  <div className="public-profile-entry-list">
                    {moderationQueue.map(
                      (
                        report
                      ) => (
                        <article
                          key={
                            report.id
                          }
                          className="public-profile-entry"
                        >
                          <strong>
                            {report
                              .reportedProfile
                              ?.displayName ||
                              "Reported reader"}
                          </strong>

                          <p>
                            <strong>
                              Reason:
                            </strong>{" "}
                            {report.reason ||
                              "Other"}
                          </p>

                          {report.details && (
                            <p>
                              {
                                report.details
                              }
                            </p>
                          )}

                          {report.chainEntry && (
                            <>
                              <p className="muted">
                                {report
                                  .chainEntry
                                  .title ||
                                  "Untitled"}
                              </p>

                              <p>
                                {report
                                  .chainEntry
                                  .note}
                              </p>
                            </>
                          )}

                          <div className="button-row">
                            {report.chainEntry && (
                              <button
                                type="button"
                                className="button danger"
                                onClick={() =>
                                  handleDeleteReportedChainEntry(
                                    report
                                  )
                                }
                              >
                                <Trash2
                                  size={16}
                                />
                                Delete Chain Post
                              </button>
                            )}

                            <button
                              type="button"
                              className="button secondary"
                              onClick={() =>
                                handleResolveReport(
                                  report,
                                  "dismissed"
                                )
                              }
                            >
                              Dismiss
                            </button>

                            <button
                              type="button"
                              className="button secondary"
                              onClick={() =>
                                handleResolveReport(
                                  report,
                                  "resolved"
                                )
                              }
                            >
                              Resolve
                            </button>
                          </div>
                        </article>
                      )
                    )}
                  </div>
                )}
              </section>

              <section className="panel profile-panel">
                <p className="eyebrow">
                  Enforcement
                </p>

                <h2>
                  Banned Readers
                </h2>

                {groupBans.length ===
                0 ? (
                  <p className="muted">
                    No readers are banned from this group.
                  </p>
                ) : (
                  <div className="public-profile-entry-list">
                    {groupBans.map(
                      (
                        ban
                      ) => (
                        <article
                          key={
                            ban.id
                          }
                          className="public-profile-entry"
                        >
                          <strong>
                            {ban
                              .profile
                              ?.displayName ||
                              "Reader"}
                          </strong>

                          <p>
                            <strong>
                              Reason:
                            </strong>{" "}
                            {ban.reason ||
                              "No reason recorded"}
                          </p>

                          <p className="muted">
                            {ban.createdAtISO
                              ? `Banned ${formatDate(
                                  ban.createdAtISO
                                )}`
                              : ""}
                          </p>

                          <button
                            type="button"
                            className="button secondary"
                            onClick={() =>
                              liftBan(
                                ban
                              )
                            }
                          >
                            <RotateCcw
                              size={15}
                            />
                            Lift Ban
                          </button>
                        </article>
                      )
                    )}
                  </div>
                )}
              </section>

              <section className="panel profile-panel">
                <p className="eyebrow">
                  <History
                    size={15}
                  />{" "}
                  Audit Trail
                </p>

                <h2>
                  Moderation History
                </h2>

                {moderationActions.length ===
                0 ? (
                  <p className="muted">
                    No moderation actions have been recorded yet.
                  </p>
                ) : (
                  <div className="public-profile-entry-list">
                    {moderationActions.map(
                      (
                        action
                      ) => (
                        <article
                          key={
                            action.id
                          }
                          className="public-profile-entry"
                        >
                          <strong>
                            {String(
                              action.action ||
                                ""
                            ).replaceAll(
                              "_",
                              " "
                            )}
                          </strong>

                          <p className="muted">
                            By{" "}
                            {action
                              .moderatorProfile
                              ?.displayName ||
                              "Moderator"}
                            {action.targetProfile
                              ? ` · ${
                                  action
                                    .targetProfile
                                    .displayName ||
                                  "Reader"
                                }`
                              : ""}
                            {action.createdAtISO
                              ? ` · ${formatDate(
                                  action.createdAtISO
                                )}`
                              : ""}
                          </p>

                          {action.reason && (
                            <p>
                              <strong>
                                Reason:
                              </strong>{" "}
                              {
                                action.reason
                              }
                            </p>
                          )}

                          {action.details && (
                            <p>
                              {
                                action.details
                              }
                            </p>
                          )}
                        </article>
                      )
                    )}
                  </div>
                )}
              </section>
            </>
          )}

        {activeTab ===
          "settings" &&
          canEditSettings && (
            <section className="panel profile-panel">
              <h2>
                <Settings
                  size={19}
                />{" "}
                Group Settings
              </h2>

              <form
                onSubmit={
                  saveSettings
                }
                className="stack-md profile-edit-form"
              >
                <label>
                  Group name
                  <input
                    value={
                      settings.name
                    }
                    onChange={(
                      event
                    ) =>
                      setSettings(
                        (
                          current
                        ) => ({
                          ...current,
                          name:
                            event
                              .target
                              .value
                        })
                      )
                    }
                  />
                </label>

                <label>
                  Description
                  <textarea
                    rows={4}
                    value={
                      settings.description
                    }
                    onChange={(
                      event
                    ) =>
                      setSettings(
                        (
                          current
                        ) => ({
                          ...current,
                          description:
                            event
                              .target
                              .value
                        })
                      )
                    }
                  />
                </label>

                <div>
                  <strong>
                    Group avatar
                  </strong>

                  <div className="profile-avatar-grid">
                    {GROUP_AVATARS.map(
                      (
                        avatar
                      ) => {
                        const selected =
                          settings.avatar ===
                            avatar.image ||
                          settings.avatar ===
                            avatar.id;

                        return (
                          <button
                            key={
                              avatar.id
                            }
                            type="button"
                            className={
                              selected
                                ? "profile-avatar-option selected"
                                : "profile-avatar-option"
                            }
                            onClick={() =>
                              setSettings(
                                (
                                  current
                                ) => ({
                                  ...current,
                                  avatar:
                                    avatar.id
                                })
                              )
                            }
                          >
                            <img
                              src={
                                avatar.image
                              }
                              alt=""
                            />
                            <span>
                              {
                                avatar.name
                              }
                            </span>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <label>
                  Visibility
                  <select
                    value={
                      settings.visibility
                    }
                    onChange={(
                      event
                    ) =>
                      setSettings(
                        (
                          current
                        ) => ({
                          ...current,
                          visibility:
                            event
                              .target
                              .value
                        })
                      )
                    }
                  >
                    <option value="private">
                      Private
                    </option>
                    <option value="discoverable">
                      Discoverable
                    </option>
                    <option value="public">
                      Public
                    </option>
                  </select>
                </label>

                <label>
                  Joining
                  <select
                    value={
                      settings.joinPolicy
                    }
                    onChange={(
                      event
                    ) =>
                      setSettings(
                        (
                          current
                        ) => ({
                          ...current,
                          joinPolicy:
                            event
                              .target
                              .value
                        })
                      )
                    }
                  >
                    <option value="invite_only">
                      Invite only
                    </option>
                    <option value="request_to_join">
                      Request to join
                    </option>
                    <option value="open">
                      Open
                    </option>
                  </select>
                </label>

                <button
                  type="submit"
                  className="button primary"
                >
                  Save Group
                  Settings
                </button>
              </form>

              {(canTransferOwnership ||
                canDeleteGroup) && (
                <div className="group-danger-zone">
                  <p className="eyebrow">
                    Owner Controls
                  </p>

                  {canTransferOwnership && (
                    <>
                      <h3>
                        Transfer
                        Ownership
                      </h3>

                      <p className="muted">
                        The selected
                        member becomes
                        Owner
                        immediately.
                        You become an
                        Admin. The
                        transfer is
                        atomic: the
                        group can never
                        be left without
                        an Owner.
                      </p>

                      <select
                        value={
                          transferOwnerId
                        }
                        onChange={(
                          event
                        ) =>
                          setTransferOwnerId(
                            event
                              .target
                              .value
                          )
                        }
                        disabled={
                          dangerBusy
                        }
                      >
                        <option value="">
                          Choose a
                          member...
                        </option>

                        {members
                          .filter(
                            (
                              member
                            ) =>
                              member.userId !==
                                user.uid &&
                              ![
                                "removed",
                                "suspended"
                              ].includes(
                                member.status
                              )
                          )
                          .map(
                            (
                              member
                            ) => (
                              <option
                                key={
                                  member.userId
                                }
                                value={
                                  member.userId
                                }
                              >
                                {memberName(
                                  member
                                )}{" "}
                                —{" "}
                                {groupRoleLabel(
                                  member.role
                                )}
                              </option>
                            )
                          )}
                      </select>

                      <button
                        type="button"
                        className="button secondary"
                        disabled={
                          dangerBusy ||
                          !transferOwnerId
                        }
                        onClick={
                          handleTransferOwnership
                        }
                      >
                        <Crown
                          size={16}
                        />
                        Transfer
                        Ownership
                      </button>
                    </>
                  )}

                  {canDeleteGroup && (
                    <>
                      <hr />

                      <h3>
                        Delete Group
                      </h3>

                      <p className="muted">
                        Permanent and
                        irreversible.
                      </p>

                      <button
                        type="button"
                        className="button danger"
                        disabled={
                          dangerBusy
                        }
                        onClick={
                          handleDeleteGroup
                        }
                      >
                        <Trash2
                          size={16}
                        />
                        Delete Group
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
      </div>
    </main>
  );
}
