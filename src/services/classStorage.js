import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where
} from "firebase/firestore";

import { auth, db } from "../firebase";
import { createNotification } from "./notifications.js";

const ASSIGNMENT_MATCH_CACHE_MS = 60 * 1000;
const assignmentMatchCache = new Map();

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  return user;
}

function cleanString(value) {
  return String(value || "").trim();
}

function currentProgressParagraph(progress) {
  if (!progress) return 0;

  return Math.max(
    Number(progress.furthestParagraphIndex) ||
      Number(progress.paragraphIndex) ||
      0,
    0
  );
}

export function assignmentRangePercent(progress, assignment) {
  if (!progress) return 0;

  const furthest = currentProgressParagraph(progress);
  const start = Math.max(Number(assignment.startParagraphIndex) || 0, 0);

  const explicitEnd =
    assignment.endParagraphIndex !== null &&
    assignment.endParagraphIndex !== undefined &&
    assignment.endParagraphIndex !== "";

  const end = explicitEnd
    ? Math.max(Number(assignment.endParagraphIndex) || 0, start)
    : Math.max(Number(progress.totalParagraphs || 1) - 1, start);

  if (furthest < start) return 0;

  const totalAssignedParagraphs = Math.max(end - start + 1, 1);
  const completedParagraphs = Math.min(
    Math.max(furthest - start + 1, 0),
    totalAssignedParagraphs
  );

  return Math.min(
    Math.max(
      Math.round(
        (completedParagraphs / totalAssignedParagraphs) * 100
      ),
      0
    ),
    100
  );
}

function assignmentNotificationMessage(groupName, assignment) {
  const due = assignment.dueAt
    ? new Date(`${assignment.dueAt}T12:00:00`).toLocaleDateString(
        undefined,
        {
          month: "short",
          day: "numeric"
        }
      )
    : "";

  return `${groupName || "Your class"} assigned ${
    assignment.title || "a book"
  }${due ? ` — due ${due}` : ""}.`;
}

async function notifyStudentsOfAssignment(
  classId,
  assignmentId,
  assignment
) {
  const user = auth.currentUser;

  if (!user) return;

  try {
    const [groupSnapshot, memberSnapshot] = await Promise.all([
      getDoc(doc(db, "groups", String(classId))),
      getDocs(
        collection(
          db,
          "groups",
          String(classId),
          "members"
        )
      )
    ]);

    const groupName = groupSnapshot.exists()
      ? groupSnapshot.data()?.name || "Your class"
      : "Your class";

    const studentIds = memberSnapshot.docs
      .map((memberDoc) => ({
        userId: memberDoc.id,
        ...memberDoc.data()
      }))
      .filter(
        (member) =>
          member.userId !== user.uid &&
          !["owner", "admin"].includes(member.role) &&
          !["removed", "suspended"].includes(member.status)
      )
      .map((member) => member.userId);

    await Promise.allSettled(
      studentIds.map((recipientUserId) =>
        createNotification({
          recipientUserId,
          type: "class_assignment",
          actorUserId: user.uid,
          groupId: String(classId),
          groupName,
          postId: String(assignmentId),
          targetPath: `/read/groups/${classId}`,
          message: assignmentNotificationMessage(
            groupName,
            assignment
          )
        })
      )
    );
  } catch (error) {
    console.warn(
      "Could not send class assignment notifications:",
      error
    );
  }
}

async function classHasAssignmentForBook(classId, bookId) {
  const key = `${classId}:${bookId}`;
  const cached = assignmentMatchCache.get(key);
  const now = Date.now();

  if (
    cached &&
    now - cached.checkedAt < ASSIGNMENT_MATCH_CACHE_MS
  ) {
    return cached.hasAssignment;
  }

  const snapshot = await getDocs(
    query(
      collection(
        db,
        "groups",
        String(classId),
        "assignments"
      ),
      where("bookId", "==", String(bookId))
    )
  );

  const hasAssignment = !snapshot.empty;

  assignmentMatchCache.set(key, {
    checkedAt: now,
    hasAssignment
  });

  return hasAssignment;
}

function invalidateAssignmentCache(classId, bookId = null) {
  if (bookId !== null && bookId !== undefined) {
    assignmentMatchCache.delete(
      `${String(classId)}:${String(bookId)}`
    );
    return;
  }

  const prefix = `${String(classId)}:`;

  for (const key of assignmentMatchCache.keys()) {
    if (key.startsWith(prefix)) {
      assignmentMatchCache.delete(key);
    }
  }
}

/* ============================================================
   ASSIGNMENTS + TESTS
============================================================ */

