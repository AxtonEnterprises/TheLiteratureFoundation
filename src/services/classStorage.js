import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";

import { auth, db } from "../firebase";

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be logged in.");
  return user;
}

export async function getClassAssignments(classId) {
  const ref = collection(db, "groups", String(classId), "assignments");
  const snapshot = await getDocs(query(ref, orderBy("createdAtISO", "desc")));

  return snapshot.docs.map((assignmentDoc) => ({
    id: assignmentDoc.id,
    ...assignmentDoc.data()
  }));
}

export async function createClassAssignment(classId, assignment) {
  const user = requireUser();

  const cleanBookId = String(assignment.bookId || "").trim();
  const cleanTitle = String(assignment.title || "").trim();

  if (!cleanBookId || !cleanTitle) {
    throw new Error("Book ID and title are required.");
  }

  const startParagraphIndex =
    assignment.startParagraphIndex === "" ||
    assignment.startParagraphIndex === null ||
    assignment.startParagraphIndex === undefined
      ? 0
      : Math.max(Number(assignment.startParagraphIndex) || 0, 0);

  const endParagraphIndex =
    assignment.endParagraphIndex === "" ||
    assignment.endParagraphIndex === null ||
    assignment.endParagraphIndex === undefined
      ? null
      : Math.max(Number(assignment.endParagraphIndex) || 0, startParagraphIndex);

  const createdAtISO = new Date().toISOString();

  const result = await addDoc(
    collection(db, "groups", String(classId), "assignments"),
    {
      bookId: cleanBookId,
      title: cleanTitle,
      author: String(assignment.author || "").trim(),
      instructions: String(assignment.instructions || "").trim(),
      dueAt: assignment.dueAt || null,
      startParagraphIndex,
      endParagraphIndex,
      assignedBy: user.uid,
      createdAtISO,
      createdAt: serverTimestamp()
    }
  );

  return result.id;
}

export async function updateClassAssignment(classId, assignmentId, updates) {
  requireUser();

  const clean = {
    title: String(updates.title || "").trim(),
    author: String(updates.author || "").trim(),
    instructions: String(updates.instructions || "").trim(),
    dueAt: updates.dueAt || null,
    startParagraphIndex: Math.max(Number(updates.startParagraphIndex) || 0, 0),
    endParagraphIndex:
      updates.endParagraphIndex === "" ||
      updates.endParagraphIndex === null ||
      updates.endParagraphIndex === undefined
        ? null
        : Math.max(Number(updates.endParagraphIndex) || 0, 0),
    updatedAtISO: new Date().toISOString(),
    updatedAt: serverTimestamp()
  };

  await updateDoc(
    doc(db, "groups", String(classId), "assignments", String(assignmentId)),
    clean
  );
}

export async function deleteClassAssignment(classId, assignmentId) {
  requireUser();
  await deleteDoc(
    doc(db, "groups", String(classId), "assignments", String(assignmentId))
  );
}

export async function getStudentReadingProgress(userId, bookId) {
  const progressRef = doc(
    db,
    "users",
    String(userId),
    "readingProgress",
    String(bookId)
  );

  const snapshot = await getDoc(progressRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function getClassAssignmentProgress(members, assignment) {
  const students = members.filter(
    (member) => !["owner", "admin", "teacher"].includes(member.role)
  );

  const results = await Promise.all(
    students.map(async (member) => {
      let progress = null;

      try {
        progress = await getStudentReadingProgress(
          member.userId,
          assignment.bookId
        );
      } catch (error) {
        console.error(
          `Could not read progress for ${member.userId}:`,
          error
        );
      }

      const currentParagraph = Number(progress?.paragraphIndex || 0);
      const start = Number(assignment.startParagraphIndex || 0);
      const end =
        assignment.endParagraphIndex === null ||
        assignment.endParagraphIndex === undefined
          ? Number(progress?.totalParagraphs || 0) - 1
          : Number(assignment.endParagraphIndex);

      let assignmentPercent = Number(progress?.percentComplete || 0);

      if (end >= start && end > 0) {
        assignmentPercent = Math.round(
          Math.min(
            Math.max((currentParagraph - start) / Math.max(end - start, 1), 0),
            1
          ) * 100
        );
      }

      return {
        ...member,
        progress,
        assignmentPercent,
        complete: assignmentPercent >= 100
      };
    })
  );

  return results;
}
