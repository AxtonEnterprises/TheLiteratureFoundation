import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Plus,
  Trash2,
  Users
} from "lucide-react";

import SEO from "../components/SEO.jsx";
import { getGroupMembers } from "../services/storage.js";
import {
  createClassAssignment,
  deleteClassAssignment,
  getClassAssignmentProgress,
  getClassAssignments
} from "../services/classStorage.js";

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

function memberName(member) {
  return (
    member.profile?.displayName ||
    member.profile?.username ||
    member.displayName ||
    member.userId ||
    "Student"
  );
}

export default function Classroom({ initialGroup }) {
  const { groupId } = useParams();
  const [group] = useState(initialGroup);
  const [members, setMembers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [studentProgress, setStudentProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progressLoading, setProgressLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    bookId: "",
    title: "",
    author: "",
    instructions: "",
    dueAt: "",
    startParagraphIndex: 0,
    endParagraphIndex: ""
  });

  const myRole = group?.membership?.role || "member";
  const isTeacher = ["owner", "admin", "teacher"].includes(myRole);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const [loadedMembers, loadedAssignments] = await Promise.all([
          getGroupMembers(groupId),
          getClassAssignments(groupId)
        ]);

        if (!active) return;

        setMembers(loadedMembers);
        setAssignments(loadedAssignments);

        if (loadedAssignments.length) {
          setSelectedAssignmentId((current) => current || loadedAssignments[0].id);
        }
      } catch (error) {
        console.error("Could not load class:", error);
        if (active) setStatus(error?.message || "We couldn't load this class.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [groupId]);

  const selectedAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === selectedAssignmentId) || null,
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
        const rows = await getClassAssignmentProgress(members, selectedAssignment);
        if (active) setStudentProgress(rows);
      } catch (error) {
        console.error("Could not load class progress:", error);
        if (active) {
          setStatus(
            "Assignments loaded, but student progress could not be read. See the included Firestore rules note."
          );
        }
      } finally {
        if (active) setProgressLoading(false);
      }
    }

    loadProgress();
    return () => { active = false; };
  }, [isTeacher, members, selectedAssignment]);

  async function refreshAssignments(preferredId = "") {
    const loaded = await getClassAssignments(groupId);
    setAssignments(loaded);

    if (preferredId) {
      setSelectedAssignmentId(preferredId);
    } else if (!loaded.some((item) => item.id === selectedAssignmentId)) {
      setSelectedAssignmentId(loaded[0]?.id || "");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();

    try {
      setStatus("");
      const id = await createClassAssignment(groupId, form);
      await refreshAssignments(id);
      setForm({
        bookId: "",
        title: "",
        author: "",
        instructions: "",
        dueAt: "",
        startParagraphIndex: 0,
        endParagraphIndex: ""
      });
      setShowCreate(false);
      setStatus("Assignment created.");
    } catch (error) {
      setStatus(error?.message || "We couldn't create that assignment.");
    }
  }

  async function removeAssignment(assignment) {
    if (!window.confirm(`Delete the assignment "${assignment.title}"?`)) return;

    try {
      await deleteClassAssignment(groupId, assignment.id);
      await refreshAssignments();
      setStatus("Assignment deleted.");
    } catch (error) {
      setStatus(error?.message || "We couldn't delete that assignment.");
    }
  }

  if (loading) {
    return (
      <main className="page-wrap">
        <section className="panel"><p className="muted">Loading class...</p></section>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <SEO
        title={`${group?.name || "Class"} | Lit Chain`}
        description={`Classroom for ${group?.name || "Lit Chain"}.`}
        path={`/read/groups/${groupId}`}
      />

      <div className="stack-lg">
        <Link to="/read/profile?tab=groups" className="button secondary">
          <ArrowLeft size={16} />
          My Library
        </Link>

        <section className="hero-card small">
          <p className="eyebrow">Class</p>
          <h1>{group?.name || "Classroom"}</h1>
          <p className="muted">
            {group?.description || "Assignments, reading, and class progress."}
          </p>
        </section>

        {status && <p className="status">{status}</p>}

        <section className="panel">
          <div className="margin-reply-heading">
            <div>
              <p className="eyebrow">Assignments</p>
              <h2>Assigned Reading</h2>
            </div>

            {isTeacher && (
              <button
                type="button"
                className="button primary"
                onClick={() => setShowCreate((current) => !current)}
              >
                <Plus size={16} />
                Assign Book
              </button>
            )}
          </div>

          {showCreate && isTeacher && (
            <form className="stack-md" onSubmit={handleCreate}>
              <label>
                Gutenberg / Lit Chain Book ID
                <input
                  required
                  value={form.bookId}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, bookId: event.target.value }))
                  }
                  placeholder="Example: 1342"
                />
              </label>

              <label>
                Book title
                <input
                  required
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="Pride and Prejudice"
                />
              </label>

              <label>
                Author
                <input
                  value={form.author}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, author: event.target.value }))
                  }
                  placeholder="Jane Austen"
                />
              </label>

              <label>
                Instructions
                <textarea
                  rows={3}
                  value={form.instructions}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, instructions: event.target.value }))
                  }
                  placeholder="Read through Chapter 10..."
                />
              </label>

              <div className="profile-edit-grid">
                <label>
                  Start paragraph
                  <input
                    type="number"
                    min="0"
                    value={form.startParagraphIndex}
                    onChange={(event) =>
                      setForm((current) => ({
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
                    value={form.endParagraphIndex}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endParagraphIndex: event.target.value
                      }))
                    }
                    placeholder="Leave blank for whole book"
                  />
                </label>

                <label>
                  Due date
                  <input
                    type="date"
                    value={form.dueAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, dueAt: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="button-row">
                <button className="button primary">Create Assignment</button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {assignments.length === 0 && (
            <p className="muted">No reading has been assigned yet.</p>
          )}

          <div className="stack-md">
            {assignments.map((assignment) => (
              <article
                key={assignment.id}
                className={
                  selectedAssignmentId === assignment.id
                    ? "public-journal-entry active"
                    : "public-journal-entry"
                }
              >
                <div className="public-entry-heading">
                  <div>
                    <h3>{assignment.title}</h3>
                    {assignment.author && <p className="muted">{assignment.author}</p>}
                  </div>

                  <div className="button-row">
                    <Link
                      to={`/read/reader/${assignment.bookId}?paragraph=${assignment.startParagraphIndex || 0}`}
                      className="button primary"
                    >
                      <BookOpen size={16} />
                      Read
                    </Link>

                    {isTeacher && (
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => removeAssignment(assignment)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="public-entry-meta">
                  <span>
                    <CalendarDays size={14} />
                    {formatDate(assignment.dueAt)}
                  </span>
                  <span>
                    Paragraph {Number(assignment.startParagraphIndex || 0) + 1}
                    {assignment.endParagraphIndex !== null &&
                    assignment.endParagraphIndex !== undefined
                      ? `–${Number(assignment.endParagraphIndex) + 1}`
                      : " onward"}
                  </span>
                </div>

                {assignment.instructions && <p>{assignment.instructions}</p>}

                {isTeacher && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setSelectedAssignmentId(assignment.id)}
                  >
                    <GraduationCap size={16} />
                    View Student Progress
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        {isTeacher && selectedAssignment && (
          <section className="panel">
            <p className="eyebrow">Teacher Dashboard</p>
            <h2>{selectedAssignment.title}: Student Progress</h2>

            {progressLoading ? (
              <p className="muted">Loading student progress...</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Progress</th>
                      <th>Last Read</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentProgress.map((student) => (
                      <tr key={student.userId}>
                        <td>{memberName(student)}</td>
                        <td>{student.assignmentPercent}%</td>
                        <td>
                          {student.progress?.updatedAtISO
                            ? formatDate(student.progress.updatedAtISO)
                            : "Not started"}
                        </td>
                        <td>{student.complete ? "Complete" : "In progress"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!studentProgress.length && (
                  <p className="muted">No students are enrolled yet.</p>
                )}
              </div>
            )}
          </section>
        )}

        <section className="panel">
          <p className="eyebrow">Class Members</p>
          <h2>
            <Users size={20} /> {members.length} members
          </h2>
          <p className="muted">
            Membership, invitations, ownership, and moderation remain managed
            through the existing group/class system.
          </p>
        </section>
      </div>
    </main>
  );
}