function assignmentType(assignment) {
  return assignment?.type === "test" ? "test" : "reading";
}

function cleanTestQuestions(questions) {
  if (!Array.isArray(questions)) return [];

  return questions
    .map((question, index) => {
      const type = question?.type === "short_answer"
        ? "short_answer"
        : "multiple_choice";
      const prompt = cleanString(question?.prompt);
      const points = Math.max(Math.round(Number(question?.points) || 1), 1);
      const id = cleanString(question?.id) || `q${index + 1}`;

      if (!prompt) return null;

      if (type === "multiple_choice") {
        const options = Array.isArray(question?.options)
          ? question.options.map(cleanString).filter(Boolean).slice(0, 8)
          : [];

        if (options.length < 2) return null;

        return { id, type, prompt, points, options };
      }

      return { id, type, prompt, points };
    })
    .filter(Boolean)
    .slice(0, 100);
}

function cleanAnswerKey(questions, answerKey = {}) {
  const result = {};

  for (const question of questions) {
    const raw = answerKey?.[question.id] || {};

    if (question.type === "multiple_choice") {
      const correctOptionIndex = Math.max(
        0,
        Math.min(
          question.options.length - 1,
          Math.round(Number(raw.correctOptionIndex) || 0)
        )
      );

      result[question.id] = { correctOptionIndex };
    } else {
      result[question.id] = {
        gradingNotes: cleanString(raw.gradingNotes).slice(0, 3000)
      };
    }
  }

  return result;
}

function totalTestPoints(questions) {
  return (questions || []).reduce(
    (sum, question) => sum + Math.max(Number(question.points) || 0, 0),
    0
  );
}

export async function getClassAssignments(classId) {
  const assignmentsRef = collection(
    db,
    "groups",
    String(classId),
    "assignments"
  );

  const snapshot = await getDocs(
    query(assignmentsRef, orderBy("createdAtISO", "desc"))
  );

  return snapshot.docs.map((assignmentDoc) => ({
    id: assignmentDoc.id,
    type: assignmentType(assignmentDoc.data()),
    ...assignmentDoc.data()
  }));
}

export async function createClassAssignment(classId, assignment) {
  const user = requireUser();
  const type = assignmentType(assignment);
  const title = cleanString(assignment.title);

  if (!title) {
    throw new Error("Add a title before creating the assignment.");
  }

  const createdAtISO = new Date().toISOString();
  const assignmentRef = doc(
    collection(db, "groups", String(classId), "assignments")
  );

  if (type === "test") {
    const questions = cleanTestQuestions(assignment.questions);

    if (!questions.length) {
      throw new Error("Add at least one complete test question.");
    }

    const answerKey = cleanAnswerKey(questions, assignment.answerKey);
    const assignmentData = {
      type: "test",
      title,
      author: "",
      bookId: "",
      instructions: cleanString(assignment.instructions),
      dueAt: assignment.dueAt || null,
      startParagraphIndex: 0,
      endParagraphIndex: null,
      questions,
      questionCount: questions.length,
      totalPoints: totalTestPoints(questions),
      assignedBy: user.uid,
      createdAtISO,
      createdAt: serverTimestamp()
    };

    const batch = writeBatch(db);
    batch.set(assignmentRef, assignmentData);
    batch.set(
      doc(assignmentRef, "answerKey", "current"),
      {
        assignmentId: assignmentRef.id,
        answers: answerKey,
        updatedBy: user.uid,
        updatedAtISO: createdAtISO,
        updatedAt: serverTimestamp()
      }
    );
    await batch.commit();

    notifyStudentsOfAssignment(classId, assignmentRef.id, assignmentData);
    return assignmentRef.id;
  }

  const bookId = cleanString(assignment.bookId);

  if (!bookId) {
    throw new Error("Choose a book before creating the reading assignment.");
  }

  const startParagraphIndex = Math.max(
    Number(assignment.startParagraphIndex) || 0,
    0
  );

  const endParagraphIndex =
    assignment.endParagraphIndex === "" ||
    assignment.endParagraphIndex === null ||
    assignment.endParagraphIndex === undefined
      ? null
      : Math.max(
          Number(assignment.endParagraphIndex) || 0,
          startParagraphIndex
        );

  const assignmentData = {
    type: "reading",
    bookId,
    title,
    author: cleanString(assignment.author),
    instructions: cleanString(assignment.instructions),
    dueAt: assignment.dueAt || null,
    startParagraphIndex,
    endParagraphIndex,
    assignedBy: user.uid,
    createdAtISO,
    createdAt: serverTimestamp()
  };

  await writeBatch(db)
    .set(assignmentRef, assignmentData)
    .commit();

  invalidateAssignmentCache(classId, bookId);
  notifyStudentsOfAssignment(classId, assignmentRef.id, assignmentData);
  return assignmentRef.id;
}

