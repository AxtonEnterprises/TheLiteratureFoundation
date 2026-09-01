import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";

import { auth, db } from "../firebase";

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("Log in to connect notes.");
  return user;
}

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function noteSnapshot(entry) {
  return {
    noteId: String(entry.id),
    bookId: entry.bookId != null ? String(entry.bookId) : null,
    title: cleanText(entry.title || "Untitled", 500),
    author: cleanText(entry.author || "", 300),
    paragraphIndex: Number.isInteger(Number(entry.paragraphIndex))
      ? Number(entry.paragraphIndex)
      : null,
    paragraphNumber: Number.isInteger(Number(entry.paragraphNumber))
      ? Number(entry.paragraphNumber)
      : null,
    preview: cleanText(entry.note, 240)
  };
}

export async function createNoteLink({ sourceEntry, targetEntry, relationship = "" }) {
  const user = requireUser();

  if (!sourceEntry?.id || !targetEntry?.id) {
    throw new Error("Both notes are required.");
  }
  if (String(sourceEntry.id) === String(targetEntry.id)) {
    throw new Error("A note cannot link to itself.");
  }

  const linksRef = collection(db, "noteLinks");
  const linkRef = doc(linksRef);
  const now = new Date().toISOString();

  const link = {
    id: linkRef.id,
    createdBy: user.uid,
    sourceUserId: user.uid,
    sourceNoteId: String(sourceEntry.id),
    targetUserId: user.uid,
    targetNoteId: String(targetEntry.id),
    relationship: cleanText(relationship, 500),
    source: noteSnapshot(sourceEntry),
    target: noteSnapshot(targetEntry),
    createdAtISO: now
  };

  await setDoc(linkRef, {
    ...link,
    createdAt: serverTimestamp()
  });

  return link;
}

export async function getMyNoteLinks() {
  const user = auth.currentUser;
  if (!user) return [];

  const linksQuery = query(
    collection(db, "noteLinks"),
    where("createdBy", "==", user.uid)
  );
  const snapshot = await getDocs(linksQuery);

  return snapshot.docs
    .map((linkDoc) => ({ id: linkDoc.id, ...linkDoc.data() }))
    .sort((a, b) => String(b.createdAtISO || "").localeCompare(String(a.createdAtISO || "")));
}

export async function deleteNoteLink(linkId) {
  requireUser();
  if (!linkId) return;
  await deleteDoc(doc(db, "noteLinks", String(linkId)));
}
