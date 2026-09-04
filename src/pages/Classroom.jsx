import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Link2,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  Unlink2,
  UserMinus,
  Users,
  X
} from "lucide-react";

import SEO from "../components/SEO.jsx";
import ShareInviteCard from "../components/ShareInviteCard.jsx";

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
  getOrCreateGroupShareInvite,
  rotateGroupShareInvite,
  removeGroupMember,
  setGroupMemberRole
} from "../services/storage.js";

import {
  createGroupForumPost,
  deleteGroupForumPost,
  deleteGroupForumReply,
  getGroupForumPosts,
  getGroupForumReplies,
  getMyGroupForumVote,
  replyToGroupForumPost,
  updateGroupProfile,
  voteOnGroupForumNode
} from "../services/groupsPhase3A.js";

import {
  createClassAssignment,
  deleteClassAssignment,
  getClassAssignmentProgress,
  getClassAssignments,
  getClassGrades,
  getClassTestAnswerKey,
  getMyClassAssignmentProgress,
  getMyClassGrades,
  getMyClassTestSubmission,
  gradeClassTestSubmission,
  submitClassTest,
  updateClassAssignment
} from "../services/classStorage.js";

function mergeUniqueBooks(...groups) {
  const seen = new Set();

  return groups.flat().filter((book) => {
    const id = String(book?.id || "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function formatDate(value) {
  if (!value) return "No due date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

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
  if (role === "moderator") return "Aide";
  return "Student";
}

function assignmentType(assignment) {
  return assignment?.type === "test" ? "test" : "reading";
}

function makeQuestion(index = 0) {
  return {
    id: `q${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
    type: "multiple_choice",
    prompt: "",
    points: 1,
    options: ["", ""],
    correctOptionIndex: 0,
    gradingNotes: ""
  };
}

function scoreLabel(score, maxPoints) {
  if (score === null || score === undefined) return "Awaiting grade";
  return `${Number(score) || 0}/${Number(maxPoints) || 0} points`;
}

function gradePercentLabel(percent) {
  const value = Number(percent);
  if (!Number.isFinite(value)) return "Pending";
  return `${Math.round(value * 10) / 10}%`;
}

function ProgressBar({ value }) {
  const safe = Math.min(Math.max(Number(value) || 0, 0), 100);

  return (
    <div className="class-progress-track" aria-label={`${safe}% complete`}>
      <div
        className="class-progress-fill"
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export default function Classroom({ initialGroup }) {
  const { groupId } = useParams();

  const [group, setGroup] = useState(initialGroup);
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [forumPosts, setForumPosts] = useState([]);
  const [forumReplies, setForumReplies] = useState({});
  const [myAssignmentProgress, setMyAssignmentProgress] = useState({});
  const [studentProgress, setStudentProgress] = useState([]);
  const [classStudentProgress, setClassStudentProgress] = useState([]);
  const [myClassProgress, setMyClassProgress] = useState({
    percent: 0,
    completed: 0,
    total: 0
  });

  const [loading, setLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyTopicId, setBusyTopicId] = useState(null);

  const [assignmentIndex, setAssignmentIndex] = useState(0);
  const [discussionIndex, setDiscussionIndex] = useState(0);
  const [classDepth, setClassDepth] = useState(0);
  const [spatialSwipeStart, setSpatialSwipeStart] = useState(null);

  const [replyModePostId, setReplyModePostId] = useState(null);
  const [replyLevels, setReplyLevels] = useState([]);
  const [replyComposerParentId, setReplyComposerParentId] = useState(undefined);
  const [replyText, setReplyText] = useState("");
  const [forumVotes, setForumVotes] = useState({});

  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState(null);
  const [showDiscussionComposer, setShowDiscussionComposer] = useState(false);
  const [showStudents, setShowStudents] = useState(false);
  const [showGrades, setShowGrades] = useState(false);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradebook, setGradebook] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testAnswers, setTestAnswers] = useState({});
  const [testSubmission, setTestSubmission] = useState(null);
  const [reviewStudent, setReviewStudent] = useState(null);
  const [reviewAnswerKey, setReviewAnswerKey] = useState(null);
  const [manualScores, setManualScores] = useState({});
  const [gradeFeedback, setGradeFeedback] = useState("");

  const [shareInvite, setShareInvite] = useState(null);
  const [shareInviteLoading, setShareInviteLoading] = useState(false);

  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [bookSearchResults, setBookSearchResults] = useState([]);
  const [bookSearchStatus, setBookSearchStatus] = useState(
    "Search by title, author, or subject."
  );
  const [bookSearchLoading, setBookSearchLoading] = useState(false);

  const [assignmentForm, setAssignmentForm] = useState({
    type: "reading",
    bookId: "",
    title: "",
    author: "",
    instructions: "",
    dueAt: "",
    startParagraphIndex: 0,
    endParagraphIndex: "",
    totalPoints: 100,
    questions: [makeQuestion(0)]
  });

  const [topicTitle, setTopicTitle] = useState("");
  const [topicBody, setTopicBody] = useState("");

  const [settingsForm, setSettingsForm] = useState({
    name: initialGroup?.name || "",
    description: initialGroup?.description || "",
    visibility: initialGroup?.visibility || "private",
    joinPolicy: initialGroup?.joinPolicy || "invite_only",
    type: "class",
    avatar: initialGroup?.avatar || ""
  });

  const myRole = group?.membership?.role || "member";
  const canTeach = ["owner", "admin", "moderator"].includes(myRole);
  const canManageClass = ["owner", "admin"].includes(myRole);
  const isOwner = myRole === "owner";

  const shareInviteUrl =
    shareInvite?.token && typeof window !== "undefined"
      ? `${window.location.origin}/read/join/${shareInvite.token}`
      : "";

  const selectedAssignment =
    assignments[assignmentIndex] || null;

  const discussions = useMemo(() => {
    if (!selectedAssignment) return [];

    const firstAssignmentId = assignments[0]?.id || null;

    return forumPosts.filter((post) => {
      if (post.sourceAssignmentId) {
        return String(post.sourceAssignmentId) === String(selectedAssignment.id);
      }

      /*
       * Legacy class discussions predate assignment provenance.
       * Keep them visible by placing them under the first assignment.
       */
      return String(selectedAssignment.id) === String(firstAssignmentId);
    });
  }, [forumPosts, assignments, selectedAssignment]);

  const selectedDiscussion =
    discussions[discussionIndex] || null;

  const studentCount = members.filter(
    (member) => !["owner", "admin", "moderator"].includes(member.role)
  ).length;

  const teacherCount = members.filter(
    (member) => ["owner", "admin"].includes(member.role)
  ).length;

  const aideCount = members.filter(
    (member) => member.role === "moderator"
  ).length;

  const inviteableFriends = useMemo(() => {
    const ids = new Set(members.map((member) => String(member.userId)));

    return friends.filter(
      (friend) => !ids.has(String(friend.otherUserId))
    );
  }, [friends, members]);

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

    setMembers(loadedMembers);
    setAssignments(loadedAssignments);
    setForumPosts(loadedForumPosts);

    setAssignmentIndex((current) =>
      Math.max(
        0,
        Math.min(loadedAssignments.length - 1, current)
      )
    );

    if (canTeach) {
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
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [groupId]);

  useEffect(() => {
    let active = true;

    async function loadShareInvite() {
      if (!showStudents || !canManageClass) {
        return;
      }

      try {
        setShareInviteLoading(true);
        const loaded = await getOrCreateGroupShareInvite(groupId);
        if (active) setShareInvite(loaded);
      } catch (error) {
        console.error("Could not prepare class share link:", error);
        if (active) {
          setStatus(
            error?.message ||
              "We couldn't prepare the class share link."
          );
        }
      } finally {
        if (active) setShareInviteLoading(false);
      }
    }

    loadShareInvite();

    return () => {
      active = false;
    };
  }, [showStudents, canManageClass, groupId]);

  useEffect(() => {
    setDiscussionIndex(0);
    setReplyModePostId(null);
    setReplyLevels([]);
    setReplyComposerParentId(undefined);
    setClassDepth(0);
  }, [selectedAssignment?.id]);

  useEffect(() => {
    if (canTeach || !assignments.length) {
      setMyAssignmentProgress({});
      return;
    }

    let active = true;

    getMyClassAssignmentProgress(groupId, assignments)
      .then((progressByAssignment) => {
        if (active) setMyAssignmentProgress(progressByAssignment);
      })
      .catch((error) => {
        console.error("Could not load student assignment progress:", error);
      });

    return () => {
      active = false;
    };
  }, [groupId, canTeach, assignments]);

  useEffect(() => {
    let active = true;

    async function loadClassProgress() {
      if (!assignments.length) {
        if (active) {
          setClassStudentProgress([]);
          setMyClassProgress({ percent: 0, completed: 0, total: 0 });
        }
        return;
      }

      try {
        if (canTeach) {
          const assignmentRows = await Promise.all(
            assignments.map((assignment) =>
              getClassAssignmentProgress(groupId, members, assignment)
            )
          );

          const students = members.filter(
            (member) => !["owner", "admin", "moderator"].includes(member.role)
          );

          const aggregated = students.map((student) => {
            const percentages = assignmentRows.map((rows) => {
              const row = rows.find(
                (item) => String(item.userId) === String(student.userId)
              );
              return Number(row?.assignmentPercent) || 0;
            });
            const completed = percentages.filter((value) => value >= 100).length;
            const percent = assignments.length
              ? Math.round(
                  percentages.reduce((sum, value) => sum + value, 0) /
                    assignments.length
                )
              : 0;

            return {
              ...student,
              classPercent: percent,
              assignmentsCompleted: completed,
              assignmentsTotal: assignments.length
            };
          });

          if (active) setClassStudentProgress(aggregated);
          return;
        }

        const progressByAssignment =
          await getMyClassAssignmentProgress(groupId, assignments);
        const percentages = assignments.map((assignment) =>
          Number(progressByAssignment?.[assignment.id]?.assignmentPercent) || 0
        );
        const completed = percentages.filter((value) => value >= 100).length;
        const percent = assignments.length
          ? Math.round(
              percentages.reduce((sum, value) => sum + value, 0) /
                assignments.length
            )
          : 0;

        if (active) {
          setMyClassProgress({ percent, completed, total: assignments.length });
        }
      } catch (error) {
        console.error("Could not load aggregate class progress:", error);
      }
    }

    loadClassProgress();
    return () => {
      active = false;
    };
  }, [groupId, assignments, members, canTeach]);

  useEffect(() => {
    if (!showProgress || !canTeach || !selectedAssignment) {
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

        if (active) setStudentProgress(rows);
      } catch (error) {
        console.error("Could not load class progress:", error);
        if (active) {
          setStatus("Student progress could not be loaded.");
        }
      } finally {
        if (active) setProgressLoading(false);
      }
    }

    loadProgress();

    return () => {
      active = false;
    };
  }, [
    showProgress,
    canTeach,
    groupId,
    members,
    selectedAssignment
  ]);

  useEffect(() => {
    if (!showGrades) return;

    let active = true;

    async function loadGrades() {
      try {
        setGradesLoading(true);
        const loaded = canTeach
          ? await getClassGrades(groupId, members, assignments)
          : await getMyClassGrades(groupId, assignments);
        if (active) setGradebook(loaded);
      } catch (error) {
        console.error("Could not load grades:", error);
        if (active) setStatus(error?.message || "We couldn't load grades.");
      } finally {
        if (active) setGradesLoading(false);
      }
    }

    loadGrades();
    return () => { active = false; };
  }, [showGrades, canTeach, groupId, members, assignments]);

  function clearAssignmentForm() {
    setAssignmentForm({
      type: "reading",
      bookId: "",
      title: "",
      author: "",
      instructions: "",
      dueAt: "",
      startParagraphIndex: 0,
      endParagraphIndex: "",
      questions: [makeQuestion(0)]
    });

    setEditingAssignmentId(null);
    setShowCreateAssignment(false);
    setBookSearchQuery("");
    setBookSearchResults([]);
    setBookSearchStatus("Search by title, author, or subject.");
  }

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
      setBookSearchStatus("Search failed. Check your connection and try again.");
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

  async function beginEditAssignment(assignment) {
    if (assignmentType(assignment) === "test") {
      try {
        setBusy(true);
        const key = await getClassTestAnswerKey(groupId, assignment.id);
        const answers = key?.answers || {};

        setAssignmentForm({
          type: "test",
          bookId: "",
          title: assignment.title || "",
          author: "",
          instructions: assignment.instructions || "",
          dueAt: assignment.dueAt || "",
          startParagraphIndex: 0,
          endParagraphIndex: "",
          totalPoints: assignment.totalPoints || 0,
          questions: (assignment.questions || []).map((question, index) => ({
            ...question,
            id: question.id || `q${index + 1}`,
            options: question.options || ["", ""],
            correctOptionIndex:
              answers?.[question.id]?.correctOptionIndex ?? 0,
            gradingNotes:
              answers?.[question.id]?.gradingNotes || ""
          }))
        });
      } catch (error) {
        setStatus(error?.message || "We couldn't load the test answer key.");
        return;
      } finally {
        setBusy(false);
      }
    } else {
      setAssignmentForm({
        type: "reading",
        bookId: assignment.bookId || "",
        title: assignment.title || "",
        author: assignment.author || "",
        instructions: assignment.instructions || "",
        dueAt: assignment.dueAt || "",
        startParagraphIndex: assignment.startParagraphIndex ?? 0,
        endParagraphIndex: assignment.endParagraphIndex ?? "",
        totalPoints: assignment.totalPoints || 100,
        questions: [makeQuestion(0)]
      });
    }

    setEditingAssignmentId(assignment.id);
    setShowCreateAssignment(true);
  }

  function updateTestQuestion(questionId, updates) {
    setAssignmentForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? { ...question, ...updates }
          : question
      )
    }));
  }

  function addTestQuestion() {
    setAssignmentForm((current) => ({
      ...current,
      questions: [...current.questions, makeQuestion(current.questions.length)]
    }));
  }

  function removeTestQuestion(questionId) {
    setAssignmentForm((current) => ({
      ...current,
      questions:
        current.questions.length > 1
          ? current.questions.filter((question) => question.id !== questionId)
          : current.questions
    }));
  }

  function updateTestOption(questionId, optionIndex, value) {
    setAssignmentForm((current) => ({
      ...current,
      questions: current.questions.map((question) => {
        if (question.id !== questionId) return question;
        const options = [...(question.options || [])];
        options[optionIndex] = value;
        return { ...question, options };
      })
    }));
  }

  function addTestOption(questionId) {
    setAssignmentForm((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId && (question.options || []).length < 8
          ? { ...question, options: [...(question.options || []), ""] }
          : question
      )
    }));
  }

  function removeTestOption(questionId, optionIndex) {
    setAssignmentForm((current) => ({
      ...current,
      questions: current.questions.map((question) => {
        if (question.id !== questionId || (question.options || []).length <= 2) {
          return question;
        }
        const options = question.options.filter((_, index) => index !== optionIndex);
        let correctOptionIndex = Number(question.correctOptionIndex) || 0;
        if (correctOptionIndex === optionIndex) correctOptionIndex = 0;
        if (correctOptionIndex > optionIndex) correctOptionIndex -= 1;
        return { ...question, options, correctOptionIndex };
      })
    }));
  }

  function assignmentPayload() {
    if (assignmentForm.type !== "test") return assignmentForm;

    const answerKey = {};
    const questions = assignmentForm.questions.map((question) => {
      answerKey[question.id] = question.type === "multiple_choice"
        ? { correctOptionIndex: Number(question.correctOptionIndex) || 0 }
        : { gradingNotes: question.gradingNotes || "" };

      return {
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        points: question.points,
        ...(question.type === "multiple_choice"
          ? { options: question.options || [] }
          : {})
      };
    });

    return { ...assignmentForm, questions, answerKey };
  }

  async function saveAssignment(event) {
    event.preventDefault();

    if (!canTeach) {
      setStatus("Only teachers and aides can create or edit assignments.");
      return;
    }

    try {
      setBusy(true);
      setStatus("");

      if (editingAssignmentId) {
        await updateClassAssignment(
          groupId,
          editingAssignmentId,
          assignmentPayload()
        );
        setStatus("Assignment updated.");
      } else {
        const id = await createClassAssignment(groupId, assignmentPayload());
        await refreshCore();

        const nextAssignments = await getClassAssignments(groupId);
        const nextIndex = nextAssignments.findIndex((item) => item.id === id);
        if (nextIndex >= 0) setAssignmentIndex(nextIndex);

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
    if (!window.confirm(`Delete "${assignment.title}" from this class?`)) {
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

  async function openTest(assignment) {
    try {
      setBusy(true);
      setStatus("");
      const submission = await getMyClassTestSubmission(groupId, assignment.id);
      setTestSubmission(submission);
      setTestAnswers(submission?.answers || {});
      setShowTest(true);
    } catch (error) {
      setStatus(error?.message || "We couldn't open that test.");
    } finally {
      setBusy(false);
    }
  }

  async function submitTest(event) {
    event.preventDefault();
    if (!selectedAssignment || assignmentType(selectedAssignment) !== "test") return;

    if (!window.confirm("Submit this test? Answers cannot be changed after submission.")) {
      return;
    }

    try {
      setBusy(true);
      const submission = await submitClassTest(
        groupId,
        selectedAssignment.id,
        testAnswers
      );
      setTestSubmission(submission);
      setStatus("Test submitted.");
      const progress = await getMyClassAssignmentProgress(groupId, assignments);
      setMyAssignmentProgress(progress);
      const percentages = assignments.map((assignment) =>
        Number(progress?.[assignment.id]?.assignmentPercent) || 0
      );
      setMyClassProgress({
        percent: assignments.length
          ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / assignments.length)
          : 0,
        completed: percentages.filter((value) => value >= 100).length,
        total: assignments.length
      });
    } catch (error) {
      setStatus(error?.message || "We couldn't submit that test.");
    } finally {
      setBusy(false);
    }
  }

  async function openStudentTestReview(student) {
    try {
      setBusy(true);
      const key = await getClassTestAnswerKey(groupId, selectedAssignment.id);
      setReviewAnswerKey(key?.answers || {});
      setReviewStudent(student);
      setManualScores(student.submission?.manualScores || {});
      setGradeFeedback(student.submission?.feedback || "");
    } catch (error) {
      setStatus(error?.message || "We couldn't load that submission.");
    } finally {
      setBusy(false);
    }
  }

  async function saveTestGrade(event) {
    event.preventDefault();
    if (!reviewStudent || !selectedAssignment) return;

    try {
      setBusy(true);
      await gradeClassTestSubmission(
        groupId,
        selectedAssignment.id,
        reviewStudent.userId,
        { manualScores, feedback: gradeFeedback }
      );
      const rows = await getClassAssignmentProgress(
        groupId,
        members,
        selectedAssignment
      );
      setStudentProgress(rows);
      setReviewStudent(null);
      setReviewAnswerKey(null);
      setStatus("Test graded.");
    } catch (error) {
      setStatus(error?.message || "We couldn't save that grade.");
    } finally {
      setBusy(false);
    }
  }

  async function createTopic(event) {
    event.preventDefault();

    if (!canTeach) {
      setStatus("Only teachers and aides can start a class discussion.");
      return;
    }

    if (!selectedAssignment) {
      setStatus("Create an assignment before starting its discussion.");
      return;
    }

    if (!topicTitle.trim() || !topicBody.trim()) {
      setStatus("Add a discussion title and message.");
      return;
    }

    try {
      setBusy(true);

      await createGroupForumPost(groupId, {
        title: topicTitle,
        body: topicBody,
        sourceAssignment: selectedAssignment
      });

      setTopicTitle("");
      setTopicBody("");
      setForumPosts(await getGroupForumPosts(groupId));
      setDiscussionIndex(0);
      setClassDepth(1);
      setShowDiscussionComposer(false);
      setStatus("Discussion posted.");
    } catch (error) {
      setStatus(error?.message || "We couldn't post that discussion.");
    } finally {
      setBusy(false);
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
              !reply.parentReplyId ||
              !replyIds.has(String(reply.parentReplyId))
            )
      )
      .sort((a, b) => {
        const scoreDifference =
          Number(b.forumScore || 0) - Number(a.forumScore || 0);

        if (scoreDifference !== 0) return scoreDifference;

        const upDifference =
          Number(b.forumUpCount || 0) - Number(a.forumUpCount || 0);

        if (upDifference !== 0) return upDifference;

        return String(b.createdAtISO || "").localeCompare(
          String(a.createdAtISO || "")
        );
      });
  }

  async function loadTopicReplies(post) {
    setBusyTopicId(post.id);
    setStatus("");

    try {
      const replies = await getGroupForumReplies(groupId, post.id);

      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));

      return replies;
    } catch (error) {
      setStatus(error?.message || "We couldn't load that discussion.");
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
    setClassDepth(2);
  }

  function currentReplyItem() {
    const level = replyLevels[replyLevels.length - 1];
    return level?.items?.[level.selectedIndex] || null;
  }

  function replyChildCount(postId, replyId) {
    return replyChildren(
      forumReplies[postId] || [],
      replyId
    ).length;
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

    setClassDepth((current) => current + 1);
  }

  function backReplyDepth() {
    if (replyLevels.length > 1) {
      setReplyLevels((current) => current.slice(0, -1));
      setClassDepth((current) => Math.max(2, current - 1));
      return;
    }

    setReplyLevels([]);
    setReplyModePostId(null);
    setClassDepth(1);
  }

  async function sendForumReply(post, parentReplyId = null) {
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

      const replies = await getGroupForumReplies(groupId, post.id);

      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));

      setReplyText("");
      setReplyComposerParentId(undefined);
      setForumPosts(await getGroupForumPosts(groupId));

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

          if (
            String(next[lastIndex].parentReplyId || "") ===
            String(parentReplyId || "")
          ) {
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
      } else if (parentReplyId === null) {
        const roots = replyChildren(replies, null);

        setReplyModePostId(post.id);
        setReplyLevels([
          {
            parentReplyId: null,
            items: roots,
            selectedIndex: Math.max(
              0,
              roots.findIndex((item) => item.id === created.id)
            )
          }
        ]);
        setClassDepth(2);
      }
    } catch (error) {
      setStatus(error?.message || "We couldn't post that reply.");
    } finally {
      setBusyTopicId(null);
    }
  }

  function voteKey(targetType, targetId) {
    return `${targetType}:${targetId}`;
  }

  async function ensureForumVote(targetType, targetId) {
    const key = voteKey(targetType, targetId);

    if (Object.prototype.hasOwnProperty.call(forumVotes, key)) {
      return;
    }

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
      console.warn("Could not load class discussion vote:", error);
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
      setStatus(error?.message || "We couldn't update that vote.");
    }
  }

  async function removeTopic(post) {
    if (!window.confirm("Delete this class discussion?")) return;

    try {
      await deleteGroupForumPost(groupId, post.id);
      setForumPosts(await getGroupForumPosts(groupId));
      setDiscussionIndex(0);
      setReplyModePostId(null);
      setReplyLevels([]);
      setClassDepth(1);
    } catch (error) {
      setStatus(error?.message || "We couldn't delete that discussion.");
    }
  }

  async function removeReply(post, reply) {
    if (!window.confirm("Delete this reply?")) return;

    try {
      await deleteGroupForumReply(groupId, post.id, reply.id);

      const replies = await getGroupForumReplies(groupId, post.id);

      setForumReplies((current) => ({
        ...current,
        [post.id]: replies
      }));

      const roots = replyChildren(replies, null);

      if (!roots.length) {
        setReplyModePostId(null);
        setReplyLevels([]);
        setClassDepth(1);
      } else {
        setReplyLevels([
          {
            parentReplyId: null,
            items: roots,
            selectedIndex: 0
          }
        ]);
        setClassDepth(2);
      }
    } catch (error) {
      setStatus(error?.message || "We couldn't delete that reply.");
    }
  }

  function handleAssignmentScroll(event) {
    const height = event.currentTarget.clientHeight;
    if (!height) return;

    const next = Math.round(event.currentTarget.scrollTop / height);

    setAssignmentIndex(
      Math.max(0, Math.min(assignments.length - 1, next))
    );
  }

  function handleDiscussionScroll(event) {
    const height = event.currentTarget.clientHeight;
    if (!height) return;

    const next = Math.round(event.currentTarget.scrollTop / height);

    setDiscussionIndex(
      Math.max(0, Math.min(discussions.length - 1, next))
    );
  }

  function handleReplyScroll(event) {
    const levelIndex = replyLevels.length - 1;
    const height = event.currentTarget.clientHeight;

    if (levelIndex < 0 || !height) return;

    const nextIndex = Math.round(
      event.currentTarget.scrollTop / height
    );

    setReplyLevels((current) => {
      if (!current[levelIndex]) return current;

      const next = [...current];
      next[levelIndex] = {
        ...next[levelIndex],
        selectedIndex: Math.max(
          0,
          Math.min(
            next[levelIndex].items.length - 1,
            nextIndex
          )
        )
      };

      return next;
    });
  }

  function handleSpatialTouchStart(event) {
    const touch = event.touches?.[0];

    if (!touch) return;

    setSpatialSwipeStart({
      x: touch.clientX,
      y: touch.clientY
    });
  }

  async function handleSpatialTouchEnd(event) {
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

    if (deltaX < 0) {
      if (replyModePostId) {
        const post = forumPosts.find(
          (item) => item.id === replyModePostId
        );

        const reply = currentReplyItem();

        if (post && reply) {
          enterReplyChildren(post, reply);
        }
        return;
      }

      if (classDepth === 0) {
        setClassDepth(1);
        setDiscussionIndex(0);
        return;
      }

      if (classDepth === 1 && selectedDiscussion) {
        await enterTopicReplies(selectedDiscussion);
      }

      return;
    }

    if (replyModePostId) {
      backReplyDepth();
      return;
    }

    if (classDepth === 1) {
      setClassDepth(0);
    }
  }

  async function changeClassRole(member, nextRole) {
    try {
      setBusy(true);

      await setGroupMemberRole(
        groupId,
        member.userId,
        nextRole === "teacher"
          ? "admin"
          : nextRole === "aide"
            ? "moderator"
            : "member"
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
    if (!window.confirm(`Remove ${memberName(member)} from this class?`)) {
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
        `Invitation sent to ${friend.profile?.displayName || "reader"}.`
      );
    } catch (error) {
      setStatus(error?.message || "We couldn't send that invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function regenerateShareInvite() {
    const confirmed = window.confirm(
      "Create a new class invitation link? The current QR code and link will stop working immediately."
    );

    if (!confirmed) return;

    try {
      setShareInviteLoading(true);
      setStatus("");
      const next = await rotateGroupShareInvite(groupId);
      setShareInvite(next);
      setStatus("New class invitation link created.");
    } catch (error) {
      setStatus(
        error?.message ||
          "We couldn't create a new class invitation link."
      );
    } finally {
      setShareInviteLoading(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();

    try {
      setBusy(true);

      await updateGroupProfile(groupId, settingsForm);

      setGroup((current) => ({
        ...current,
        ...settingsForm
      }));

      setStatus("Class settings saved.");
      setShowSettings(false);
    } catch (error) {
      setStatus(error?.message || "We couldn't save class settings.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (selectedDiscussion && classDepth === 1) {
      ensureForumVote("post", selectedDiscussion.id);
    }
  }, [selectedDiscussion?.id, classDepth]);

  useEffect(() => {
    const selectedReply = currentReplyItem();

    if (replyModePostId && selectedReply) {
      ensureForumVote("reply", selectedReply.id);
    }
  }, [
    replyModePostId,
    replyLevels.length,
    currentReplyItem()?.id
  ]);

  if (loading) {
    return (
      <main className="page-wrap">
        <section className="panel" style={{ padding: "1.25rem" }}>
          <p className="muted">Loading class...</p>
        </section>
      </main>
    );
  }

  const avatar = getGroupAvatar(group?.avatar);

  return (
    <main className="classroom-reel-page">
      <SEO
        title={`${group?.name || "Class"} | Lit Chain`}
        description={`Assignments and reading progress for ${
          group?.name || "this class"
        }.`}
        path={`/read/groups/${groupId}`}
      />

      <header className="classroom-reel-header">
        <Link
          to="/read/groups"
          className="classroom-reel-back"
          aria-label="Back to classes"
        >
          <ArrowLeft size={18} />
        </Link>

        <button
          type="button"
          className="classroom-reel-identity"
          onClick={() => {
            setReplyModePostId(null);
            setReplyLevels([]);
            setClassDepth(0);
          }}
        >
          {avatar ? (
            <img src={avatar.image} alt="" />
          ) : (
            <GraduationCap size={26} />
          )}

          <span>
            <small>Class</small>
            <strong>{group?.name || "Classroom"}</strong>
          </span>
        </button>

        <button
          type="button"
          className="classroom-reel-icon"
          onClick={() => setShowStudents(true)}
          aria-label="Students"
          title="Students"
        >
          <Users size={19} />
        </button>

        <button
          type="button"
          className="classroom-reel-icon"
          onClick={() => setShowGrades(true)}
          aria-label="Grades"
          title="Grades"
        >
          <ClipboardCheck size={19} />
        </button>

        {canManageClass && (
          <button
            type="button"
            className="classroom-reel-icon"
            onClick={() => setShowSettings(true)}
            aria-label="Class settings"
            title="Class settings"
          >
            <Settings size={19} />
          </button>
        )}
      </header>

      {status && (
        <p className="status classroom-reel-status">
          {status}
        </p>
      )}

      <section
        className="classroom-reel-stage"
        onTouchStart={handleSpatialTouchStart}
        onTouchEnd={handleSpatialTouchEnd}
      >
        {classDepth === 0 && (
          <>
            {!assignments.length ? (
              <div className="classroom-reel-empty">
                <BookOpen size={40} />
                <h2>No assignments yet</h2>
                <p className="muted">
                  {canTeach
                    ? "Create the first reading assignment."
                    : "Your teacher hasn't assigned any reading yet."}
                </p>
              </div>
            ) : (
              <div
                className="classroom-assignment-reels"
                onScroll={handleAssignmentScroll}
              >
                {assignments.map((assignment) => {
                  const mine =
                    myAssignmentProgress[assignment.id] || null;

                  return (
                    <article
                      key={assignment.id}
                      className="classroom-assignment-reel"
                    >
                      <div className="classroom-assignment-card">
                        <p className="eyebrow">{assignmentType(assignment) === "test" ? "Test" : "Assignment"} · Level 0</p>

                        <h1>{assignment.title}</h1>

                        {assignment.author && (
                          <p className="classroom-assignment-author">
                            {assignment.author}
                          </p>
                        )}

                        <div className="classroom-assignment-meta">
                          <span>
                            <CalendarDays size={14} />
                            {formatDate(assignment.dueAt)}
                          </span>

                          {assignmentType(assignment) === "test" ? (
                            <span>
                              <ClipboardCheck size={14} />
                              {assignment.questionCount || assignment.questions?.length || 0} questions · {assignment.totalPoints || 0} points
                            </span>
                          ) : (
                            <>
                              <span>
                                Paragraph{" "}
                                {Number(assignment.startParagraphIndex || 0) + 1}
                                {assignment.endParagraphIndex !== null &&
                                assignment.endParagraphIndex !== undefined
                                  ? `–${Number(assignment.endParagraphIndex) + 1}`
                                  : " onward"}
                              </span>
                              <span>{Number(assignment.totalPoints) || 100} points</span>
                            </>
                          )}
                        </div>

                        {assignment.instructions && (
                          <p className="classroom-assignment-instructions">
                            {assignment.instructions}
                          </p>
                        )}

                        {!canTeach && (
                          <div className="classroom-current-progress">
                            <div>
                              <small>{assignmentType(assignment) === "test" ? "Your test" : "Your progress"}</small>
                              <strong>
                                {assignmentType(assignment) === "test"
                                  ? (mine?.graded
                                      ? scoreLabel(mine.score, mine.maxPoints)
                                      : mine?.complete ? "Submitted" : "Not started")
                                  : `${mine?.assignmentPercent || 0}%`}
                              </strong>
                            </div>

                            <ProgressBar value={mine?.assignmentPercent || 0} />

                            <small>
                              {assignmentType(assignment) === "test"
                                ? mine?.graded
                                  ? "Graded"
                                  : mine?.complete ? "Submitted · awaiting grade" : "Not started"
                                : mine?.complete
                                  ? "Complete"
                                  : mine?.progress
                                    ? "In progress"
                                    : "Not started"}
                            </small>
                          </div>
                        )}

                        {!canTeach && (
                          <div className="classroom-current-progress">
                            <div>
                              <small>Class progress</small>
                              <strong>{myClassProgress.percent}%</strong>
                            </div>
                            <ProgressBar value={myClassProgress.percent} />
                            <small>
                              {myClassProgress.completed} of {myClassProgress.total} assignments complete
                            </small>
                          </div>
                        )}

                        <div className="classroom-assignment-actions">
                          {assignmentType(assignment) === "test" ? (
                            !canTeach && (
                              <button
                                type="button"
                                className="button primary"
                                onClick={() => openTest(assignment)}
                              >
                                <ClipboardCheck size={16} />
                                {mine?.complete ? "View Test" : "Take Test"}
                              </button>
                            )
                          ) : (
                            <Link
                              to={`/read/reader/${assignment.bookId}?paragraph=${assignment.startParagraphIndex || 0}`}
                              className="button primary"
                            >
                              <BookOpen size={16} />
                              Read
                            </Link>
                          )}

                          {canTeach && (
                            <>
                              <button
                                type="button"
                                className="button secondary"
                                onClick={() => setShowProgress(true)}
                              >
                                <GraduationCap size={16} />
                                Student Progress
                              </button>

                              <button
                                type="button"
                                className="icon-link"
                                onClick={() =>
                                  beginEditAssignment(assignment)
                                }
                                title="Edit assignment"
                              >
                                <Pencil size={17} />
                              </button>

                              <button
                                type="button"
                                className="icon-link danger"
                                onClick={() =>
                                  removeAssignment(assignment)
                                }
                                title="Delete assignment"
                              >
                                <Trash2 size={17} />
                              </button>
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          className="classroom-swipe-level-cue"
                          onClick={() => {
                            setDiscussionIndex(0);
                            setClassDepth(1);
                          }}
                        >
                          Swipe left for discussions
                          <MessageCircle size={16} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {assignments.length > 1 && (
              <div className="classroom-vertical-dots">
                {assignments
                  .slice(
                    Math.max(0, assignmentIndex - 3),
                    Math.min(assignments.length, assignmentIndex + 4)
                  )
                  .map((assignment, localIndex) => {
                    const start = Math.max(0, assignmentIndex - 3);
                    const index = start + localIndex;

                    return (
                      <span
                        key={assignment.id}
                        className={index === assignmentIndex ? "active" : ""}
                      />
                    );
                  })}
              </div>
            )}

            {canTeach && (
              <button
                type="button"
                className="group-new-discussion-fab classroom-add-assignment-fab"
                onClick={() => {
                  clearAssignmentForm();
                  setShowCreateAssignment(true);
                }}
                aria-label="New assignment"
                title="New assignment"
              >
                <Plus size={22} />
              </button>
            )}
          </>
        )}

        {classDepth === 1 && !replyModePostId && (
          <>
            {!discussions.length ? (
              <div className="classroom-reel-empty">
                <MessageCircle size={40} />
                <h2>No discussions yet</h2>
                <p className="muted">
                  Start a discussion about{" "}
                  <strong>{selectedAssignment?.title || "this assignment"}</strong>.
                </p>

                {canTeach ? (
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => setShowDiscussionComposer(true)}
                  >
                    <Plus size={16} />
                    New Discussion
                  </button>
                ) : (
                  <p className="muted">
                    Teachers and aides can start discussions. Students can participate by replying.
                  </p>
                )}

                <button
                  type="button"
                  className="classroom-swipe-back-cue"
                  onClick={() => setClassDepth(0)}
                >
                  <ArrowLeft size={15} />
                  Assignment
                </button>
              </div>
            ) : (
              <div
                className="group-discussion-reels classroom-discussion-reels"
                onScroll={handleDiscussionScroll}
              >
                {discussions.map((post) => {
                  const vote =
                    forumVotes[voteKey("post", post.id)] || 0;

                  return (
                    <article
                      key={post.id}
                      className="group-discussion-reel"
                      onMouseEnter={() =>
                        ensureForumVote("post", post.id)
                      }
                    >
                      <div className="group-discussion-card classroom-discussion-card">
                        <div className="group-discussion-meta-row">
                          <span>
                            {post.authorProfile?.displayName ||
                              post.authorProfile?.username ||
                              "Reader"}
                            {post.createdAtISO
                              ? ` · ${formatDate(post.createdAtISO)}`
                              : ""}
                          </span>

                          {(post.canDelete || canTeach) && (
                            <button
                              type="button"
                              className="icon-link danger"
                              onClick={() => removeTopic(post)}
                              title="Delete discussion"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className="group-discussion-copy">
                          <p className="eyebrow">
                            Discussion · Level 1
                          </p>
                          <h2>{post.title}</h2>
                          <p>{post.body}</p>
                        </div>

                        <div className="group-forum-vote-row">
                          <button
                            type="button"
                            className={vote === 1 ? "active" : ""}
                            onClick={() =>
                              castForumVote(post, null, 1)
                            }
                            aria-label="Reinforce discussion"
                            title="Reinforce"
                          >
                            <Link2 size={18} />
                            <span>
                              {Number(post.forumUpCount || 0)}
                            </span>
                          </button>

                          <strong>
                            {Number(post.forumScore || 0)}
                          </strong>

                          <button
                            type="button"
                            className={vote === -1 ? "active" : ""}
                            onClick={() =>
                              castForumVote(post, null, -1)
                            }
                            aria-label="Break discussion link"
                            title="Break link"
                          >
                            <Unlink2 size={18} />
                            <span>
                              {Number(post.forumDownCount || 0)}
                            </span>
                          </button>
                        </div>

                        <button
                          type="button"
                          className="group-swipe-deeper-cue"
                          onClick={() => enterTopicReplies(post)}
                          disabled={busyTopicId === post.id}
                        >
                          Swipe left for replies
                          <MessageCircle size={16} />
                        </button>

                        <button
                          type="button"
                          className="classroom-swipe-back-cue"
                          onClick={() => setClassDepth(0)}
                        >
                          <ArrowLeft size={15} />
                          {selectedAssignment?.title || "Assignment"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {discussions.length > 1 && (
              <div className="group-discussion-dots">
                {discussions
                  .slice(
                    Math.max(0, discussionIndex - 3),
                    Math.min(discussions.length, discussionIndex + 4)
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
              onClick={() => setShowDiscussionComposer(true)}
              aria-label="New discussion"
              title="New discussion"
            >
              <Plus size={22} />
            </button>
          </>
        )}

        {replyModePostId && (
          <div className="group-reply-space classroom-reply-space">
            <div className="group-reply-depth-header">
              <button
                type="button"
                onClick={backReplyDepth}
              >
                <ArrowLeft size={17} />
                {replyLevels.length > 1 ? "Back" : "Discussion"}
              </button>

              <div
                className="group-reply-depth-dots"
                aria-label={`Depth ${replyLevels.length + 1} from assignment`}
              >
                <span title="Assignment" />
                <span title="Discussion" />
                {replyLevels.map((_, index) => (
                  <span
                    key={index}
                    className={
                      index === replyLevels.length - 1
                        ? "active"
                        : ""
                    }
                    title={`Reply level ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <div
              className="group-reply-reels"
              onScroll={handleReplyScroll}
            >
              {(replyLevels[replyLevels.length - 1]?.items || []).map(
                (reply) => {
                  const post = forumPosts.find(
                    (item) => item.id === replyModePostId
                  );

                  const vote =
                    forumVotes[voteKey("reply", reply.id)] || 0;

                  return (
                    <article
                      key={reply.id}
                      className="group-reply-reel"
                      onMouseEnter={() =>
                        ensureForumVote("reply", reply.id)
                      }
                    >
                      <div className="group-reply-card">
                        <div className="group-discussion-meta-row">
                          <span>
                            {reply.authorProfile?.displayName ||
                              reply.authorProfile?.username ||
                              "Reader"}
                            {reply.createdAtISO
                              ? ` · ${formatDate(reply.createdAtISO)}`
                              : ""}
                          </span>

                          {(reply.canDelete || canTeach) && (
                            <button
                              type="button"
                              className="icon-link danger"
                              onClick={() =>
                                removeReply(post, reply)
                              }
                              title="Delete reply"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        <div className="group-reply-copy">
                          <p className="eyebrow">
                            Reply · Level {replyLevels.length + 1}
                          </p>
                          <p>{reply.body}</p>
                        </div>

                        <div className="group-forum-vote-row">
                          <button
                            type="button"
                            className={vote === 1 ? "active" : ""}
                            onClick={() =>
                              castForumVote(post, reply, 1)
                            }
                            aria-label="Reinforce reply"
                            title="Reinforce"
                          >
                            <Link2 size={18} />
                            <span>
                              {Number(reply.forumUpCount || 0)}
                            </span>
                          </button>

                          <strong>
                            {Number(reply.forumScore || 0)}
                          </strong>

                          <button
                            type="button"
                            className={vote === -1 ? "active" : ""}
                            onClick={() =>
                              castForumVote(post, reply, -1)
                            }
                            aria-label="Break reply link"
                            title="Break link"
                          >
                            <Unlink2 size={18} />
                            <span>
                              {Number(reply.forumDownCount || 0)}
                            </span>
                          </button>
                        </div>

                        <div className="group-reply-actions">
                          <button
                            type="button"
                            className={
                              replyChildCount(post.id, reply.id) > 0
                                ? "group-swipe-deeper-cue"
                                : "group-swipe-deeper-cue branch-end"
                            }
                            onClick={() =>
                              enterReplyChildren(post, reply)
                            }
                          >
                            {replyChildCount(post.id, reply.id) > 0 ? (
                              <>
                                Swipe left for{" "}
                                {replyChildCount(post.id, reply.id)}{" "}
                                {replyChildCount(post.id, reply.id) === 1
                                  ? "reply"
                                  : "replies"}
                                <MessageCircle size={16} />
                              </>
                            ) : (
                              <>
                                End of branch · swipe left to reply
                                <Plus size={16} />
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            className="group-reply-add-button"
                            onClick={() =>
                              setReplyComposerParentId(reply.id)
                            }
                          >
                            <Plus size={15} />
                            Reply
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>

            {(replyLevels[replyLevels.length - 1]?.items || []).length > 1 && (
              <div className="group-reply-sibling-dots">
                {(replyLevels[replyLevels.length - 1]?.items || [])
                  .slice(
                    Math.max(
                      0,
                      (replyLevels[replyLevels.length - 1]?.selectedIndex || 0) - 3
                    ),
                    Math.min(
                      (replyLevels[replyLevels.length - 1]?.items || []).length,
                      (replyLevels[replyLevels.length - 1]?.selectedIndex || 0) + 4
                    )
                  )
                  .map((reply, localIndex) => {
                    const selectedIndex =
                      replyLevels[replyLevels.length - 1]?.selectedIndex || 0;
                    const start = Math.max(0, selectedIndex - 3);
                    const index = start + localIndex;

                    return (
                      <span
                        key={reply.id}
                        className={
                          index === selectedIndex ? "active" : ""
                        }
                      />
                    );
                  })}
              </div>
            )}
          </div>
        )}

        <div className="classroom-depth-dots-fixed" aria-hidden="true">
          <span className={classDepth === 0 ? "active" : ""} />
          <span className={classDepth === 1 ? "active" : ""} />
          {replyLevels.map((_, index) => (
            <span
              key={index}
              className={
                classDepth === index + 2 ? "active" : ""
              }
            />
          ))}
        </div>
      </section>

      {showCreateAssignment && canTeach && (
        <div className="group-compose-modal">
          <div
            className="group-compose-backdrop"
            onClick={clearAssignmentForm}
          />

          <form
            className="group-compose-sheet class-assignment-compose-sheet"
            onSubmit={saveAssignment}
          >
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">Class</p>
                <h2>
                  {editingAssignmentId
                    ? "Edit Assignment"
                    : "New Assignment"}
                </h2>
              </div>

              <button
                type="button"
                onClick={clearAssignmentForm}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {!editingAssignmentId && (
              <label>
                Assignment type
                <select
                  value={assignmentForm.type}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      type: event.target.value,
                      bookId: event.target.value === "test" ? "" : current.bookId,
                      author: event.target.value === "test" ? "" : current.author
                    }))
                  }
                >
                  <option value="reading">Reading</option>
                  <option value="test">Test</option>
                </select>
              </label>
            )}

            {!editingAssignmentId && assignmentForm.type === "reading" && (
              <>
                <label>
                  Find a book
                  <div className="search-bar">
                    <Search size={18} />
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
                      {bookSearchLoading ? "..." : "Search"}
                    </button>
                  </div>
                </label>

                <p className="status">{bookSearchStatus}</p>

                {bookSearchResults.length > 0 && (
                  <div className="class-assignment-search-results">
                    {bookSearchResults.map((book) => (
                      <button
                        key={book.id}
                        type="button"
                        onClick={() => chooseAssignmentBook(book)}
                      >
                        <strong>{book.title || "Untitled"}</strong>
                        <span>{getAuthorName(book)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
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
              />
            </label>

            {assignmentForm.type === "reading" && (
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
                />
              </label>
            )}

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
              />
            </label>

            {assignmentForm.type === "reading" ? (
              <div className="class-assignment-form-grid">
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
                  />
                </label>

                <label>
                  Points
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={assignmentForm.totalPoints}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({
                        ...current,
                        totalPoints: event.target.value
                      }))
                    }
                  />
                </label>
              </div>
            ) : (
              <>
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
                  />
                </label>

                <div className="class-test-builder">
                  {(assignmentForm.questions || []).map((question, questionIndex) => (
                    <section key={question.id} className="panel" style={{ padding: "1rem", marginBottom: "0.85rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
                        <strong>Question {questionIndex + 1}</strong>
                        <button
                          type="button"
                          className="icon-link danger"
                          onClick={() => removeTestQuestion(question.id)}
                          disabled={assignmentForm.questions.length <= 1}
                          title="Remove question"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <label>
                        Question type
                        <select
                          value={question.type}
                          onChange={(event) =>
                            updateTestQuestion(question.id, {
                              type: event.target.value,
                              options: event.target.value === "multiple_choice"
                                ? (question.options?.length ? question.options : ["", ""])
                                : question.options
                            })
                          }
                        >
                          <option value="multiple_choice">Multiple choice</option>
                          <option value="short_answer">Short answer</option>
                        </select>
                      </label>

                      <label>
                        Question
                        <textarea
                          rows={2}
                          required
                          value={question.prompt}
                          onChange={(event) => updateTestQuestion(question.id, { prompt: event.target.value })}
                        />
                      </label>

                      <label>
                        Points
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={question.points}
                          onChange={(event) => updateTestQuestion(question.id, { points: event.target.value })}
                        />
                      </label>

                      {question.type === "multiple_choice" ? (
                        <div>
                          <strong>Answer choices</strong>
                          {(question.options || []).map((option, optionIndex) => (
                            <div key={optionIndex} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "0.5rem", alignItems: "center", marginTop: "0.45rem" }}>
                              <input
                                type="radio"
                                style={{ width: "auto", minWidth: 0, flex: "0 0 auto", margin: 0 }}
                                name={`correct-${question.id}`}
                                checked={Number(question.correctOptionIndex) === optionIndex}
                                onChange={() => updateTestQuestion(question.id, { correctOptionIndex: optionIndex })}
                                aria-label={`Mark choice ${optionIndex + 1} correct`}
                              />
                              <input
                                required
                                value={option}
                                placeholder={`Choice ${optionIndex + 1}`}
                                onChange={(event) => updateTestOption(question.id, optionIndex, event.target.value)}
                              />
                              <button
                                type="button"
                                className="icon-link"
                                onClick={() => removeTestOption(question.id, optionIndex)}
                                disabled={(question.options || []).length <= 2}
                                title="Remove choice"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                          <button type="button" className="button secondary" onClick={() => addTestOption(question.id)} style={{ marginTop: "0.6rem" }}>
                            <Plus size={15} /> Add Choice
                          </button>
                          <small className="muted" style={{ display: "block", marginTop: "0.45rem" }}>
                            Select the radio button beside the correct answer.
                          </small>
                        </div>
                      ) : (
                        <label>
                          Answer key / grading notes
                          <textarea
                            rows={2}
                            value={question.gradingNotes || ""}
                            placeholder="Optional notes visible only to teachers and aides"
                            onChange={(event) => updateTestQuestion(question.id, { gradingNotes: event.target.value })}
                          />
                        </label>
                      )}
                    </section>
                  ))}

                  <button type="button" className="button secondary" onClick={addTestQuestion}>
                    <Plus size={16} /> Add Question
                  </button>
                </div>
              </>
            )}

            <button
              className="button primary"
              disabled={busy}
            >
              <Save size={16} />
              {editingAssignmentId
                ? "Save Changes"
                : assignmentForm.type === "test"
                  ? "Create Test"
                  : "Create Assignment"}
            </button>
          </form>
        </div>
      )}

      {showDiscussionComposer && selectedAssignment && canTeach && (
        <div className="group-compose-modal">
          <div
            className="group-compose-backdrop"
            onClick={() => setShowDiscussionComposer(false)}
          />

          <form
            className="group-compose-sheet"
            onSubmit={createTopic}
          >
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">
                  {selectedAssignment.title}
                </p>
                <h2>New Discussion</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowDiscussionComposer(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <input
              value={topicTitle}
              onChange={(event) => setTopicTitle(event.target.value)}
              placeholder="Discussion title"
              maxLength={120}
            />

            <textarea
              rows={5}
              value={topicBody}
              onChange={(event) => setTopicBody(event.target.value)}
              placeholder="Start a discussion about this assignment..."
              maxLength={3000}
            />

            <button
              className="button primary"
              disabled={busy}
            >
              <Send size={16} />
              Post Discussion
            </button>
          </form>
        </div>
      )}

      {replyComposerParentId !== undefined && (
        <div className="group-compose-modal">
          <div
            className="group-compose-backdrop"
            onClick={() => {
              setReplyComposerParentId(undefined);
              setReplyText("");
            }}
          />

          <div className="group-compose-sheet">
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">Class Discussion</p>
                <h2>Reply</h2>
              </div>

              <button
                type="button"
                onClick={() => {
                  setReplyComposerParentId(undefined);
                  setReplyText("");
                }}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <textarea
              rows={5}
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Write your reply..."
              maxLength={5000}
            />

            <button
              type="button"
              className="button primary"
              disabled={
                busyTopicId ===
                  (replyModePostId || selectedDiscussion?.id) ||
                !replyText.trim()
              }
              onClick={() => {
                const post = replyModePostId
                  ? forumPosts.find(
                      (item) => item.id === replyModePostId
                    )
                  : selectedDiscussion;

                if (post) {
                  sendForumReply(
                    post,
                    replyComposerParentId || null
                  );
                }
              }}
            >
              <Send size={16} />
              Reply
            </button>
          </div>
        </div>
      )}

      {showProgress && canTeach && selectedAssignment && (
        <div className="group-compose-modal">
          <div
            className="group-compose-backdrop"
            onClick={() => setShowProgress(false)}
          />

          <div className="group-compose-sheet class-progress-sheet">
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">
                  {selectedAssignment.title}
                </p>
                <h2>Student Progress</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowProgress(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {progressLoading ? (
              <p className="muted">Loading progress...</p>
            ) : studentProgress.length ? (
              <div className="class-progress-list">
                {studentProgress.map((student) => (
                  <div
                    key={student.userId}
                    className="class-progress-row"
                  >
                    <Link to={`/read/public/${student.userId}`}>
                      <strong>{memberName(student)}</strong>
                    </Link>

                    <div>
                      <ProgressBar value={student.assignmentPercent} />
                      <small className="muted">
                        {assignmentType(selectedAssignment) === "test"
                          ? student.submission
                            ? student.graded
                              ? `Graded · ${scoreLabel(student.score, student.maxPoints)}`
                              : "Submitted · awaiting grade"
                            : "Not submitted"
                          : `${student.assignmentPercent}% · ${student.complete ? "Complete" : student.progress ? "In progress" : "Not started"}`}
                      </small>
                    </div>

                    {assignmentType(selectedAssignment) === "test" ? (
                      student.submission ? (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => openStudentTestReview(student)}
                        >
                          <ClipboardCheck size={15} />
                          {student.graded ? "Review Grade" : "Grade Test"}
                        </button>
                      ) : (
                        <small className="muted">Not submitted</small>
                      )
                    ) : (
                      <small className="muted">
                        {student.progress?.updatedAtISO
                          ? `Last read ${formatDateTime(student.progress.updatedAtISO)}`
                          : "Not started"}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No students are enrolled yet.</p>
            )}
          </div>
        </div>
      )}

      {showTest && selectedAssignment && assignmentType(selectedAssignment) === "test" && !canTeach && (
        <div className="group-compose-modal">
          <div className="group-compose-backdrop" onClick={() => setShowTest(false)} />
          <form className="group-compose-sheet" onSubmit={submitTest}>
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">Test</p>
                <h2>{selectedAssignment.title}</h2>
              </div>
              <button type="button" onClick={() => setShowTest(false)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            {selectedAssignment.instructions && <p>{selectedAssignment.instructions}</p>}
            {testSubmission && (
              <div className="status">
                <CheckCircle2 size={16} /> Submitted
                {testSubmission.graded
                  ? ` · ${scoreLabel(testSubmission.score, testSubmission.maxPoints)}`
                  : " · Awaiting grade"}
              </div>
            )}

            {(selectedAssignment.questions || []).map((question, index) => (
              <section key={question.id} className="panel" style={{ padding: "1rem", marginBottom: "0.8rem" }}>
                <strong>{index + 1}. {question.prompt}</strong>
                <small className="muted" style={{ display: "block", marginBottom: "0.5rem" }}>{question.points} point{Number(question.points) === 1 ? "" : "s"}</small>
                {question.type === "multiple_choice" ? (
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    {(question.options || []).map((option, optionIndex) => (
                      <label key={optionIndex} style={{ display: "inline-flex", width: "fit-content", maxWidth: "100%", gap: "0.4rem", alignItems: "center", justifyContent: "flex-start", cursor: testSubmission ? "default" : "pointer" }}>
                        <input
                          type="radio"
                          style={{ width: "auto", minWidth: 0, flex: "0 0 auto", margin: 0 }}
                          name={`answer-${question.id}`}
                          checked={Number(testAnswers[question.id]) === optionIndex}
                          disabled={Boolean(testSubmission)}
                          onChange={() => setTestAnswers((current) => ({ ...current, [question.id]: optionIndex }))}
                        />
                        <span>{option}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    rows={4}
                    value={testAnswers[question.id] || ""}
                    disabled={Boolean(testSubmission)}
                    onChange={(event) => setTestAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                    placeholder="Your answer"
                  />
                )}
              </section>
            ))}

            {!testSubmission && (
              <button className="button primary" disabled={busy}>
                <Send size={16} /> Submit Test
              </button>
            )}
          </form>
        </div>
      )}

      {reviewStudent && selectedAssignment && assignmentType(selectedAssignment) === "test" && canTeach && (
        <div className="group-compose-modal">
          <div className="group-compose-backdrop" onClick={() => setReviewStudent(null)} />
          <form className="group-compose-sheet" onSubmit={saveTestGrade}>
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">{selectedAssignment.title}</p>
                <h2>Grade {memberName(reviewStudent)}</h2>
              </div>
              <button type="button" onClick={() => setReviewStudent(null)} aria-label="Close">
                <X size={19} />
              </button>
            </div>

            {(selectedAssignment.questions || []).map((question, index) => {
              const answer = reviewStudent.submission?.answers?.[question.id];
              const correctIndex = reviewAnswerKey?.[question.id]?.correctOptionIndex;
              const isCorrect = question.type === "multiple_choice" && Number(answer) === Number(correctIndex);

              return (
                <section key={question.id} className="panel" style={{ padding: "1rem", marginBottom: "0.8rem" }}>
                  <strong>{index + 1}. {question.prompt}</strong>
                  {question.type === "multiple_choice" ? (
                    <>
                      <p>Student: <strong>{question.options?.[Number(answer)] ?? "No answer"}</strong></p>
                      <small className="muted">
                        {isCorrect ? `Correct · ${question.points} points` : `Incorrect · correct answer: ${question.options?.[Number(correctIndex)] ?? "—"}`}
                      </small>
                    </>
                  ) : (
                    <>
                      <p style={{ whiteSpace: "pre-wrap" }}>{answer || "No answer"}</p>
                      {reviewAnswerKey?.[question.id]?.gradingNotes && (
                        <small className="muted">Answer key: {reviewAnswerKey[question.id].gradingNotes}</small>
                      )}
                      <label>
                        Points awarded (max {question.points})
                        <input
                          type="number"
                          min="0"
                          max={question.points}
                          step="0.5"
                          value={manualScores[question.id] ?? ""}
                          onChange={(event) => setManualScores((current) => ({ ...current, [question.id]: event.target.value }))}
                        />
                      </label>
                    </>
                  )}
                </section>
              );
            })}

            <label>
              Feedback
              <textarea rows={3} value={gradeFeedback} onChange={(event) => setGradeFeedback(event.target.value)} />
            </label>

            <button className="button primary" disabled={busy}>
              <Save size={16} /> Save Grade
            </button>
          </form>
        </div>
      )}

      {showGrades && (
        <div className="group-compose-modal">
          <div
            className="group-compose-backdrop"
            onClick={() => setShowGrades(false)}
          />

          <div className="group-compose-sheet class-progress-sheet">
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">Class</p>
                <h2>Grades</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowGrades(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            {gradesLoading ? (
              <p className="muted">Loading grades...</p>
            ) : canTeach ? (
              Array.isArray(gradebook) && gradebook.length ? (
                <div style={{ display: "grid", gap: "1rem" }}>
                  {gradebook.map((student) => (
                    <section key={student.userId} className="panel" style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
                        <Link to={`/read/public/${student.userId}`}>
                          <strong>{memberName(student)}</strong>
                        </Link>
                        <strong>{gradePercentLabel(student.gradeSummary?.percent)}</strong>
                      </div>
                      <small className="muted">
                        {student.gradeSummary?.earned || 0}/{student.gradeSummary?.possible || 0} graded points
                        {student.gradeSummary?.pendingAssignments ? ` · ${student.gradeSummary.pendingAssignments} pending` : ""}
                      </small>

                      <div style={{ display: "grid", gap: "0.55rem", marginTop: "0.8rem" }}>
                        {(student.grades || []).map((row) => (
                          <div key={row.assignmentId} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center", borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: "0.55rem" }}>
                            <div>
                              <strong style={{ display: "block" }}>{row.title}</strong>
                              <small className="muted">{row.type === "test" ? "Test" : "Reading"}</small>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <strong>{row.graded ? gradePercentLabel(row.percent) : "Pending"}</strong>
                              <small className="muted" style={{ display: "block" }}>
                                {row.graded ? `${row.score}/${row.maxPoints} pts` : `${row.maxPoints} pts`}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <p className="muted">No students are enrolled yet.</p>
              )
            ) : gradebook?.rows ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                <section className="panel" style={{ padding: "1rem" }}>
                  <small className="muted">Overall grade</small>
                  <h2 style={{ margin: "0.2rem 0" }}>{gradePercentLabel(gradebook.summary?.percent)}</h2>
                  <p className="muted" style={{ margin: 0 }}>
                    {gradebook.summary?.earned || 0}/{gradebook.summary?.possible || 0} graded points
                    {gradebook.summary?.pendingAssignments ? ` · ${gradebook.summary.pendingAssignments} pending` : ""}
                  </p>
                </section>

                <div style={{ display: "grid", gap: "0.65rem" }}>
                  {gradebook.rows.map((row) => (
                    <section key={row.assignmentId} className="panel" style={{ padding: "0.9rem 1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
                        <div>
                          <strong style={{ display: "block" }}>{row.title}</strong>
                          <small className="muted">{row.type === "test" ? "Test" : "Reading"}</small>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <strong>{row.graded ? gradePercentLabel(row.percent) : "Pending"}</strong>
                          <small className="muted" style={{ display: "block" }}>
                            {row.graded ? `${row.score}/${row.maxPoints} pts` : `${row.maxPoints} pts`}
                          </small>
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">No grades yet.</p>
            )}
          </div>
        </div>
      )}

      {showStudents && (
        <div className="group-compose-modal">
          <div
            className="group-compose-backdrop"
            onClick={() => setShowStudents(false)}
          />

          <div className="group-compose-sheet class-roster-sheet">
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">Class</p>
                <h2>
                  {canTeach ? "Students & Teachers" : "Classmates"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowStudents(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div className="class-roster-summary">
              <span>
                <GraduationCap size={14} />
                {teacherCount} {teacherCount === 1 ? "teacher" : "teachers"}
              </span>
              <span>
                <Users size={14} />
                {studentCount} {studentCount === 1 ? "student" : "students"}
              </span>
              {aideCount > 0 && (
                <span>
                  <Users size={14} />
                  {aideCount} {aideCount === 1 ? "aide" : "aides"}
                </span>
              )}
              <span>{classRoleLabel(myRole)}</span>
            </div>

            {canManageClass && (
              <ShareInviteCard
                title="Invite students"
                description="Anyone with this QR code or link can join this class as a Student. Create a new link at any time to revoke the old one."
                url={shareInviteUrl}
                shareText={`Join ${group?.name || "my class"} on Lit Chain.`}
                loading={shareInviteLoading}
                onRegenerate={regenerateShareInvite}
              />
            )}

            <div className="class-roster-list">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="class-roster-row"
                >
                  <Link to={`/read/public/${member.userId}`}>
                    <strong>{memberName(member)}</strong>
                    <small>{classRoleLabel(member.role)}</small>
                  </Link>

                  {canTeach &&
                    !["owner", "admin", "moderator"].includes(member.role) &&
                    (() => {
                      const classProgress = classStudentProgress.find(
                        (item) => String(item.userId) === String(member.userId)
                      );
                      if (!classProgress) return null;

                      return (
                        <div style={{ minWidth: 190, flex: "1 1 220px" }}>
                          <ProgressBar value={classProgress.classPercent} />
                          <small className="muted">
                            {classProgress.classPercent}% · {classProgress.assignmentsCompleted} of {classProgress.assignmentsTotal} assignments
                          </small>
                        </div>
                      );
                    })()}

                  {isOwner && member.role !== "owner" && (
                    <div className="class-roster-tools">
                      <select
                        value={
                          member.role === "admin"
                            ? "teacher"
                            : member.role === "moderator"
                              ? "aide"
                              : "student"
                        }
                        onChange={(event) =>
                          changeClassRole(
                            member,
                            event.target.value
                          )
                        }
                        disabled={busy}
                      >
                        <option value="student">Student</option>
                        <option value="aide">Aide</option>
                        <option value="teacher">Teacher</option>
                      </select>

                      <button
                        type="button"
                        className="icon-link danger"
                        onClick={() => removeStudent(member)}
                        disabled={busy}
                        title="Remove"
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {canManageClass && inviteableFriends.length > 0 && (
              <div className="class-invite-list">
                <h3>Invite to class</h3>

                {inviteableFriends.map((friend) => (
                  <div key={friend.otherUserId}>
                    <span>
                      {friend.profile?.displayName || "Reader"}
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
            )}
          </div>
        </div>
      )}

      {showSettings && canManageClass && (
        <div className="group-compose-modal">
          <div
            className="group-compose-backdrop"
            onClick={() => setShowSettings(false)}
          />

          <form
            className="group-compose-sheet class-settings-sheet"
            onSubmit={saveSettings}
          >
            <div className="group-compose-header">
              <div>
                <p className="eyebrow">Class Management</p>
                <h2>Settings</h2>
              </div>

              <button
                type="button"
                onClick={() => setShowSettings(false)}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

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
                    description: event.target.value
                  }))
                }
              />
            </label>

            <div>
              <strong>Class avatar</strong>
              <div className="class-avatar-grid">
                {GROUP_AVATARS.map((avatarOption) => {
                  const selected =
                    settingsForm.avatar === avatarOption.id ||
                    settingsForm.avatar === avatarOption.image;

                  return (
                    <button
                      key={avatarOption.id}
                      type="button"
                      className={selected ? "active" : ""}
                      onClick={() =>
                        setSettingsForm((current) => ({
                          ...current,
                          avatar: avatarOption.id
                        }))
                      }
                    >
                      <img
                        src={avatarOption.image}
                        alt={avatarOption.name}
                      />
                      <small>{avatarOption.name}</small>
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
                    visibility: event.target.value
                  }))
                }
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </label>

            <label>
              Joining
              <select
                value={settingsForm.joinPolicy}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    joinPolicy: event.target.value
                  }))
                }
              >
                <option value="invite_only">Invite only</option>
                <option value="request_to_join">Request to join</option>
                <option value="open">Open</option>
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
        </div>
      )}
    </main>
  );
}