export async function getClassTestAnswerKey(classId, assignmentId) {
  requireUser();

  const snapshot = await getDoc(
    doc(
      db,
      "groups",
      String(classId),
      "assignments",
      String(assignmentId),
      "answerKey",
      "current"
    )
  );

  return snapshot.exists() ? snapshot.data() : null;
}

export async function updateClassAssignment(
  classId,
  assignmentId,
  updates
) {
  const user = requireUser();
  const assignmentRef = doc(
    db,
    "groups",
    String(classId),
    "assignments",
    String(assignmentId)
  );

  const existing = await getDoc(assignmentRef);
  if (!existing.exists()) throw new Error("Assignment not found.");

  const oldData = existing.data();
  const type = assignmentType(oldData);
  const title = cleanString(updates.title);

  if (!title) throw new Error("Add an assignment title.");

  if (type === "test") {
    const questions = cleanTestQuestions(updates.questions);
    if (!questions.length) {
      throw new Error("Add at least one complete test question.");
    }

    const answers = cleanAnswerKey(questions, updates.answerKey);
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    batch.update(assignmentRef, {
      title,
      instructions: cleanString(updates.instructions),
      dueAt: updates.dueAt || null,
      questions,
      questionCount: questions.length,
      totalPoints: totalTestPoints(questions),
      updatedAtISO: now,
      updatedAt: serverTimestamp()
    });

    batch.set(
      doc(assignmentRef, "answerKey", "current"),
      {
        assignmentId: String(assignmentId),
        answers,
        updatedBy: user.uid,
        updatedAtISO: now,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await batch.commit();
    return;
  }

  const startParagraphIndex = Math.max(
    Number(updates.startParagraphIndex) || 0,
    0
  );

  await updateDoc(assignmentRef, {
    title,
    author: cleanString(updates.author),
    instructions: cleanString(updates.instructions),
    dueAt: updates.dueAt || null,
    startParagraphIndex,
    endParagraphIndex:
      updates.endParagraphIndex === "" ||
      updates.endParagraphIndex === null ||
      updates.endParagraphIndex === undefined
        ? null
        : Math.max(
            Number(updates.endParagraphIndex) || 0,
            startParagraphIndex
          ),
    updatedAtISO: new Date().toISOString(),
    updatedAt: serverTimestamp()
  });

  if (oldData.bookId) {
    invalidateAssignmentCache(classId, oldData.bookId);
  }
}

export async function deleteClassAssignment(classId, assignmentId) {
  requireUser();

  const assignmentRef = doc(
    db,
    "groups",
    String(classId),
    "assignments",
    String(assignmentId)
  );

  const existing = await getDoc(assignmentRef);
  const existingData = existing.exists() ? existing.data() : null;

  if (assignmentType(existingData) === "test") {
    const submissions = await getDocs(collection(assignmentRef, "submissions"));
    await Promise.all(submissions.docs.map((item) => deleteDoc(item.ref)));
    await deleteDoc(doc(assignmentRef, "answerKey", "current"));
  }

  await deleteDoc(assignmentRef);

  if (existingData?.bookId) {
    invalidateAssignmentCache(classId, existingData.bookId);
  }
}

/* ============================================================
   TEST SUBMISSIONS + GRADING
============================================================ */

export async function getMyClassTestSubmission(classId, assignmentId) {
  const user = requireUser();
  const snapshot = await getDoc(
    doc(
      db,
      "groups",
      String(classId),
      "assignments",
      String(assignmentId),
      "submissions",
      user.uid
    )
  );

  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function submitClassTest(classId, assignmentId, answers) {
  const user = requireUser();
  const assignmentRef = doc(
    db,
    "groups",
    String(classId),
    "assignments",
    String(assignmentId)
  );
  const assignmentSnapshot = await getDoc(assignmentRef);

  if (!assignmentSnapshot.exists() || assignmentType(assignmentSnapshot.data()) !== "test") {
    throw new Error("Test not found.");
  }

  const assignment = assignmentSnapshot.data();
  const cleanAnswers = {};

  for (const question of assignment.questions || []) {
    const value = answers?.[question.id];

    if (question.type === "multiple_choice") {
      if (value === "" || value === null || value === undefined) continue;
      const optionIndex = Number(value);
      if (
        Number.isInteger(optionIndex) &&
        optionIndex >= 0 &&
        optionIndex < (question.options || []).length
      ) {
        cleanAnswers[question.id] = optionIndex;
      }
    } else {
      const text = cleanString(value).slice(0, 10000);
      if (text) cleanAnswers[question.id] = text;
    }
  }

  if (Object.keys(cleanAnswers).length !== (assignment.questions || []).length) {
    throw new Error("Answer every question before submitting the test.");
  }

  const submissionRef = doc(assignmentRef, "submissions", user.uid);
  const existing = await getDoc(submissionRef);
  if (existing.exists()) {
    throw new Error("This test has already been submitted.");
  }

  const submittedAtISO = new Date().toISOString();
  await writeBatch(db)
    .set(submissionRef, {
      assignmentId: String(assignmentId),
      userId: user.uid,
      answers: cleanAnswers,
      status: "submitted",
      graded: false,
      score: null,
      maxPoints: Math.max(Number(assignment.totalPoints) || totalTestPoints(assignment.questions), 0),
      submittedAtISO,
      submittedAt: serverTimestamp()
    })
    .commit();

  return getMyClassTestSubmission(classId, assignmentId);
}

export async function getClassTestSubmissions(classId, assignmentId) {
  requireUser();
  const snapshot = await getDocs(
    collection(
      db,
      "groups",
      String(classId),
      "assignments",
      String(assignmentId),
      "submissions"
    )
  );

  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function gradeClassTestSubmission(
  classId,
  assignmentId,
  userId,
  { manualScores = {}, feedback = "" } = {}
) {
  const grader = requireUser();
  const assignmentRef = doc(
    db,
    "groups",
    String(classId),
    "assignments",
    String(assignmentId)
  );
  const answerKeyRef = doc(assignmentRef, "answerKey", "current");
  const submissionRef = doc(assignmentRef, "submissions", String(userId));

  const [assignmentSnapshot, answerKeySnapshot, submissionSnapshot] = await Promise.all([
    getDoc(assignmentRef),
    getDoc(answerKeyRef),
    getDoc(submissionRef)
  ]);

  if (!assignmentSnapshot.exists() || !submissionSnapshot.exists()) {
    throw new Error("Test submission not found.");
  }
  if (!answerKeySnapshot.exists()) {
    throw new Error("This test does not have an answer key.");
  }

  const assignment = assignmentSnapshot.data();
  const key = answerKeySnapshot.data()?.answers || {};
  const submission = submissionSnapshot.data();
  let autoScore = 0;
  let manualScore = 0;
  const normalizedManualScores = {};

  for (const question of assignment.questions || []) {
    const points = Math.max(Number(question.points) || 0, 0);

    if (question.type === "multiple_choice") {
      if (
        Number(submission.answers?.[question.id]) ===
        Number(key?.[question.id]?.correctOptionIndex)
      ) {
        autoScore += points;
      }
      continue;
    }

    const awarded = Math.min(
      Math.max(Number(manualScores?.[question.id]) || 0, 0),
      points
    );
    normalizedManualScores[question.id] = awarded;
    manualScore += awarded;
  }

  const maxPoints = Math.max(
    Number(assignment.totalPoints) || totalTestPoints(assignment.questions),
    0
  );
  const score = Math.min(autoScore + manualScore, maxPoints);
  const now = new Date().toISOString();

  await updateDoc(submissionRef, {
    graded: true,
    status: "graded",
    autoScore,
    manualScore,
    manualScores: normalizedManualScores,
    score,
    maxPoints,
    feedback: cleanString(feedback).slice(0, 5000),
    gradedBy: grader.uid,
    gradedAtISO: now,
    gradedAt: serverTimestamp()
  });

  return { id: String(userId), ...submission, graded: true, status: "graded", autoScore, manualScore, manualScores: normalizedManualScores, score, maxPoints, feedback: cleanString(feedback).slice(0, 5000), gradedBy: grader.uid, gradedAtISO: now };
}

/* ============================================================
   CLASS PROGRESS MIRROR
============================================================ */

/*
 * Progress is mirrored only into classes that actually have an
 * assignment for this book. Unrelated reading is never written
 * into that class's progress collection.
 */
export async function syncClassReadingProgress({
  groups,
  book,
  paragraphIndex,
  totalParagraphs,
  percentComplete
}) {
  const user = auth.currentUser;

  if (
    !user ||
    !book?.id ||
    !Array.isArray(groups) ||
    !groups.length
  ) {
    return;
  }

  const classes = groups.filter(
    (group) => group?.type === "class"
  );

  if (!classes.length) return;

  const bookId = String(book.id);
  const currentParagraph = Math.max(
    Number(paragraphIndex) || 0,
    0
  );

  await Promise.allSettled(
    classes.map(async (classGroup) => {
      const classId = String(classGroup.id);

      const assigned = await classHasAssignmentForBook(
        classId,
        bookId
      );

      if (!assigned) {
        return;
      }

      const progressId = `${user.uid}_${bookId}`;
      const progressRef = doc(
        db,
        "groups",
        classId,
        "studentProgress",
        progressId
      );

      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(progressRef);
        const previous = existing.exists()
          ? existing.data()
          : {};

        const previousFurthest = Math.max(
          Number(previous.furthestParagraphIndex) ||
            Number(previous.paragraphIndex) ||
            0,
          0
        );

        const furthestParagraphIndex = Math.max(
          previousFurthest,
          currentParagraph
        );

        const previousPercent = Math.min(
          Math.max(
            Number(previous.percentComplete) || 0,
            0
          ),
          100
        );

        transaction.set(
          progressRef,
          {
            userId: user.uid,
            bookId,
            title: book.title || "Untitled",
            author: book.author || "",
            paragraphIndex: currentParagraph,
            furthestParagraphIndex,
            totalParagraphs: Math.max(
              Number(totalParagraphs) || 0,
              Number(previous.totalParagraphs) || 0
            ),
            percentComplete: Math.max(
              previousPercent,
              Math.min(
                Math.max(
                  Math.round(
                    Number(percentComplete) || 0
                  ),
                  0
                ),
                100
              )
            ),
            updatedAtISO: new Date().toISOString(),
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      });
    })
  );
}

export async function getClassBookProgress(
  classId,
  bookId
) {
  const progressRef = collection(
    db,
    "groups",
    String(classId),
    "studentProgress"
  );

  const snapshot = await getDocs(
    query(
      progressRef,
      where("bookId", "==", String(bookId))
    )
  );

  return snapshot.docs.map((progressDoc) => ({
    id: progressDoc.id,
    ...progressDoc.data()
  }));
}

export async function getMyClassProgress(classId) {
  const user = requireUser();

  const progressRef = collection(
    db,
    "groups",
    String(classId),
    "studentProgress"
  );

  const snapshot = await getDocs(
    query(
      progressRef,
      where("userId", "==", user.uid)
    )
  );

  return snapshot.docs.map((progressDoc) => ({
    id: progressDoc.id,
    ...progressDoc.data()
  }));
}

export async function getMyClassAssignmentProgress(
  classId,
  assignments
) {
  const rows = await getMyClassProgress(classId);
  const byBook = new Map(rows.map((row) => [String(row.bookId), row]));
  const result = {};

  await Promise.all(
    (assignments || []).map(async (assignment) => {
      if (assignmentType(assignment) === "test") {
        const submission = await getMyClassTestSubmission(classId, assignment.id);
        result[assignment.id] = {
          progress: submission,
          submission,
          assignmentPercent: submission ? 100 : 0,
          complete: Boolean(submission),
          graded: Boolean(submission?.graded),
          score: submission?.score ?? null,
          maxPoints: submission?.maxPoints ?? assignment.totalPoints ?? null
        };
        return;
      }

      const progress = byBook.get(String(assignment.bookId)) || null;
      const percent = assignmentRangePercent(progress, assignment);
      result[assignment.id] = {
        progress,
        assignmentPercent: percent,
        complete: percent >= 100
      };
    })
  );

  return result;
}

export async function getClassAssignmentProgress(
  classId,
  members,
  assignment
) {
  const students = members.filter(
    (member) =>
      !["owner", "admin", "moderator"].includes(member.role) &&
      !["removed", "suspended"].includes(member.status)
  );

  if (assignmentType(assignment) === "test") {
    const submissions = await getClassTestSubmissions(classId, assignment.id);
    const byUser = new Map(
      submissions.map((submission) => [String(submission.userId), submission])
    );

    return students.map((member) => {
      const submission = byUser.get(String(member.userId)) || null;
      return {
        ...member,
        progress: submission,
        submission,
        assignmentPercent: submission ? 100 : 0,
        complete: Boolean(submission),
        graded: Boolean(submission?.graded),
        score: submission?.score ?? null,
        maxPoints: submission?.maxPoints ?? assignment.totalPoints ?? null
      };
    });
  }

  const progressRows = await getClassBookProgress(classId, assignment.bookId);
  const progressByUser = new Map(
    progressRows.map((row) => [String(row.userId), row])
  );

  return students.map((member) => {
    const progress = progressByUser.get(String(member.userId)) || null;
    const assignmentPercent = assignmentRangePercent(progress, assignment);

    return {
      ...member,
      progress,
      assignmentPercent,
      complete: assignmentPercent >= 100
    };
  });
}
