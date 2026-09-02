import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Send,
  Search,
  Settings,
  Trash2,
  UserMinus,
  Users,
  X
} from "lucide-react";

import SEO from "../components/SEO.jsx";

import {
  getAuthorName,
  searchBooks,
  splitSearchResults
} from "../services/booksApi.js";

import {
  GROUP_AVATARS,
  getGroupAvatar
} from "../data/groupAvatars.js";

import {
  getFriends,
  getGroupMembers,
  inviteFriendToGroup,
  removeGroupMember,
  setGroupMemberRole
} from "../services/storage.js";

import {
  createGroupForumPost,
  deleteGroupForumPost,
  deleteGroupForumReply,
  getGroupForumPosts,
  getGroupForumReplies,
  replyToGroupForumPost,
  updateGroupProfile
} from "../services/groupsPhase3A.js";

import {
  createClassAssignment,
  deleteClassAssignment,
  getClassAssignmentProgress,
  getClassAssignments,
  getMyClassAssignmentProgress,
  updateClassAssignment
} from "../services/classStorage.js";

function mergeUniqueBooks(...groups) {
  const seen = new Set();

  return groups.flat().filter((book) => {
    const id = String(book?.id || "");

    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function formatDate(value) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function memberName(member) {
  return (
    member.profile?.displayName ||
    member.profile?.username ||
    member.displayName ||
    member.userId ||
    "Student"
  );
}

function classRoleLabel(role) {
  if (role === "owner") return "Primary Teacher";
  if (role === "admin") return "Teacher";
  return "Student";
}

function ProgressBar({ value }) {
  const safe = Math.min(Math.max(Number(value) || 0, 0), 100);

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 180,
        height: 10,
        background: "#e9eeec",
        borderRadius: 999,
        overflow: "hidden"
      }}
      aria-label={`${safe}% complete`}
    >
      <div
        style={{
          width: `${safe}%`,
          height: "100%",
          background: "var(--primary)",
          borderRadius: 999
        }}
      />
    </div>
  );
}

