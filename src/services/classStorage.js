import {
  addDoc,
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
    throw new Error(
      "Choose a book before creating the assignment."
    );
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

  const assignmentData = {
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

  const assignmentRef = await addDoc(
    collection(
      db,
      "groups",
      String(classId),
      "assignments"
    ),
    assignmentData
  );

  invalidateAssignmentCache(classId, bookId);

  notifyStudentsOfAssignment(
    classId,
    assignmentRef.id,
    {
      ...assignmentData,
      createdAt: undefined
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

  const assignmentRef = doc(
    db,
    "groups",
    String(classId),
    "assignments",
    String(assignmentId)
  );

  const existing = await getDoc(assignmentRef);
  const existingBookId = existing.exists()
    ? existing.data()?.bookId
    : null;

  const startParagraphIndex = Math.max(
    Number(updates.startParagraphIndex) || 0,
    0
  );

  await updateDoc(assignmentRef, {
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
  });

  if (existingBookId) {
    invalidateAssignmentCache(classId, existingBookId);
  }
}

export async function deleteClassAssignment(
  classId,
  assignmentId
) {
  requireUser();

  const assignmentRef = doc(
    db,
    "groups",
    String(classId),
    "assignments",
    String(assignmentId)
  );

  const existing = await getDoc(assignmentRef);
  const existingBookId = existing.exists()
    ? existing.data()?.bookId
    : null;

  await deleteDoc(assignmentRef);

  if (existingBookId) {
    invalidateAssignmentCache(classId, existingBookId);
  }
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

  const byBook = new Map(
    rows.map((row) => [String(row.bookId), row])
  );

  const result = {};

  for (const assignment of assignments || []) {
    const progress =
      byBook.get(String(assignment.bookId)) || null;

    result[assignment.id] = {
      progress,
      assignmentPercent: assignmentRangePercent(
        progress,
        assignment
      ),
      complete:
        assignmentRangePercent(progress, assignment) >= 100
    };
  }

  return result;
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
    progressRows.map((row) => [
      String(row.userId),
      row
    ])
  );

  const students = members.filter(
    (member) =>
      !["owner", "admin"].includes(member.role) &&
      !["removed", "suspended"].includes(member.status)
  );

  return students.map((member) => {
    const progress =
      progressByUser.get(String(member.userId)) || null;

    const assignmentPercent = assignmentRangePercent(
      progress,
      assignment
    );

    return {
      ...member,
      progress,
      assignmentPercent,
      complete: assignmentPercent >= 100
    };
  });
}
