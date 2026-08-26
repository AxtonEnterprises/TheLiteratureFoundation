import {
  useEffect,
  useMemo,
  useState
} from "react";

import { onAuthStateChanged } from "firebase/auth";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
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
  Users
} from "lucide-react";

import { auth } from "../firebase";

import {
  getFriends,
  getGroup,
  deleteGroupPermanently,
  deleteReportedGroupMargin,
  getGroupMembers,
  getGroupJoinRequests,
  getGroupModerationQueue,
  inviteFriendToGroup,
  leaveGroup,
  removeGroupMember,
  respondToGroupJoinRequest,
  resolveGroupMarginReport,
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

import SEO from "../components/SEO.jsx";

function roleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  return "Member";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function GroupAvatar({ group, size = 92 }) {
  const preset = getGroupAvatar(group?.avatar);
  const src = preset?.image || group?.avatar || "";

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
        <Users size={Math.round(size * 0.42)} />
      )}
    </div>
  );
}

export default function Group() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [transferOwnerId, setTransferOwnerId] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);
  const [forumPosts, setForumPosts] = useState([]);
  const [forumReplies, setForumReplies] = useState({});
  const [openTopicId, setOpenTopicId] = useState(null);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicBody, setTopicBody] = useState("");
  const [replyText, setReplyText] = useState("");
  const [activeTab, setActiveTab] = useState("forum");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [busyUserId, setBusyUserId] = useState(null);
  const [busyTopicId, setBusyTopicId] = useState(null);

  const [settings, setSettings] = useState({
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
        name: loadedGroup.name || "",
        description: loadedGroup.description || "",
        avatar: loadedGroup.avatar || "",
        type: loadedGroup.type === "class" ? "class" : "group",
        visibility: loadedGroup.visibility || "private",
        joinPolicy: loadedGroup.joinPolicy || "invite_only"
      });
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
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
        console.error("Could not load group:", error);
        setStatus(
          error?.message || "We couldn't load this group."
        );
      } finally {
        setLoading(false);
      }
    });
  }, [groupId]);

  const memberIds = useMemo(
    () => new Set(members.map((member) => String(member.userId))),
    [members]
  );

  const inviteableFriends = friends.filter(
    (friend) => !memberIds.has(String(friend.otherUserId))
  );

  const myRole = group?.membership?.role || "member";
  const canManage = ["owner", "admin"].includes(myRole);
  const canModerate = ["owner", "admin", "moderator"].includes(myRole);

  useEffect(() => {
    let active = true;

    async function loadJoinRequests() {
      if (!canManage) {
        setJoinRequests([]);
        return;
      }

      try {
        const requests = await getGroupJoinRequests(groupId);
        if (active) {
          setJoinRequests(requests);
        }
      } catch (error) {
        console.error("Could not load join requests:", error);
      }
    }

    loadJoinRequests();

    return () => {
      active = false;
    };
  }, [groupId, canManage]);

  useEffect(() => {
    let active = true;

    async function loadModerationQueue() {
      if (!canModerate) {
        setModerationQueue([]);
        return;
      }

      try {
        const reports = await getGroupModerationQueue(groupId);
        if (active) {
          setModerationQueue(reports);
        }
      } catch (error) {
        console.error("Could not load moderation queue:", error);
      }
    }

    loadModerationQueue();

    return () => {
      active = false;
    };
  }, [groupId, canModerate]);

  async function handleJoinRequest(request, accept) {
    try {
      setBusyUserId(request.userId);
      setStatus("");

      await respondToGroupJoinRequest(
        groupId,
        request.userId,
        accept
      );

      setJoinRequests(
        await getGroupJoinRequests(groupId)
      );

      await refresh();

      setStatus(
        accept
          ? "Join request approved."
          : "Join request declined."
      );
    } catch (error) {
      setStatus(
        error?.message || "We couldn't update that join request."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function handleTransferOwnership() {
    if (!transferOwnerId) {
      setStatus("Choose a member to receive ownership.");
      return;
    }

    const nextOwner = members.find(
      (member) => member.userId === transferOwnerId
    );

    const confirmed = window.confirm(
      `Transfer ownership to ${
        nextOwner?.profile?.displayName || "this member"
      }? You will become an admin.`
    );

    if (!confirmed) {
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
      setStatus("Ownership transferred.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't transfer ownership."
      );
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleDeleteGroup() {
    const confirmed = window.confirm(
      `Permanently delete "${group?.name || "this group"}"? This removes members, invitations, join requests, forum posts, and forum replies. This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const secondConfirmation = window.prompt(
      'Type DELETE to permanently remove this group.'
    );

    if (secondConfirmation !== "DELETE") {
      setStatus("Group deletion canceled.");
      return;
    }

    try {
      setDangerBusy(true);
      setStatus("");

      await deleteGroupPermanently(groupId);

      navigate("/read/profile?tab=groups");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't delete this group."
      );
    } finally {
      setDangerBusy(false);
    }
  }

  async function handleResolveReport(report, resolution) {
    try {
      setStatus("");

      await resolveGroupMarginReport(
        groupId,
        report.id,
        resolution
      );

      setModerationQueue(
        await getGroupModerationQueue(groupId)
      );

      setStatus(
        resolution === "dismissed"
          ? "Report dismissed."
          : "Report resolved."
      );
    } catch (error) {
      setStatus(
        error?.message || "We couldn't update that report."
      );
    }
  }

  async function handleDeleteReportedMargin(report) {
    if (
      !window.confirm(
        "Delete this reported group Margin? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      setStatus("");

      await deleteReportedGroupMargin(
        groupId,
        report
      );

      setModerationQueue(
        await getGroupModerationQueue(groupId)
      );

      setStatus("Reported Margin removed.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't remove that Margin."
      );
    }
  }

  async function invite(friend) {
    try {
      setBusyUserId(friend.otherUserId);
      setStatus("");
      await inviteFriendToGroup(groupId, friend.otherUserId);
      setStatus(
        `Invitation sent to ${
          friend.profile?.displayName || "reader"
        }.`
      );
    } catch (error) {
      setStatus(
        error?.message || "We couldn't send that invitation."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function changeRole(member, role) {
    try {
      setBusyUserId(member.userId);
      setStatus("");
      await setGroupMemberRole(groupId, member.userId, role);
      await refresh();
      setStatus("Member role updated.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't update that role."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function remove(member) {
    if (
      !window.confirm(
        `Remove ${
          member.profile?.displayName || "this reader"
        } from the group?`
      )
    ) {
      return;
    }

    try {
      setBusyUserId(member.userId);
      setStatus("");
      await removeGroupMember(groupId, member.userId);
      await refresh();
      setStatus("Member removed.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't remove that member."
      );
    } finally {
      setBusyUserId(null);
    }
  }

  async function leave() {
    if (!window.confirm("Leave this group?")) return;

    try {
      await leaveGroup(groupId);
      navigate("/read/profile?tab=groups");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't leave this group."
      );
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    try {
      setStatus("");
      await updateGroupProfile(groupId, settings);
      await refresh();
      setStatus("Group settings saved.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't save group settings."
      );
    }
  }

  async function createTopic(event) {
    event.preventDefault();

    try {
      setStatus("");
      await createGroupForumPost(groupId, {
        title: topicTitle,
        body: topicBody
      });
      setTopicTitle("");
      setTopicBody("");
      setForumPosts(await getGroupForumPosts(groupId));
      setStatus("Discussion posted.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't post that discussion."
      );
    }
  }

  async function openTopic(post) {
    if (openTopicId === post.id) {
      setOpenTopicId(null);
      setReplyText("");
      return;
    }

    try {
      setBusyTopicId(post.id);
      setStatus("");
      const replies = await getGroupForumReplies(groupId, post.id);
      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));
      setOpenTopicId(post.id);
      setReplyText("");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't load that discussion."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function sendForumReply(post) {
    try {
      setBusyTopicId(post.id);
      setStatus("");
      await replyToGroupForumPost(groupId, post.id, replyText);
      const replies = await getGroupForumReplies(groupId, post.id);
      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));
      setReplyText("");
      setForumPosts(await getGroupForumPosts(groupId));
    } catch (error) {
      setStatus(
        error?.message || "We couldn't post that reply."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function toggleTopic(post, field) {
    try {
      setBusyTopicId(post.id);
      setStatus("");
      await updateGroupForumPost(groupId, post.id, {
        [field]: !post[field]
      });
      setForumPosts(await getGroupForumPosts(groupId));
    } catch (error) {
      setStatus(
        error?.message || "We couldn't update that discussion."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function deleteTopic(post) {
    if (!window.confirm("Delete this discussion?")) return;

    try {
      setBusyTopicId(post.id);
      setStatus("");
      await deleteGroupForumPost(groupId, post.id);
      setForumPosts(await getGroupForumPosts(groupId));
      if (openTopicId === post.id) setOpenTopicId(null);
      setStatus("Discussion removed.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't remove that discussion."
      );
    } finally {
      setBusyTopicId(null);
    }
  }

  async function deleteForumReply(post, reply) {
    if (!window.confirm("Delete this reply? This cannot be undone.")) {
      return;
    }

    try {
      setBusyTopicId(post.id);
      setStatus("");

      await deleteGroupForumReply(
        groupId,
        post.id,
        reply.id
      );

      const replies = await getGroupForumReplies(groupId, post.id);

      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));

      setStatus("Reply removed.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't remove that reply."
      );
    } finally {
      setBusyTopicId(null);
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
          <h1>Log in to view groups.</h1>
          <Link to="/read/login" className="button primary">
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
          <h1>Group not found.</h1>
          {status && <p className="status">{status}</p>}
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

  return (
    <main className="page-wrap">
      <SEO
        title={`${group.name} | Random Reads`}
        description={group.description || "Random Reads group"}
        path={`/read/groups/${group.id}`}
        noindex
      />

      <div className="stack-lg">
        <section className="hero-card small">
          <div
            style={{
              display: "flex",
              gap: "1.25rem",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            <GroupAvatar group={group} />

            <div style={{ flex: "1 1 260px" }}>
              <p className="eyebrow">
                {group.type === "class" ? "Class" : "Reading Group"}
              </p>
              <h1>{group.name}</h1>
              {group.description && <p>{group.description}</p>}
              <p className="muted">
                Your role: <strong>{roleLabel(myRole)}</strong>
                {" · "}
                {members.length} member{members.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {status && <p className="status">{status}</p>}

          <div className="button-row">
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
        </section>

        <section className="margins-filter-bar">
          {[
            ["forum", "Forum"],
            ["members", "Members"],
            ["settings", "Settings"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                activeTab === value
                  ? "margins-filter active"
                  : "margins-filter"
              }
              onClick={() => setActiveTab(value)}
            >
              {label}
            </button>
          ))}
        </section>

        {activeTab === "forum" && (
          <>
            <section className="panel profile-panel">
              <h2>Start a Discussion</h2>
              <form onSubmit={createTopic} className="stack-md profile-edit-form">
                <label>
                  Topic
                  <input
                    value={topicTitle}
                    onChange={(event) =>
                      setTopicTitle(event.target.value)
                    }
                    placeholder="What should the group discuss?"
                  />
                </label>

                <label>
                  Message
                  <textarea
                    value={topicBody}
                    onChange={(event) =>
                      setTopicBody(event.target.value)
                    }
                    rows={4}
                    placeholder="Write to the group..."
                  />
                </label>

                <button type="submit" className="button primary">
                  <MessageCircle size={16} />
                  Post Discussion
                </button>
              </form>
            </section>

            <section className="panel profile-panel">
              <h2>Group Forum</h2>

              {forumPosts.length === 0 ? (
                <p className="muted">
                  No discussions yet. Start the first one.
                </p>
              ) : (
                <div className="public-profile-entry-list">
                  {forumPosts.map((post) => {
                    const isAuthor = post.userId === user.uid;
                    const replies = forumReplies[post.id] || [];
                    const isOpen = openTopicId === post.id;

                    return (
                      <article
                        key={post.id}
                        className="public-profile-entry"
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "1rem",
                            alignItems: "flex-start"
                          }}
                        >
                          <div>
                            <h3 style={{ marginBottom: "0.35rem" }}>
                              {post.pinned && (
                                <Pin size={15} style={{ marginRight: 6 }} />
                              )}
                              {post.title}
                            </h3>
                            <p className="muted">
                              {post.authorProfile?.displayName || "Reader"}
                              {post.createdAtISO
                                ? ` · ${formatDate(post.createdAtISO)}`
                                : ""}
                              {post.locked ? " · Locked" : ""}
                            </p>
                          </div>

                          <div className="button-row">
                            {canModerate && (
                              <>
                                <button
                                  type="button"
                                  className="button secondary"
                                  disabled={busyTopicId === post.id}
                                  onClick={() =>
                                    toggleTopic(post, "pinned")
                                  }
                                  title={post.pinned ? "Unpin" : "Pin"}
                                >
                                  <Pin size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="button secondary"
                                  disabled={busyTopicId === post.id}
                                  onClick={() =>
                                    toggleTopic(post, "locked")
                                  }
                                  title={post.locked ? "Unlock" : "Lock"}
                                >
                                  <Lock size={14} />
                                </button>
                              </>
                            )}

                            {(canModerate || isAuthor) && (
                              <button
                                type="button"
                                className="button secondary"
                                disabled={busyTopicId === post.id}
                                onClick={() => deleteTopic(post)}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        <p>{post.body}</p>

                        <button
                          type="button"
                          className="button secondary"
                          disabled={busyTopicId === post.id}
                          onClick={() => openTopic(post)}
                        >
                          <MessageCircle size={15} />
                          {isOpen
                            ? "Hide Replies"
                            : `Replies${
                                post.replyCount
                                  ? ` (${post.replyCount})`
                                  : ""
                              }`}
                        </button>

                        {isOpen && (
                          <div
                            style={{
                              marginTop: "1rem",
                              paddingTop: "1rem",
                              borderTop: "1px solid var(--line)"
                            }}
                          >
                            {replies.length === 0 ? (
                              <p className="muted">No replies yet.</p>
                            ) : (
                              <div className="stack-md profile-edit-form">
                                {replies.map((reply) => {
                                  const isReplyAuthor =
                                    reply.userId === user.uid;

                                  return (
                                    <div
                                      key={reply.id}
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr auto",
                                        gap: "0.75rem",
                                        alignItems: "start"
                                      }}
                                    >
                                      <div>
                                        <strong>
                                          {reply.authorProfile?.displayName ||
                                            "Reader"}
                                        </strong>
                                        <small className="muted">
                                          {" "}
                                          · {formatDate(reply.createdAtISO)}
                                        </small>
                                        <p>{reply.body}</p>
                                      </div>

                                      {(canModerate || isReplyAuthor) && (
                                        <button
                                          type="button"
                                          className="button secondary"
                                          disabled={busyTopicId === post.id}
                                          onClick={() =>
                                            deleteForumReply(post, reply)
                                          }
                                          title="Delete reply"
                                          aria-label="Delete reply"
                                          style={{
                                            padding: "0.4rem 0.55rem"
                                          }}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {!post.locked && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.65rem",
                                  marginTop: "1rem",
                                  alignItems: "flex-end"
                                }}
                              >
                                <textarea
                                  value={replyText}
                                  onChange={(event) =>
                                    setReplyText(event.target.value)
                                  }
                                  rows={2}
                                  placeholder="Reply to the group..."
                                  style={{ flex: 1 }}
                                />
                                <button
                                  type="button"
                                  className="button primary"
                                  disabled={busyTopicId === post.id}
                                  onClick={() => sendForumReply(post)}
                                >
                                  <Send size={15} />
                                  Reply
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === "members" && (
          <>
            {canManage && joinRequests.length > 0 && (
              <section className="panel profile-panel">
                <h2>Join Requests ({joinRequests.length})</h2>

                <div className="public-profile-entry-list">
                  {joinRequests.map((request) => (
                    <article
                      key={request.userId}
                      className="public-profile-entry"
                    >
                      <Link
                        to={`/read/public/${request.userId}`}
                        className="public-entry-book-title"
                      >
                        {request.profile?.displayName || "Reader"}
                      </Link>

                      {request.profile?.username && (
                        <p className="muted">
                          @{request.profile.username}
                        </p>
                      )}

                      <div className="button-row">
                        <button
                          type="button"
                          className="button primary"
                          disabled={busyUserId === request.userId}
                          onClick={() =>
                            handleJoinRequest(request, true)
                          }
                        >
                          Accept
                        </button>

                        <button
                          type="button"
                          className="button secondary"
                          disabled={busyUserId === request.userId}
                          onClick={() =>
                            handleJoinRequest(request, false)
                          }
                        >
                          Decline
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            <section className="panel profile-panel">
              <h2>Members ({members.length})</h2>

              <div className="public-profile-entry-list">
                {members.map((member) => (
                  <article
                    key={member.userId}
                    className="public-profile-entry"
                  >
                    <Link
                      to={`/read/public/${member.userId}`}
                      className="public-entry-book-title"
                    >
                      {member.profile?.displayName || "Reader"}
                    </Link>

                    {member.profile?.username && (
                      <p className="muted">
                        @{member.profile.username}
                      </p>
                    )}

                    <p className="muted">
                      {member.role === "owner" && <Crown size={14} />}
                      {["admin", "moderator"].includes(member.role) && (
                        <Shield size={14} />
                      )}
                      {" "}
                      {roleLabel(member.role)}
                      {member.joinedAtISO
                        ? ` · Joined ${formatDate(member.joinedAtISO)}`
                        : ""}
                    </p>

                    {myRole === "owner" &&
                      member.role !== "owner" && (
                        <label style={{ maxWidth: 220 }}>
                          Role
                          <select
                            value={member.role || "member"}
                            disabled={busyUserId === member.userId}
                            onChange={(event) =>
                              changeRole(member, event.target.value)
                            }
                          >
                            <option value="admin">Admin</option>
                            <option value="moderator">Moderator</option>
                            <option value="member">Member</option>
                          </select>
                        </label>
                      )}

                    {canManage &&
                      member.role !== "owner" &&
                      member.userId !== user.uid && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busyUserId === member.userId}
                          onClick={() => remove(member)}
                        >
                          <UserMinus size={15} />
                          Remove
                        </button>
                      )}
                  </article>
                ))}
              </div>
            </section>

            {canManage && (
              <section className="panel profile-panel">
                <h2>Invite Friends</h2>

                {inviteableFriends.length === 0 ? (
                  <p className="muted">
                    No friends are currently available to invite.
                  </p>
                ) : (
                  <div className="public-profile-entry-list">
                    {inviteableFriends.map((friend) => (
                      <article
                        key={friend.otherUserId}
                        className="public-profile-entry"
                      >
                        <Link
                          to={`/read/public/${friend.otherUserId}`}
                          className="public-entry-book-title"
                        >
                          {friend.profile?.displayName || "Reader"}
                        </Link>

                        {friend.profile?.username && (
                          <p className="muted">
                            @{friend.profile.username}
                          </p>
                        )}

                        <button
                          type="button"
                          className="button primary"
                          disabled={
                            busyUserId === friend.otherUserId
                          }
                          onClick={() => invite(friend)}
                        >
                          <UserPlus size={16} />
                          Invite
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {activeTab === "settings" && (
          <section className="panel profile-panel">
            <h2>
              <Settings size={19} /> Group Settings
            </h2>

            {!canManage ? (
              <p className="muted">
                Only the owner or an admin can edit group settings.
              </p>
            ) : (
              <form onSubmit={saveSettings} className="stack-md profile-edit-form">
                <label>
                  Group name
                  <input
                    value={settings.name}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                  />
                </label>

                <label>
                  Description
                  <textarea
                    rows={4}
                    value={settings.description}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        description: event.target.value
                      }))
                    }
                    placeholder="What is this group for?"
                  />
                </label>

                <div>
                  <strong>Group avatar</strong>
                  <div className="profile-avatar-grid">
                    {GROUP_AVATARS.map((avatar) => {
                      const selected =
                        settings.avatar === avatar.image ||
                        settings.avatar === avatar.id;

                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          className={
                            selected
                              ? "profile-avatar-option selected"
                              : "profile-avatar-option"
                          }
                          onClick={() =>
                            setSettings((current) => ({
                              ...current,
                              avatar: avatar.id
                            }))
                          }
                          aria-label={`Use ${avatar.name} avatar`}
                        >
                          <img src={avatar.image} alt="" />
                          <span>{avatar.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label>
                  Group type
                  <select
                    value={settings.type}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        type: event.target.value
                      }))
                    }
                  >
                    <option value="group">Reading Group</option>
                    <option value="class">Class</option>
                  </select>
                </label>

                <label>
                  Visibility
                  <select
                    value={settings.visibility}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        visibility: event.target.value
                      }))
                    }
                  >
                    <option value="private">Private</option>
                    <option value="discoverable">Discoverable</option>
                    <option value="public">Public</option>
                  </select>
                </label>

                <label>
                  Joining
                  <select
                    value={settings.joinPolicy}
                    onChange={(event) =>
                      setSettings((current) => ({
                        ...current,
                        joinPolicy: event.target.value
                      }))
                    }
                  >
                    <option value="invite_only">Invite only</option>
                    <option value="request_to_join">
                      Request to join
                    </option>
                    <option value="open">Open</option>
                  </select>
                </label>

                <button type="submit" className="button primary">
                  Save Group Settings
                </button>
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
