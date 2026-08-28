import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";

import { auth, db } from "../firebase";

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

function assignmentRangePercent(progress, assignment) {
  if (!progress) return 0;

  const currentParagraph = Math.max(Number(progress.paragraphIndex) || 0, 0);
  const start = Math.max(Number(assignment.startParagraphIndex) || 0, 0);

  const explicitEnd =
    assignment.endParagraphIndex !== null &&
    assignment.endParagraphIndex !== undefined &&
    assignment.endParagraphIndex !== "";

  const end = explicitEnd
    ? Math.max(Number(assignment.endParagraphIndex) || 0, start)
    : Math.max(Number(progress.totalParagraphs || 1) - 1, start);

  if (currentParagraph < start) return 0;

  if (end <= start) {
    return currentParagraph >= end ? 100 : 0;
  }

  return Math.min(
    Math.max(
      Math.round(((currentParagraph - start) / (end - start)) * 100),
      0
    ),
    100
  );
}

/* ============================================================
   ASSIGNMENTS
============================================================ */

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
    ...assignmentDoc.data()
  }));
}

export async function createClassAssignment(classId, assignment) {
  const user = requireUser();

  const bookId = cleanString(assignment.bookId);
  const title = cleanString(assignment.title);

  if (!bookId || !title) {
    throw new Error("Choose a book before creating the assignment.");
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

  const createdAtISO = new Date().toISOString();

  const assignmentRef = await addDoc(
    collection(db, "groups", String(classId), "assignments"),
    {
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
    }
  );

  return assignmentRef.id;
}

export async function updateClassAssignment(
  classId,
  assignmentId,
  updates
) {
  requireUser();

  const startParagraphIndex = Math.max(
    Number(updates.startParagraphIndex) || 0,
    0
  );

  await updateDoc(
    doc(
      db,
      "groups",
      String(classId),
      "assignments",
      String(assignmentId)
    ),
    {
      title: cleanString(updates.title),
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
    }
  );
}

export async function deleteClassAssignment(classId, assignmentId) {
  requireUser();

  await deleteDoc(
    doc(
      db,
      "groups",
      String(classId),
      "assignments",
      String(assignmentId)
    )
  );
}

/* ============================================================
   CLASS PROGRESS MIRROR
============================================================ */

/*
 * This mirrors only reading progress needed by a class.
 * It does NOT expose the student's private saved books, journal,
 * timeline settings, friends, or unrelated reading activity.
 */
export async function syncClassReadingProgress({
  groups,
  book,
  paragraphIndex,
  totalParagraphs,
  percentComplete
}) {
  const user = auth.currentUser;

  if (!user || !book?.id || !Array.isArray(groups) || !groups.length) {
    return;
  }

  const classes = groups.filter((group) => group?.type === "class");

  if (!classes.length) return;

  const now = new Date().toISOString();
  const bookId = String(book.id);

  await Promise.allSettled(
    classes.map((classGroup) => {
      const progressId = `${user.uid}_${bookId}`;

      return setDoc(
        doc(
          db,
          "groups",
          String(classGroup.id),
          "studentProgress",
          progressId
        ),
        {
          userId: user.uid,
          bookId,
          title: book.title || "Untitled",
          author: book.author || "",
          paragraphIndex: Math.max(Number(paragraphIndex) || 0, 0),
          totalParagraphs: Math.max(Number(totalParagraphs) || 0, 0),
          percentComplete: Math.min(
            Math.max(Math.round(Number(percentComplete) || 0), 0),
            100
          ),
          updatedAtISO: now,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    })
  );
}

export async function getClassBookProgress(classId, bookId) {
  const progressRef = collection(
    db,
    "groups",
    String(classId),
    "studentProgress"
  );

  const snapshot = await getDocs(
    query(progressRef, where("bookId", "==", String(bookId)))
  );

  return snapshot.docs.map((progressDoc) => ({
    id: progressDoc.id,
    ...progressDoc.data()
  }));
}

export async function getClassAssignmentProgress(
  classId,
  members,
  assignment
) {
  const progressRows = await getClassBookProgress(
    classId,
    assignment.bookId
  );

  const progressByUser = new Map(
    progressRows.map((row) => [String(row.userId), row])
  );

  const students = members.filter(
    (member) => !["owner", "admin"].includes(member.role)
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
