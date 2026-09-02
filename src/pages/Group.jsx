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
  RotateCcw,
  Link2,
  Unlink2,
  Plus
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
  getMyGroupForumVote,
  replyToGroupForumPost,
  voteOnGroupForumNode,
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
  ] = useState("forum");

  const [
    discussionIndex,
    setDiscussionIndex
  ] = useState(0);

  const [
    spatialSwipeStartX,
    setSpatialSwipeStartX
  ] = useState(null);

  const [
    replyModePostId,
    setReplyModePostId
  ] = useState(null);

  const [
    replyLevels,
    setReplyLevels
  ] = useState([]);

  const [
    discussionComposerOpen,
    setDiscussionComposerOpen
  ] = useState(false);

  const [
    replyComposerParentId,
    setReplyComposerParentId
  ] = useState(undefined);

  const [
    forumVotes,
    setForumVotes
  ] = useState({});

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
      setDiscussionComposerOpen(false);
      setDiscussionIndex(0);

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

  function replyChildren(replies, parentReplyId) {
    const replyIds = new Set(
      replies.map((reply) => String(reply.id))
    );

    return replies
      .filter((reply) =>
        parentReplyId
          ? String(reply.parentReplyId || "") === String(parentReplyId)
          : (
              !reply.parentReplyId
              || !replyIds.has(String(reply.parentReplyId))
            )
      )
      .sort((a, b) => {
        const scoreDifference =
          Number(b.forumScore || 0) - Number(a.forumScore || 0);

        if (scoreDifference !== 0) return scoreDifference;

        const upDifference =
          Number(b.forumUpCount || 0) - Number(a.forumUpCount || 0);

        if (upDifference !== 0) return upDifference;

        return String(a.createdAtISO || "").localeCompare(
          String(b.createdAtISO || "")
        );
      });
  }

  async function loadTopicReplies(post) {
    setBusyTopicId(post.id);
    setStatus("");

    try {
      const replies = await getGroupForumReplies(
        groupId,
        post.id
      );

      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));

      return replies;
    } catch (error) {
      setStatus(
        error?.message || "We couldn't load that discussion."
      );
      return [];
    } finally {
      setBusyTopicId(null);
    }
  }

  async function enterTopicReplies(post) {
    const replies =
      forumReplies[post.id] || await loadTopicReplies(post);
    const roots = replyChildren(replies, null);

    if (!roots.length) {
      setReplyComposerParentId(null);
      return;
    }

    setReplyModePostId(post.id);
    setReplyLevels([
      {
        parentReplyId: null,
        items: roots,
        selectedIndex: 0
      }
    ]);
    setReplyText("");
  }

  function currentReplyItem() {
    const level = replyLevels[replyLevels.length - 1];
    return level?.items?.[level.selectedIndex] || null;
  }

  function enterReplyChildren(post, reply) {
    const allReplies = forumReplies[post.id] || [];
    const children = replyChildren(allReplies, reply.id);

    if (!children.length) {
      setReplyComposerParentId(reply.id);
      return;
    }

    setReplyLevels((current) => [
      ...current,
      {
        parentReplyId: reply.id,
        items: children,
        selectedIndex: 0
      }
    ]);
  }

  function backReplyDepth() {
    if (replyLevels.length > 1) {
      setReplyLevels((current) => current.slice(0, -1));
      return;
    }

    setReplyLevels([]);
    setReplyModePostId(null);
  }

  async function sendForumReply(
    post,
    parentReplyId = null
  ) {
    if (!replyText.trim()) return;

    try {
      setBusyTopicId(post.id);
      setStatus("");

      const created = await replyToGroupForumPost(
        groupId,
        post.id,
        replyText,
        { parentReplyId }
      );

      const replies = await getGroupForumReplies(
        groupId,
        post.id
      );

      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));

      setReplyText("");
      setReplyComposerParentId(undefined);

      setForumPosts(
        await getGroupForumPosts(groupId)
      );

      if (replyModePostId === post.id) {
        const nextItems = replyChildren(replies, parentReplyId);
        setReplyLevels((current) => {
          if (!current.length) {
            return [{
              parentReplyId,
              items: nextItems,
              selectedIndex: Math.max(
                0,
                nextItems.findIndex((item) => item.id === created.id)
              )
            }];
          }

          const next = [...current];
          const lastIndex = next.length - 1;
          if (String(next[lastIndex].parentReplyId || "") === String(parentReplyId || "")) {
            next[lastIndex] = {
              ...next[lastIndex],
              items: nextItems,
              selectedIndex: Math.max(
                0,
                nextItems.findIndex((item) => item.id === created.id)
              )
            };
          }
          return next;
        });
      }
    } catch (error) {
      setStatus(
        error?.message || "We couldn't post that reply."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  function voteKey(targetType, targetId) {
    return `${targetType}:${targetId}`;
  }

  async function ensureForumVote(targetType, targetId) {
    const key = voteKey(targetType, targetId);
    if (Object.prototype.hasOwnProperty.call(forumVotes, key)) return;

    try {
      const direction = await getMyGroupForumVote(
        groupId,
        { targetType, targetId }
      );
      setForumVotes((current) => ({
        ...current,
        [key]: direction
      }));
    } catch (error) {
      console.warn("Could not load forum vote:", error);
    }
  }

  async function castForumVote(post, reply, direction) {
    const targetType = reply ? "reply" : "post";
    const targetId = reply?.id || post.id;
    const key = voteKey(targetType, targetId);

    try {
      const result = await voteOnGroupForumNode(
        groupId,
        post.id,
        {
          replyId: reply?.id || null,
          direction
        }
      );

      setForumVotes((current) => ({
        ...current,
        [key]: result.direction
      }));

      if (reply) {
        setForumReplies((current) => ({
          ...current,
          [post.id]: (current[post.id] || []).map((item) =>
            item.id === reply.id
              ? { ...item, ...result }
              : item
          )
        }));

        setReplyLevels((current) =>
          current.map((level) => ({
            ...level,
            items: level.items.map((item) =>
              item.id === reply.id
                ? { ...item, ...result }
                : item
            )
          }))
        );
      } else {
        setForumPosts((current) =>
          current.map((item) =>
            item.id === post.id
              ? { ...item, ...result }
              : item
          )
        );
      }
    } catch (error) {
      setStatus(
        error?.message || "We couldn't update that vote."
      );
    }
  }

  function handleDiscussionScroll(event) {
    const height = event.currentTarget.clientHeight;
    if (!height) return;
    const next = Math.round(event.currentTarget.scrollTop / height);
    setDiscussionIndex(
      Math.max(0, Math.min(forumPosts.length - 1, next))
    );
  }

  function handleReplyScroll(event) {
    const levelIndex = replyLevels.length - 1;
    const height = event.currentTarget.clientHeight;
    if (levelIndex < 0 || !height) return;

    const nextIndex = Math.round(event.currentTarget.scrollTop / height);

    setReplyLevels((current) => {
      if (!current[levelIndex]) return current;
      const next = [...current];
      next[levelIndex] = {
        ...next[levelIndex],
        selectedIndex: Math.max(
          0,
          Math.min(next[levelIndex].items.length - 1, nextIndex)
        )
      };
      return next;
    });
  }

  function handleSpatialTouchStart(event) {
    setSpatialSwipeStartX(
      event.touches?.[0]?.clientX ?? null
    );
  }

  async function handleSpatialTouchEnd(event) {
    if (spatialSwipeStartX === null) return;

    const endX = event.changedTouches?.[0]?.clientX;
    if (typeof endX !== "number") {
      setSpatialSwipeStartX(null);
      return;
    }

    const deltaX = endX - spatialSwipeStartX;
    setSpatialSwipeStartX(null);

    if (Math.abs(deltaX) < 70) return;

    const post = replyModePostId
      ? forumPosts.find((item) => item.id === replyModePostId)
      : forumPosts[discussionIndex];

    if (!post) return;

    if (deltaX > 0) {
      if (replyModePostId) {
        const reply = currentReplyItem();
        if (reply) enterReplyChildren(post, reply);
      } else {
        await enterTopicReplies(post);
      }
      return;
    }

    if (replyModePostId) {
      backReplyDepth();
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

  const selectedDiscussion =
    forumPosts[discussionIndex] || null;

  const selectedReply = currentReplyItem();

  useEffect(() => {
    if (activeTab !== "forum") return;

    if (replyModePostId && selectedReply) {
      ensureForumVote("reply", selectedReply.id);
      return;
    }

    if (selectedDiscussion) {
      ensureForumVote("post", selectedDiscussion.id);
    }
  }, [
    activeTab,
    replyModePostId,
    selectedReply?.id,
    selectedDiscussion?.id
  ]);

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

      <div className="stack-lg group-spatial-shell">
        <section className="group-floating-card">
          <button
            type="button"
            className="group-floating-identity"
            onClick={() => {
              setActiveTab("forum");
              setReplyModePostId(null);
              setReplyLevels([]);
            }}
          >
            <GroupAvatar group={group} size={48} />

            <span>
              <small>
                {group.type === "class" ? "Class" : "Reading Group"}
              </small>
              <strong>{group.name}</strong>
            </span>
          </button>

          <div className="group-floating-actions">
            <button
              type="button"
              className={activeTab === "members" ? "active" : ""}
              onClick={() => setActiveTab("members")}
              aria-label="Members"
              title="Members"
            >
              <Users size={20} />
            </button>

            <button
              type="button"
              className={
                activeTab === "settings" || activeTab === "moderation"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab(
                  canEditSettings
                    ? "settings"
                    : canModerate
                      ? "moderation"
                      : "forum"
                )
              }
              aria-label="Settings"
              title={canModerate ? "Settings & moderation" : "Settings"}
            >
              <Settings size={20} />
            </button>
          </div>
        </section>

        {status && (
          <p className="status group-spatial-status">
            {status}
          </p>
        )}

        {activeTab === "forum" && (
          <section
            className="group-forum-spatial-stage"
            onTouchStart={handleSpatialTouchStart}
            onTouchEnd={handleSpatialTouchEnd}
          >
            {!replyModePostId ? (
              <>
                {forumPosts.length === 0 ? (
                  <div className="group-discussion-empty">
                    <MessageCircle size={38} />
                    <h2>No discussions yet</h2>
                    <p className="muted">
                      Start the first discussion for this group.
                    </p>
                    <button
                      type="button"
                      className="button primary"
                      onClick={() => setDiscussionComposerOpen(true)}
                    >
                      <Plus size={17} />
                      New Discussion
                    </button>
                  </div>
                ) : (
                  <div
                    className="group-discussion-reels"
                    onScroll={handleDiscussionScroll}
                  >
                    {forumPosts.map((post) => {
                      const isAuthor = post.userId === user.uid;
                      const canModeratePost = canModerateUserContent(post.userId);
                      const vote = forumVotes[voteKey("post", post.id)] || 0;

                      return (
                        <article
                          key={post.id}
                          className="group-discussion-reel"
                          onMouseEnter={() => ensureForumVote("post", post.id)}
                        >
                          <div className="group-discussion-card">
                            <div className="group-discussion-meta-row">
                              <span>
                                {post.authorProfile?.displayName || "Reader"}
                                {post.createdAtISO
                                  ? ` · ${formatDate(post.createdAtISO)}`
                                  : ""}
                              </span>

                              <div className="group-discussion-tools">
                                {canModeratePost && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => toggleTopic(post, "pinned")}
                                      title={post.pinned ? "Unpin" : "Pin"}
                                    >
                                      <Pin size={15} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => toggleTopic(post, "locked")}
                                      title={post.locked ? "Unlock" : "Lock"}
                                    >
                                      <Lock size={15} />
                                    </button>
                                  </>
                                )}

                                {(canModeratePost || isAuthor) && (
                                  <button
                                    type="button"
                                    onClick={() => deleteTopic(post)}
                                    title="Delete"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}

                                {!isAuthor && (
                                  <button
                                    type="button"
                                    onClick={() => reportForumPost(post)}
                                    title="Report"
                                  >
                                    <Flag size={15} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="group-discussion-copy">
                              <p className="eyebrow">
                                {post.pinned ? "Pinned Discussion" : "Discussion"}
                              </p>
                              <h1>{post.title}</h1>
                              <p>{post.body}</p>

                              {post.sourceChainEntryId && (
                                <div className="chain-discussion-source">
                                  <small>From The Chain</small>
                                  <strong>{post.sourceTitle || "Reading note"}</strong>
                                  {post.sourceAuthor && <span>{post.sourceAuthor}</span>}
                                  {post.sourceParagraphPreview && (
                                    <p>“{post.sourceParagraphPreview}”</p>
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
                            </div>

                            <div className="group-forum-vote-row">
                              <button
                                type="button"
                                className={vote === 1 ? "active" : ""}
                                onClick={() => castForumVote(post, null, 1)}
                              >
                                <Link2 size={18} />
                                <span>{Number(post.forumUpCount || 0)}</span>
                              </button>

                              <strong>{Number(post.forumScore || 0)}</strong>

                              <button
                                type="button"
                                className={vote === -1 ? "active" : ""}
                                onClick={() => castForumVote(post, null, -1)}
                              >
                                <Unlink2 size={18} />
                                <span>{Number(post.forumDownCount || 0)}</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              className="group-swipe-deeper-cue"
                              onClick={() => enterTopicReplies(post)}
                            >
                              Swipe right for replies
                              <MessageCircle size={16} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

                {forumPosts.length > 0 && (
                  <div className="group-discussion-dots">
                    {forumPosts
                      .slice(
                        Math.max(0, discussionIndex - 3),
                        Math.min(forumPosts.length, discussionIndex + 4)
                      )
                      .map((post, localIndex) => {
                        const start = Math.max(0, discussionIndex - 3);
                        const index = start + localIndex;
                        return (
                          <span
                            key={post.id}
                            className={index === discussionIndex ? "active" : ""}
                          />
                        );
                      })}
                  </div>
                )}

                <button
                  type="button"
                  className="group-new-discussion-fab"
                  onClick={() => setDiscussionComposerOpen(true)}
                  aria-label="New discussion"
                  title="New discussion"
                >
                  <Plus size={22} />
                </button>
              </>
            ) : (
              <div className="group-reply-space">
                <div className="group-reply-depth-header">
                  <button
                    type="button"
                    onClick={backReplyDepth}
                  >
                    <ArrowLeft size={17} />
                    {replyLevels.length > 1 ? "Back" : "Discussion"}
                  </button>

                  <div className="group-reply-depth-dots">
                    <span className="active" />
                    {replyLevels.map((_, index) => (
                      <span
                        key={index}
                        className={index === replyLevels.length - 1 ? "active" : ""}
                      />
                    ))}
                  </div>
                </div>

                <div
                  className="group-reply-reels"
                  onScroll={handleReplyScroll}
                >
                  {(replyLevels[replyLevels.length - 1]?.items || []).map((reply) => {
                    const post = forumPosts.find((item) => item.id === replyModePostId);
                    const isReplyAuthor = reply.userId === user.uid;
                    const canModerateReply = canModerateUserContent(reply.userId);
                    const vote = forumVotes[voteKey("reply", reply.id)] || 0;

                    return (
                      <article
                        key={reply.id}
                        className="group-reply-reel"
                        onMouseEnter={() => ensureForumVote("reply", reply.id)}
                      >
                        <div className="group-reply-card">
                          <div className="group-discussion-meta-row">
                            <span>
                              {reply.authorProfile?.displayName || "Reader"}
                              {reply.createdAtISO
                                ? ` · ${formatDate(reply.createdAtISO)}`
                                : ""}
                            </span>

                            <div className="group-discussion-tools">
                              {(canModerateReply || isReplyAuthor) && (
                                <button
                                  type="button"
                                  onClick={() => deleteForumReply(post, reply)}
                                  title="Delete"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}

                              {!isReplyAuthor && (
                                <button
                                  type="button"
                                  onClick={() => reportForumReply(post, reply)}
                                  title="Report"
                                >
                                  <Flag size={15} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="group-reply-copy">
                            <p className="eyebrow">
                              Reply · Level {replyLevels.length}
                            </p>
                            <p>{reply.body}</p>
                          </div>

                          <div className="group-forum-vote-row">
                            <button
                              type="button"
                              className={vote === 1 ? "active" : ""}
                              onClick={() => castForumVote(post, reply, 1)}
                            >
                              <Link2 size={18} />
                              <span>{Number(reply.forumUpCount || 0)}</span>
                            </button>

                            <strong>{Number(reply.forumScore || 0)}</strong>

                            <button
                              type="button"
                              className={vote === -1 ? "active" : ""}
                              onClick={() => castForumVote(post, reply, -1)}
                            >
                              <Unlink2 size={18} />
                              <span>{Number(reply.forumDownCount || 0)}</span>
                            </button>
                          </div>

                          <div className="group-reply-actions">
                            <button
                              type="button"
                              className="group-swipe-deeper-cue"
                              onClick={() => enterReplyChildren(post, reply)}
                            >
                              Swipe right for replies
                              <MessageCircle size={16} />
                            </button>

                            {!post?.locked && (
                              <button
                                type="button"
                                className="group-reply-add-button"
                                onClick={() => setReplyComposerParentId(reply.id)}
                              >
                                <Plus size={15} />
                                Reply
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {discussionComposerOpen && (
          <div className="margin-modal-backdrop">
            <section className="margin-report-modal group-compose-modal">
              <div className="margin-report-heading">
                <div>
                  <p className="eyebrow">Group Forum</p>
                  <h2>New Discussion</h2>
                </div>
                <button
                  type="button"
                  className="margin-close-button"
                  onClick={() => setDiscussionComposerOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={createTopic} className="profile-edit-form">
                <label>
                  Topic
                  <input
                    value={topicTitle}
                    onChange={(event) => setTopicTitle(event.target.value)}
                    placeholder="What should the group discuss?"
                  />
                </label>

                <label>
                  Message
                  <textarea
                    rows={5}
                    value={topicBody}
                    onChange={(event) => setTopicBody(event.target.value)}
                    placeholder="Write to the group..."
                  />
                </label>

                <button type="submit" className="button primary">
                  <Send size={16} />
                  Post Discussion
                </button>
              </form>
            </section>
          </div>
        )}

        {replyComposerParentId !== undefined && (
          <div className="margin-modal-backdrop">
            <section className="margin-report-modal group-compose-modal">
              <div className="margin-report-heading">
                <div>
                  <p className="eyebrow">Continue the Thread</p>
                  <h2>Write a Reply</h2>
                </div>
                <button
                  type="button"
                  className="margin-close-button"
                  onClick={() => {
                    setReplyComposerParentId(undefined);
                    setReplyText("");
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <textarea
                rows={5}
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Reply to this idea..."
              />

              <button
                type="button"
                className="button primary"
                disabled={busyTopicId === (replyModePostId || selectedDiscussion?.id)}
                onClick={() => {
                  const post = replyModePostId
                    ? forumPosts.find((item) => item.id === replyModePostId)
                    : selectedDiscussion;
                  if (post) sendForumReply(post, replyComposerParentId || null);
                }}
              >
                <Send size={16} />
                Post Reply
              </button>
            </section>
          </div>
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
              <button
                type="button"
                className="button secondary group-moderation-back"
                onClick={() => setActiveTab("settings")}
              >
                <ArrowLeft size={16} />
                Settings
              </button>
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

              {canModerate && (
                <button
                  type="button"
                  className="button secondary group-settings-moderation-link"
                  onClick={() => setActiveTab("moderation")}
                >
                  <Shield size={16} />
                  Moderation
                </button>
              )}

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