export default function Classroom({ initialGroup }) {
  const { groupId } = useParams();

  const [group, setGroup] = useState(initialGroup);
  const [activeTab, setActiveTab] = useState("assignments");
  const [spatialIndex, setSpatialIndex] = useState(0);
  const [spatialSwipeStart, setSpatialSwipeStart] = useState(null);

  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [forumPosts, setForumPosts] = useState([]);
  const [forumReplies, setForumReplies] = useState({});
  const [openTopicId, setOpenTopicId] = useState(null);

  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [studentProgress, setStudentProgress] = useState([]);
  const [myAssignmentProgress, setMyAssignmentProgress] = useState({});

  const [loading, setLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);

  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [bookSearchStatus, setBookSearchStatus] = useState(
    "Search by title, author, or subject."
  );
  const [bookSearchLoading, setBookSearchLoading] = useState(false);

  const [assignmentForm, setAssignmentForm] = useState({
    bookId: "",
    title: "",
    author: "",
    instructions: "",
    dueAt: "",
    startParagraphIndex: 0,
    endParagraphIndex: ""
  });

  const [topicTitle, setTopicTitle] = useState("");
  const [topicBody, setTopicBody] = useState("");
  const [replyText, setReplyText] = useState("");

  const [settingsForm, setSettingsForm] = useState({
    name: initialGroup?.name || "",
    description: initialGroup?.description || "",
    visibility: initialGroup?.visibility || "private",
    joinPolicy: initialGroup?.joinPolicy || "invite_only",
    type: "class",
    avatar: initialGroup?.avatar || ""
  });

  const myRole = group?.membership?.role || "member";
  const isTeacher = ["owner", "admin"].includes(myRole);
  const isOwner = myRole === "owner";

  async function refreshCore() {
    const [
      loadedMembers,
      loadedAssignments,
      loadedForumPosts
    ] = await Promise.all([
      getGroupMembers(groupId),
      getClassAssignments(groupId),
      getGroupForumPosts(groupId)
    ]);

    let normalizedMembers = loadedMembers;

    /*
     * Classes have only Primary Teacher / Teacher / Student.
     * If an older class still contains the group-only Moderator role,
     * the Primary Teacher normalizes it to Student.
     */
    if (
      isOwner &&
      loadedMembers.some((member) => member.role === "moderator")
    ) {
      await Promise.allSettled(
        loadedMembers
          .filter((member) => member.role === "moderator")
          .map((member) =>
            setGroupMemberRole(
              groupId,
              member.userId,
              "member"
            )
          )
      );

      normalizedMembers = await getGroupMembers(groupId);
    }

    setMembers(normalizedMembers);
    setAssignments(loadedAssignments);
    setForumPosts(loadedForumPosts);

    if (loadedAssignments.length) {
      setSelectedAssignmentId((current) =>
        loadedAssignments.some((item) => item.id === current)
          ? current
          : loadedAssignments[0].id
      );
    } else {
      setSelectedAssignmentId("");
    }

    if (isTeacher) {
      try {
        setFriends(await getFriends());
      } catch {
        setFriends([]);
      }
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        await refreshCore();
      } catch (error) {
        console.error("Could not load class:", error);

        if (active) {
          setStatus(error?.message || "We couldn't load this class.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [groupId]);

  const selectedAssignment = useMemo(
    () =>
      assignments.find(
        (assignment) => assignment.id === selectedAssignmentId
      ) || null,
    [assignments, selectedAssignmentId]
  );

  useEffect(() => {
    if (!isTeacher || !selectedAssignment) {
      setStudentProgress([]);
      return;
    }

    let active = true;

    async function loadProgress() {
      try {
        setProgressLoading(true);

        const rows = await getClassAssignmentProgress(
          groupId,
          members,
          selectedAssignment
        );

        if (active) {
          setStudentProgress(rows);
        }
      } catch (error) {
        console.error("Could not load class progress:", error);

        if (active) {
          setStatus(
            "Student progress could not be loaded. Confirm the class Firestore rules included in this package are installed."
          );
        }
      } finally {
        if (active) {
          setProgressLoading(false);
        }
      }
    }

    loadProgress();

    return () => {
      active = false;
    };
  }, [
    groupId,
    isTeacher,
    members,
    selectedAssignment
  ]);

  useEffect(() => {
    if (isTeacher || !assignments.length) {
      setMyAssignmentProgress({});
      return;
    }

    let active = true;

    getMyClassAssignmentProgress(
      groupId,
      assignments
    )
      .then((progressByAssignment) => {
        if (active) {
          setMyAssignmentProgress(progressByAssignment);
        }
      })
      .catch((error) => {
        console.error(
          "Could not load student assignment progress:",
          error
        );
      });

    return () => {
      active = false;
    };
  }, [groupId, isTeacher, assignments]);

  const studentCount = members.filter(
    (member) => !["owner", "admin"].includes(member.role)
  ).length;

  const teacherCount = members.length - studentCount;

  const inviteableFriends = useMemo(() => {
    const ids = new Set(members.map((member) => String(member.userId)));

    return friends.filter(
      (friend) => !ids.has(String(friend.otherUserId))
    );
  }, [friends, members]);

  async function searchAssignmentBooks() {
    const query = bookSearchQuery.trim();

    if (!query) {
      setBookSearchResults([]);
      setBookSearchStatus("Enter a title, author, or subject.");
      return;
    }

    try {
      setBookSearchLoading(true);
      setBookSearchStatus("Searching titles...");

      const books = await searchBooks(query);
      const {
        titleMatches,
        authorMatches,
        otherMatches
      } = splitSearchResults(books, query);

      const merged = mergeUniqueBooks(
        titleMatches,
        authorMatches,
        otherMatches
      );

      setBookSearchResults(merged);
      setBookSearchStatus(
        merged.length
          ? `${merged.length} result${merged.length === 1 ? "" : "s"} found.`
          : "No books found."
      );
    } catch (error) {
      console.error("Could not search assignment books:", error);
      setBookSearchStatus(
        "Search failed. Check your connection and try again."
      );
    } finally {
      setBookSearchLoading(false);
    }
  }

  function chooseAssignmentBook(book) {
    setAssignmentForm((current) => ({
      ...current,
      bookId: String(book.id),
      title: book.title || "",
      author: getAuthorName(book) || book.author || ""
    }));

    setBookSearchQuery(book.title || "");
    setBookSearchResults([]);
    setBookSearchStatus(`Selected “${book.title || "book"}.”`);
  }

  function clearAssignmentForm() {
    setAssignmentForm({
      bookId: "",
      title: "",
      author: "",
      instructions: "",
      dueAt: "",
      startParagraphIndex: 0,
      endParagraphIndex: ""
    });

    setEditingAssignmentId(null);
    setShowCreate(false);
    setBookSearchQuery("");
    setBookSearchResults([]);
    setBookSearchStatus("Search by title, author, or subject.");
  }

  function beginEditAssignment(assignment) {
    setAssignmentForm({
      bookId: assignment.bookId || "",
      title: assignment.title || "",
      author: assignment.author || "",
      instructions: assignment.instructions || "",
      dueAt: assignment.dueAt || "",
      startParagraphIndex: assignment.startParagraphIndex ?? 0,
      endParagraphIndex: assignment.endParagraphIndex ?? ""
    });

    setEditingAssignmentId(assignment.id);
    setShowCreate(true);
    setActiveTab("assignments");
  }

  async function saveAssignment(event) {
    event.preventDefault();

    try {
      setBusy(true);
      setStatus("");

      if (editingAssignmentId) {
        await updateClassAssignment(
          groupId,
          editingAssignmentId,
          assignmentForm
        );

        setStatus("Assignment updated.");
      } else {
        const id = await createClassAssignment(
          groupId,
          assignmentForm
        );

        setSelectedAssignmentId(id);
        setStatus("Assignment created.");
      }

      clearAssignmentForm();
      await refreshCore();
    } catch (error) {
      console.error("Could not save assignment:", error);
      setStatus(error?.message || "We couldn't save that assignment.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(assignment) {
    if (
      !window.confirm(
        `Delete "${assignment.title}" from this class?`
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      await deleteClassAssignment(groupId, assignment.id);
      await refreshCore();
      setStatus("Assignment deleted.");
    } catch (error) {
      setStatus(error?.message || "We couldn't delete that assignment.");
    } finally {
      setBusy(false);
    }
  }

  async function createTopic(event) {
    event.preventDefault();

    if (!topicTitle.trim() || !topicBody.trim()) {
      setStatus("Add a discussion title and message.");
      return;
    }

    try {
      setBusy(true);

      await createGroupForumPost(groupId, {
        title: topicTitle,
        body: topicBody
      });

      setTopicTitle("");
      setTopicBody("");
      setForumPosts(await getGroupForumPosts(groupId));
      setStatus("Discussion posted.");
    } catch (error) {
      setStatus(error?.message || "We couldn't post that discussion.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTopic(post) {
    if (openTopicId === post.id) {
      setOpenTopicId(null);
      setReplyText("");
      return;
    }

    try {
      const replies = await getGroupForumReplies(groupId, post.id);

      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));

      setOpenTopicId(post.id);
      setReplyText("");
    } catch (error) {
      setStatus(error?.message || "We couldn't load that discussion.");
    }
  }

  async function sendReply(post) {
    if (!replyText.trim()) return;

    try {
      setBusy(true);

      await replyToGroupForumPost(
        groupId,
        post.id,
        replyText.trim()
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
    } catch (error) {
      setStatus(error?.message || "We couldn't post that reply.");
    } finally {
      setBusy(false);
    }
  }

  async function removeTopic(post) {
    if (!window.confirm("Delete this class discussion?")) return;

    try {
      await deleteGroupForumPost(groupId, post.id);
      setForumPosts(await getGroupForumPosts(groupId));
      setOpenTopicId(null);
    } catch (error) {
      setStatus(error?.message || "We couldn't delete that discussion.");
    }
  }

  async function removeReply(post, reply) {
    if (!window.confirm("Delete this reply?")) return;

    try {
      await deleteGroupForumReply(
        groupId,
        post.id,
        reply.id
      );

      const replies = await getGroupForumReplies(
        groupId,
        post.id
      );

      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));
    } catch (error) {
      setStatus(error?.message || "We couldn't delete that reply.");
    }
  }

  async function changeClassRole(member, nextRole) {
    try {
      setBusy(true);

      const storedRole =
        nextRole === "teacher"
          ? "admin"
          : "member";

      await setGroupMemberRole(
        groupId,
        member.userId,
        storedRole
      );

      await refreshCore();
      setStatus("Class role updated.");
    } catch (error) {
      setStatus(error?.message || "We couldn't update that role.");
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(member) {
    if (
      !window.confirm(
        `Remove ${memberName(member)} from this class?`
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      await removeGroupMember(groupId, member.userId);
      await refreshCore();
      setStatus("Student removed.");
    } catch (error) {
      setStatus(error?.message || "We couldn't remove that student.");
    } finally {
      setBusy(false);
    }
  }

  async function invite(friend) {
    try {
      setBusy(true);
      await inviteFriendToGroup(groupId, friend.otherUserId);
      setStatus(
        `Invitation sent to ${
          friend.profile?.displayName || "reader"
        }.`
      );
    } catch (error) {
      setStatus(error?.message || "We couldn't send that invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    try {
      setBusy(true);

      await updateGroupProfile(
        groupId,
        settingsForm
      );

      setGroup((current) => ({
        ...current,
        ...settingsForm
      }));

      setStatus("Class settings saved.");
    } catch (error) {
      setStatus(error?.message || "We couldn't save class settings.");
    } finally {
      setBusy(false);
    }
  }

  const spatialSections = [
    { value: "assignments", label: "Assignments" },
    { value: "discussion", label: "Discussion" },
    { value: "students", label: isTeacher ? "Students" : "Classmates" },
    ...(isTeacher ? [{ value: "settings", label: "Settings" }] : [])
  ];

  useEffect(() => {
    const nextIndex = spatialSections.findIndex(
      (section) => section.value === activeTab
    );

    if (nextIndex >= 0 && nextIndex !== spatialIndex) {
      setSpatialIndex(nextIndex);
    }
  }, [activeTab, isTeacher]);

  function moveSpatialSection(direction) {
    const nextIndex = Math.max(
      0,
      Math.min(
        spatialSections.length - 1,
        spatialIndex + direction
      )
    );

    if (nextIndex === spatialIndex) return;

    setSpatialIndex(nextIndex);
    setActiveTab(spatialSections[nextIndex].value);
  }

  function handleClassTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;

    setSpatialSwipeStart({
      x: touch.clientX,
      y: touch.clientY
    });
  }

  function handleClassTouchEnd(event) {
    if (!spatialSwipeStart) return;

    const touch = event.changedTouches?.[0];
    setSpatialSwipeStart(null);

    if (!touch) return;

    const deltaX = touch.clientX - spatialSwipeStart.x;
    const deltaY = touch.clientY - spatialSwipeStart.y;

    if (
      Math.abs(deltaX) < 70 ||
      Math.abs(deltaX) <= Math.abs(deltaY)
    ) {
      return;
    }

    // Same spatial grammar as The Chain and Groups:
    // left = deeper/next, right = back/previous.
    if (deltaX < 0) {
      moveSpatialSection(1);
    } else {
      moveSpatialSection(-1);
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <section className="panel" style={{ padding: "1.25rem" }}>
          <p className="muted">Loading class...</p>
        </section>
      </main>
    );
  }

  return (
    <main
      className="page-wrap classroom-spatial-page"
      onTouchStart={handleClassTouchStart}
      onTouchEnd={handleClassTouchEnd}
    >
      <SEO
        title={`${group?.name || "Class"} | Lit Chain`}
        description={`Assignments and reading progress for ${
          group?.name || "this class"
        }.`}
        path={`/read/groups/${groupId}`}
      />

      <div className="classroom-spatial-shell">
        <header className="classroom-floating-card">
          <Link
            to="/read/profile?tab=groups"
            className="classroom-floating-back"
            aria-label="Back to classes"
          >
            <ArrowLeft size={18} />
          </Link>

          <button
            type="button"
            className="classroom-floating-identity"
            onClick={() => {
              setSpatialIndex(0);
              setActiveTab("assignments");
            }}
          >
            {getGroupAvatar(group?.avatar) && (
              <img
                src={getGroupAvatar(group.avatar).image}
                alt=""
              />
            )}
            <span>
              <small>Class</small>
              <strong>{group?.name || "Classroom"}</strong>
            </span>
          </button>

          <button
            type="button"
            className="classroom-floating-members"
            onClick={() => {
              const index = spatialSections.findIndex(
                (section) => section.value === "students"
              );
              if (index >= 0) {
                setSpatialIndex(index);
                setActiveTab("students");
              }
            }}
            aria-label="Class members"
          >
            <Users size={18} />
          </button>

          {isTeacher && (
            <button
              type="button"
              className="classroom-floating-settings"
              onClick={() => {
                const index = spatialSections.findIndex(
                  (section) => section.value === "settings"
                );
                if (index >= 0) {
                  setSpatialIndex(index);
                  setActiveTab("settings");
                }
              }}
              aria-label="Class settings"
            >
              <Settings size={18} />
            </button>
          )}
        </header>

        <section className="classroom-section-header">
          <button
            type="button"
            className="icon-link"
            onClick={() => moveSpatialSection(-1)}
            disabled={spatialIndex === 0}
            aria-label="Previous class section"
          >
            <ChevronLeft size={18} />
          </button>

          <div>
            <p className="eyebrow">
              {spatialSections[spatialIndex]?.label || "Class"}
            </p>
            <div
              className="classroom-depth-dots"
              aria-label={`Class section ${spatialIndex + 1} of ${spatialSections.length}`}
            >
              {spatialSections.map((section, index) => (
                <span
                  key={section.value}
                  className={index === spatialIndex ? "active" : ""}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            className="icon-link"
            onClick={() => moveSpatialSection(1)}
            disabled={spatialIndex === spatialSections.length - 1}
            aria-label="Next class section"
          >
            <ChevronRight size={18} />
          </button>
        </section>

        <section className="classroom-overview-strip">
          <span>
            <GraduationCap size={13} />
            {teacherCount} {teacherCount === 1 ? "teacher" : "teachers"}
          </span>
          <span>
            <Users size={13} />
            {studentCount} {studentCount === 1 ? "student" : "students"}
          </span>
          <span>{classRoleLabel(myRole)}</span>
        </section>

        {status && <p className="status">{status}</p>}

        {activeTab === "assignments" && (
          <section className="panel classroom-spatial-section classroom-assignments-section" style={{ padding: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                gap: "1rem",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap"
              }}
            >
              <div>
                <p className="eyebrow">Assigned Reading</p>
                <h2>Assignments</h2>
                <small className="classroom-swipe-cue">
                  Swipe left for Discussion
                </small>
              </div>

              {isTeacher && (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    clearAssignmentForm();
                    setShowCreate(true);
                  }}
                >
                  <Plus size={16} />
                  Assign Reading
                </button>
              )}
            </div>

            {showCreate && isTeacher && (
              <form
                className="stack-md"
                onSubmit={saveAssignment}
                style={{
                  padding: "1rem",
                  marginBottom: "1.25rem",
                  background: "#f7faf9",
                  border: "1px solid var(--line)",
                  borderRadius: 18
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    alignItems: "center"
                  }}
                >
                  <strong>
                    {editingAssignmentId
                      ? "Edit Assignment"
                      : "New Assignment"}
                  </strong>

                  <button
                    type="button"
                    className="icon-link"
                    onClick={clearAssignmentForm}
                    aria-label="Close assignment form"
                  >
                    <X size={18} />
                  </button>
                </div>

                {!editingAssignmentId && (
                  <div className="stack-md">
                    <label>
                      Find a book
                      <div
                        className="search-bar"
                        style={{ marginTop: "0.35rem" }}
                      >
                        <Search size={20} />
                        <input
                          type="search"
                          placeholder="Search title, author, or subject"
                          value={bookSearchQuery}
                          onChange={(event) =>
                            setBookSearchQuery(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              searchAssignmentBooks();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={searchAssignmentBooks}
                          disabled={bookSearchLoading}
                        >
                          {bookSearchLoading ? "Searching..." : "Search"}
                        </button>
                      </div>
                    </label>

                    <p className="status">{bookSearchStatus}</p>

                    {bookSearchResults.length > 0 && (
                      <div
                        className="results-list"
                        style={{
                          maxHeight: 420,
                          overflowY: "auto"
                        }}
                      >
                        {bookSearchResults.map((book) => (
                          <article
                            key={book.id}
                            className="book-card compact"
                          >
                            <div className="book-card-body">
                              <h3>{book.title || "Untitled"}</h3>
                              <p className="muted">
                                {getAuthorName(book)}
                              </p>
                              <button
                                type="button"
                                className="button primary"
                                onClick={() => chooseAssignmentBook(book)}
                              >
                                <Plus size={16} />
                                Assign This Book
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {assignmentForm.bookId && (
                  <div
                    style={{
                      padding: "0.85rem 1rem",
                      background: "#eef4f3",
                      borderRadius: 14
                    }}
                  >
                    <strong>Selected book</strong>
                    <p style={{ margin: "0.25rem 0 0" }}>
                      {assignmentForm.title || "Untitled"}
                      {assignmentForm.author
                        ? ` — ${assignmentForm.author}`
                        : ""}
                    </p>
                  </div>
                )}

                <label>
                  Title
                  <input
                    required
                    value={assignmentForm.title}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        title: event.target.value
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid var(--line)",
                      borderRadius: 12
                    }}
                  />
                </label>

                <label>
                  Author
                  <input
                    value={assignmentForm.author}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        author: event.target.value
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid var(--line)",
                      borderRadius: 12
                    }}
                  />
                </label>

                <label>
                  Instructions
                  <textarea
                    rows={3}
                    value={assignmentForm.instructions}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        instructions: event.target.value
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid var(--line)",
                      borderRadius: 12
                    }}
                    placeholder="Read through Chapter 10, then..."
                  />
                </label>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "0.75rem"
                  }}
                >
                  <label>
                    Start paragraph
                    <input
                      type="number"
                      min="0"
                      value={assignmentForm.startParagraphIndex}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({
                          ...current,
                          startParagraphIndex: event.target.value
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid var(--line)",
                        borderRadius: 12
                      }}
                    />
                  </label>

                  <label>
                    End paragraph
                    <input
                      type="number"
                      min="0"
                      value={assignmentForm.endParagraphIndex}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({
                          ...current,
                          endParagraphIndex: event.target.value
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid var(--line)",
                        borderRadius: 12
                      }}
                      placeholder="Blank = whole book"
                    />
                  </label>

                  <label>
                    Due date
                    <input
                      type="date"
                      value={assignmentForm.dueAt}
                      onChange={(event) =>
                        setAssignmentForm((current) => ({
                          ...current,
                          dueAt: event.target.value
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid var(--line)",
                        borderRadius: 12
                      }}
                    />
                  </label>
                </div>

                <button
                  className="button primary"
                  disabled={busy}
                >
                  <Save size={16} />
                  {busy
                    ? "Saving..."
                    : editingAssignmentId
                      ? "Save Changes"
                      : "Create Assignment"}
                </button>
              </form>
            )}

            {!assignments.length && (
              <p className="muted">
                {isTeacher
                  ? "No reading has been assigned yet."
                  : "Your teacher hasn't assigned any reading yet."}
              </p>
            )}

            <div className="stack-md">
              {assignments.map((assignment) => (
                <article
                  key={assignment.id}
                  className="public-journal-entry"
                  style={{
                    padding: "1rem",
                    border: "1px solid var(--line)",
                    borderRadius: 18
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "1rem",
                      flexWrap: "wrap"
                    }}
                  >
                    <div>
                      <h3>{assignment.title}</h3>
                      {assignment.author && (
                        <p className="muted" style={{ margin: 0 }}>
                          {assignment.author}
                        </p>
                      )}
                    </div>

                    <Link
                      to={`/read/reader/${assignment.bookId}?paragraph=${
                        assignment.startParagraphIndex || 0
                      }`}
                      className="button primary"
                    >
                      <BookOpen size={16} />
                      Read
                    </Link>
                  </div>

                  <div className="public-entry-meta">
                    <span>
                      <CalendarDays size={14} />
                      {formatDate(assignment.dueAt)}
                    </span>

                    <span>
                      Paragraph{" "}
                      {Number(
                        assignment.startParagraphIndex || 0
                      ) + 1}
                      {assignment.endParagraphIndex !== null &&
                      assignment.endParagraphIndex !== undefined
                        ? `–${
                            Number(
                              assignment.endParagraphIndex
                            ) + 1
                          }`
                        : " onward"}
                    </span>
                  </div>

                  {assignment.instructions && (
                    <p>{assignment.instructions}</p>
                  )}

                  {!isTeacher && (
                    <div
                      style={{
                        marginTop: "0.85rem",
                        paddingTop: "0.85rem",
                        borderTop: "1px solid var(--line)"
                      }}
                    >
                      <ProgressBar
                        value={
                          myAssignmentProgress[assignment.id]
                            ?.assignmentPercent || 0
                        }
                      />
                      <small
                        className="muted"
                        style={{
                          display: "block",
                          marginTop: "0.35rem"
                        }}
                      >
                        {myAssignmentProgress[assignment.id]
                          ?.assignmentPercent || 0}
                        % ·{" "}
                        {myAssignmentProgress[assignment.id]
                          ?.complete
                          ? "Complete"
                          : myAssignmentProgress[assignment.id]
                              ?.progress
                            ? "In progress"
                            : "Not started"}
                      </small>
                    </div>
                  )}

                  {isTeacher && (
                    <div className="button-row">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => {
                          setSelectedAssignmentId(
                            assignment.id
                          );
                        }}
                      >
                        <GraduationCap size={16} />
                        Student Progress
                      </button>

                      <button
                        type="button"
                        className="button secondary"
                        onClick={() =>
                          beginEditAssignment(assignment)
                        }
                      >
                        <Pencil size={16} />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="button danger"
                        onClick={() =>
                          removeAssignment(assignment)
                        }
                        disabled={busy}
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  )}

                  {isTeacher &&
                    selectedAssignmentId === assignment.id && (
                      <div
                        style={{
                          marginTop: "1rem",
                          paddingTop: "1rem",
                          borderTop:
                            "1px solid var(--line)"
                        }}
                      >
                        <h3>Student Progress</h3>

                        {progressLoading ? (
                          <p className="muted">
                            Loading progress...
                          </p>
                        ) : studentProgress.length ? (
                          <div className="stack-md">
                            {studentProgress.map((student) => (
                              <div
                                key={student.userId}
                                style={{
                                  display: "grid",
                                  gap: "0.55rem",
                                  padding: "0.85rem 0",
                                  borderBottom:
                                    "1px solid var(--line)"
                                }}
                              >
                                <Link
                                  to={`/read/public/${student.userId}`}
                                  style={{ width: "fit-content" }}
                                >
                                  <strong>{memberName(student)}</strong>
                                </Link>

                                <div>
                                  <ProgressBar
                                    value={student.assignmentPercent}
                                  />
                                  <small className="muted">
                                    {student.assignmentPercent}% ·{" "}
                                    {student.complete
                                      ? "Complete"
                                      : student.progress
                                        ? "In progress"
                                        : "Not started"}
                                  </small>
                                </div>

                                <small className="muted">
                                  {student.progress?.updatedAtISO
                                    ? `Last read ${formatDateTime(
                                        student.progress.updatedAtISO
                                      )}`
                                    : "Not started"}
                                </small>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="muted">
                            No students are enrolled yet.
                          </p>
                        )}
                      </div>
                    )}
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === "discussion" && (
          <section className="panel classroom-spatial-section classroom-discussion-section" style={{ padding: "1.25rem" }}>
            <p className="eyebrow">Class Discussion</p>
            <h2>Discussion</h2>
            <small className="classroom-swipe-cue">
              Swipe left for {isTeacher ? "Students" : "Classmates"} · right for Assignments
            </small>

            <form
              className="stack-md"
              onSubmit={createTopic}
              style={{ marginBottom: "1.25rem" }}
            >
              <input
                value={topicTitle}
                onChange={(event) =>
                  setTopicTitle(event.target.value)
                }
                placeholder="Discussion title"
                maxLength={120}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid var(--line)",
                  borderRadius: 12
                }}
              />

              <textarea
                rows={4}
                value={topicBody}
                onChange={(event) =>
                  setTopicBody(event.target.value)
                }
                placeholder="Start a class discussion..."
                maxLength={3000}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid var(--line)",
                  borderRadius: 12
                }}
              />

              <button
                className="button primary"
                disabled={busy}
              >
                <Send size={16} />
                Post Discussion
              </button>
            </form>

            {!forumPosts.length && (
              <p className="muted">
                No class discussions yet.
              </p>
            )}

            <div className="stack-md">
              {forumPosts.map((post) => {
                const replies =
                  forumReplies[post.id] || [];
                const open = openTopicId === post.id;

                return (
                  <article
                    key={post.id}
                    style={{
                      padding: "1rem",
                      border: "1px solid var(--line)",
                      borderRadius: 18
                    }}
                  >
                    <h3>{post.title}</h3>
                    <p>{post.body}</p>

                    <div className="button-row">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => toggleTopic(post)}
                      >
                        <MessageCircle size={16} />
                        {open
                          ? "Close"
                          : `Replies${
                              post.replyCount
                                ? ` (${post.replyCount})`
                                : ""
                            }`}
                      </button>

                      {(post.canDelete || isTeacher) && (
                        <button
                          type="button"
                          className="button danger"
                          onClick={() => removeTopic(post)}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      )}
                    </div>

                    {open && (
                      <div
                        style={{
                          marginTop: "1rem",
                          paddingTop: "1rem",
                          borderTop:
                            "1px solid var(--line)"
                        }}
                      >
                        {replies.map((reply) => (
                          <div
                            key={reply.id}
                            style={{
                              padding: "0.75rem 0",
                              borderBottom:
                                "1px solid var(--line)"
                            }}
                          >
                            <strong>
                              {reply.authorProfile?.displayName ||
                                reply.authorProfile?.username ||
                                "Reader"}
                            </strong>
                            <p>{reply.body || reply.note}</p>

                            {(reply.canDelete ||
                              isTeacher) && (
                              <button
                                type="button"
                                className="button danger"
                                onClick={() =>
                                  removeReply(post, reply)
                                }
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            )}
                          </div>
                        ))}

                        <textarea
                          rows={3}
                          value={replyText}
                          onChange={(event) =>
                            setReplyText(
                              event.target.value
                            )
                          }
                          placeholder="Reply..."
                          style={{
                            width: "100%",
                            marginTop: "0.75rem",
                            padding: "0.75rem",
                            border:
                              "1px solid var(--line)",
                            borderRadius: 12
                          }}
                        />

                        <button
                          type="button"
                          className="button primary"
                          onClick={() => sendReply(post)}
                          disabled={
                            busy || !replyText.trim()
                          }
                          style={{ marginTop: "0.75rem" }}
                        >
                          <Send size={15} />
                          Reply
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {activeTab === "students" && (
          <section className="panel classroom-spatial-section classroom-students-section" style={{ padding: "1.25rem" }}>
            <p className="eyebrow">
              {isTeacher ? "Class Roster" : "Classmates"}
            </p>
            <h2>{isTeacher ? "Students & Teachers" : "Classmates"}</h2>
            <small className="classroom-swipe-cue">
              {isTeacher
                ? "Swipe left for Settings · right for Discussion"
                : "Swipe right for Discussion"}
            </small>

            <div className="stack-md">
              {members.map((member) => (
                <div
                  key={member.userId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    padding: "0.8rem 0",
                    borderBottom:
                      "1px solid var(--line)"
                  }}
                >
                  <Link
                    to={`/read/public/${member.userId}`}
                    style={{ display: "block" }}
                  >
                    <strong>{memberName(member)}</strong>
                    <small
                      className="muted"
                      style={{ display: "block" }}
                    >
                      {classRoleLabel(member.role)}
                    </small>
                  </Link>

                  {isOwner &&
                    member.role !== "owner" && (
                      <div className="button-row">
                        <select
                          value={
                            member.role === "admin"
                              ? "teacher"
                              : "student"
                          }
                          onChange={(event) =>
                            changeClassRole(
                              member,
                              event.target.value
                            )
                          }
                          disabled={busy}
                          style={{
                            padding: "0.65rem",
                            border:
                              "1px solid var(--line)",
                            borderRadius: 12
                          }}
                        >
                          <option value="student">
                            Student
                          </option>
                          <option value="teacher">
                            Teacher
                          </option>
                        </select>

                        <button
                          type="button"
                          className="button danger"
                          onClick={() =>
                            removeStudent(member)
                          }
                          disabled={busy}
                        >
                          <UserMinus size={15} />
                          Remove
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>

            {isTeacher && inviteableFriends.length > 0 && (
              <div
                style={{
                  marginTop: "1.5rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid var(--line)"
                }}
              >
                <h3>Invite to class</h3>

                <div className="stack-md">
                  {inviteableFriends.map((friend) => (
                    <div
                      key={friend.otherUserId}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "1rem",
                        alignItems: "center"
                      }}
                    >
                      <span>
                        {friend.profile?.displayName ||
                          "Reader"}
                      </span>

                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => invite(friend)}
                        disabled={busy}
                      >
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "settings" && isTeacher && (
          <section className="panel classroom-spatial-section classroom-settings-section" style={{ padding: "1.25rem" }}>
            <p className="eyebrow">Class Management</p>
            <h2>Settings</h2>
            <small className="classroom-swipe-cue">
              Swipe right for Students
            </small>

            <form
              className="stack-md"
              onSubmit={saveSettings}
            >
              <label>
                Class name
                <input
                  value={settingsForm.name}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid var(--line)",
                    borderRadius: 12
                  }}
                />
              </label>

              <label>
                Description
                <textarea
                  rows={4}
                  value={settingsForm.description}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      description:
                        event.target.value
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid var(--line)",
                    borderRadius: 12
                  }}
                />
              </label>

              <div>
                <span
                  style={{
                    display: "block",
                    marginBottom: "0.55rem",
                    fontWeight: 700
                  }}
                >
                  Class avatar
                </span>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(84px, 1fr))",
                    gap: "0.65rem"
                  }}
                >
                  {GROUP_AVATARS.map((avatar) => {
                    const selected =
                      settingsForm.avatar === avatar.id ||
                      settingsForm.avatar === avatar.image;

                    return (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() =>
                          setSettingsForm((current) => ({
                            ...current,
                            avatar: avatar.id
                          }))
                        }
                        aria-pressed={selected}
                        title={avatar.name}
                        style={{
                          padding: "0.45rem",
                          border: selected
                            ? "3px solid var(--primary)"
                            : "1px solid var(--line)",
                          borderRadius: 16,
                          background: "#fff"
                        }}
                      >
                        <img
                          src={avatar.image}
                          alt={avatar.name}
                          style={{
                            width: "100%",
                            aspectRatio: "1 / 1",
                            objectFit: "cover",
                            borderRadius: 12
                          }}
                        />
                        <small
                          style={{
                            display: "block",
                            marginTop: "0.35rem"
                          }}
                        >
                          {avatar.name}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label>
                Visibility
                <select
                  value={settingsForm.visibility}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      visibility:
                        event.target.value
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid var(--line)",
                    borderRadius: 12
                  }}
                >
                  <option value="private">
                    Private
                  </option>
                  <option value="public">
                    Public
                  </option>
                </select>
              </label>

              <label>
                Joining
                <select
                  value={settingsForm.joinPolicy}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      joinPolicy:
                        event.target.value
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid var(--line)",
                    borderRadius: 12
                  }}
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
                className="button primary"
                disabled={busy}
              >
                <Settings size={16} />
                Save Class Settings
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
