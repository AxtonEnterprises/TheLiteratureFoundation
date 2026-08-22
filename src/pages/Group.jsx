import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  onAuthStateChanged
} from "firebase/auth";

import {
  Link,
  useNavigate,
  useParams
} from "react-router-dom";

import {
  ArrowLeft,
  Copy,
  Crown,
  LogOut,
  Shield,
  UserMinus,
  UserPlus
} from "lucide-react";

import { auth } from "../firebase";

import {
  getFriends,
  getGroup,
  getGroupMembers,
  inviteFriendToGroup,
  leaveGroup,
  removeGroupMember,
  setGroupMemberRole
} from "../services/storage.js";

import SEO from "../components/SEO.jsx";


function roleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}


export default function Group() {
  const { groupId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [busyUserId, setBusyUserId] = useState(null);


  async function refresh() {
    const [
      loadedGroup,
      loadedMembers,
      loadedFriends
    ] = await Promise.all([
      getGroup(groupId),
      getGroupMembers(groupId),
      getFriends()
    ]);

    setGroup(loadedGroup);
    setMembers(loadedMembers);
    setFriends(loadedFriends);
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


  const memberIds = useMemo(
    () =>
      new Set(
        members.map((member) =>
          String(member.userId)
        )
      ),
    [members]
  );

  const inviteableFriends = friends.filter(
    (friend) =>
      !memberIds.has(
        String(friend.otherUserId)
      )
  );

  const myRole =
    group?.membership?.role ||
    "member";

  const canManage =
    myRole === "owner" ||
    myRole === "admin";


  async function invite(friend) {
    try {
      setBusyUserId(friend.otherUserId);
      setStatus("");

      await inviteFriendToGroup(
        groupId,
        friend.otherUserId
      );

      setStatus(
        `Invitation sent to ${
          friend.profile?.displayName ||
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


  async function changeRole(member) {
    try {
      setBusyUserId(member.userId);

      await setGroupMemberRole(
        groupId,
        member.userId,
        member.role === "admin"
          ? "member"
          : "admin"
      );

      await refresh();
      setStatus("Member role updated.");
    } catch (error) {
      setStatus(
        error?.message ||
        "We couldn't update that role."
      );
    } finally {
      setBusyUserId(null);
    }
  }


  async function remove(member) {
    if (
      !window.confirm(
        `Remove ${
          member.profile?.displayName ||
          "this reader"
        } from the group?`
      )
    ) {
      return;
    }

    try {
      setBusyUserId(member.userId);

      await removeGroupMember(
        groupId,
        member.userId
      );

      await refresh();
      setStatus("Member removed.");
    } catch (error) {
      setStatus(
        error?.message ||
        "We couldn't remove that member."
      );
    } finally {
      setBusyUserId(null);
    }
  }


  async function leave() {
    if (!window.confirm("Leave this group?")) {
      return;
    }

    try {
      await leaveGroup(groupId);

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


  async function copyId() {
    try {
      await navigator.clipboard.writeText(
        groupId
      );

      setStatus("Group ID copied.");
    } catch {
      setStatus(`Group ID: ${groupId}`);
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
          <h1>Group not found.</h1>

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


  return (
    <main className="page-wrap">
      <SEO
        title={`${group.name} | Random Reads`}
        description={
          group.description ||
          "Random Reads group"
        }
        path={`/read/groups/${group.id}`}
        noindex
      />

      <div className="stack-lg">
        <section className="hero-card small">
          <p className="eyebrow">
            {group.type === "class"
              ? "Class"
              : "Reading Group"}
          </p>

          <h1>{group.name}</h1>

          {group.description && (
            <p>{group.description}</p>
          )}

          <p className="muted">
            Your role:{" "}
            <strong>
              {roleLabel(myRole)}
            </strong>
          </p>

          {status && (
            <p className="status">
              {status}
            </p>
          )}

          <div className="button-row">
            <Link
              to="/read/profile?tab=groups"
              className="button secondary"
            >
              <ArrowLeft size={16} />
              My Groups
            </Link>

            <button
              type="button"
              className="button secondary"
              onClick={copyId}
            >
              <Copy size={16} />
              Copy Group ID
            </button>

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


        <section className="panel profile-panel">
          <h2>
            Members ({members.length})
          </h2>

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
                  {member.profile?.displayName ||
                    "Reader"}
                </Link>

                {member.profile?.username && (
                  <p className="muted">
                    @{member.profile.username}
                  </p>
                )}

                <p className="muted">
                  {member.role === "owner" && (
                    <Crown size={14} />
                  )}

                  {member.role === "admin" && (
                    <Shield size={14} />
                  )}

                  {" "}
                  {roleLabel(member.role)}
                </p>

                {myRole === "owner" &&
                  member.role !== "owner" && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      busyUserId ===
                      member.userId
                    }
                    onClick={() =>
                      changeRole(member)
                    }
                  >
                    <Shield size={15} />
                    {member.role === "admin"
                      ? "Make Member"
                      : "Make Admin"}
                  </button>
                )}

                {canManage &&
                  member.role !== "owner" &&
                  member.userId !== user.uid && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={
                      busyUserId ===
                      member.userId
                    }
                    onClick={() =>
                      remove(member)
                    }
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
                No friends are currently
                available to invite.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {inviteableFriends.map(
                  (friend) => (
                    <article
                      key={friend.otherUserId}
                      className="public-profile-entry"
                    >
                      <Link
                        to={`/read/public/${friend.otherUserId}`}
                        className="public-entry-book-title"
                      >
                        {friend.profile?.displayName ||
                          "Reader"}
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
                          busyUserId ===
                          friend.otherUserId
                        }
                        onClick={() =>
                          invite(friend)
                        }
                      >
                        <UserPlus size={16} />
                        Invite
                      </button>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        )}


        <section className="panel profile-panel">
          <h2>Group Margins</h2>

          <p className="muted">
            Journal entries set to Group
            visibility can be shared with
            this group. For now, use this
            Group ID in the Journal editor:
          </p>

          <button
            type="button"
            className="button secondary"
            onClick={copyId}
          >
            <Copy size={16} />
            {groupId}
          </button>
        </section>
      </div>
    </main>
  );
}
