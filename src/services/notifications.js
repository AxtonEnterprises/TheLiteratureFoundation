import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";

import { auth, db } from "../firebase";

function currentUserId() {
  return auth.currentUser?.uid || null;
}

async function actorSnapshot(userId) {
  if (!userId) return {};

  try {
    const snap = await getDoc(
      doc(db, "publicProfiles", String(userId))
    );

    if (!snap.exists()) return {};

    const profile = snap.data();

    return {
      actorName:
        profile.displayName ||
        profile.username ||
        "A reader",
      actorUsername:
        profile.username ||
        "",
      actorAvatar:
        profile.avatar ||
        ""
    };
  } catch {
    return {};
  }
}

export async function createNotification({
  recipientUserId,
  type,
  actorUserId = currentUserId(),
  groupId = null,
  groupName = "",
  chainId = null,
  postId = null,
  targetPath = "",
  message = ""
}) {
  if (!recipientUserId || !type) {
    return null;
  }

  if (
    actorUserId &&
    String(recipientUserId) === String(actorUserId)
  ) {
    return null;
  }

  const ref =
    doc(
      collection(
        db,
        "notifications"
      )
    );

  const now =
    new Date()
      .toISOString();

  const actor =
    await actorSnapshot(
      actorUserId
    );

  const data = {
    id:
      ref.id,

    recipientUserId:
      String(
        recipientUserId
      ),

    type:
      String(
        type
      ),

    actorUserId:
      actorUserId
        ? String(
            actorUserId
          )
        : null,

    ...actor,

    groupId:
      groupId
        ? String(
            groupId
          )
        : null,

    groupName:
      String(
        groupName ||
        ""
      ),

    chainId:
      chainId
        ? String(
            chainId
          )
        : null,

    postId:
      postId
        ? String(
            postId
          )
        : null,

    targetPath:
      String(
        targetPath ||
        ""
      ),

    message:
      String(
        message ||
        ""
      ),

    read:
      false,

    createdAtISO:
      now
  };

  await setDoc(
    ref,
    {
      ...data,
      createdAt:
        serverTimestamp()
    }
  );

  return data;
}

export async function getNotifications(
  maxResults = 100
) {
  const uid =
    currentUserId();

  if (!uid) {
    return [];
  }

  const ref =
    collection(
      db,
      "notifications"
    );

  let snap;

  try {
    snap =
      await getDocs(
        query(
          ref,
          where(
            "recipientUserId",
            "==",
            uid
          ),
          orderBy(
            "createdAtISO",
            "desc"
          ),
          limit(
            maxResults
          )
        )
      );
  } catch {
    snap =
      await getDocs(
        query(
          ref,
          where(
            "recipientUserId",
            "==",
            uid
          )
        )
      );
  }

  return snap.docs
    .map(
      (item) => ({
        id:
          item.id,
        ...item.data()
      })
    )
    .sort(
      (a, b) =>
        String(
          b.createdAtISO ||
          ""
        ).localeCompare(
          String(
            a.createdAtISO ||
            ""
          )
        )
    )
    .slice(
      0,
      maxResults
    );
}

export function subscribeToUnreadNotifications(
  callback
) {
  const uid =
    currentUserId();

  if (!uid) {
    callback(0);
    return () => {};
  }

  const unreadQuery =
    query(
      collection(
        db,
        "notifications"
      ),
      where(
        "recipientUserId",
        "==",
        uid
      ),
      where(
        "read",
        "==",
        false
      )
    );

  return onSnapshot(
    unreadQuery,
    (snapshot) =>
      callback(
        snapshot.size
      ),
    (error) => {
      console.error(
        "Notification subscription error:",
        error
      );
      callback(0);
    }
  );
}

export async function markNotificationRead(
  notificationId
) {
  if (!notificationId) {
    return;
  }

  await updateDoc(
    doc(
      db,
      "notifications",
      String(
        notificationId
      )
    ),
    {
      read:
        true,
      readAtISO:
        new Date()
          .toISOString(),
      readAt:
        serverTimestamp()
    }
  );
}

export async function markAllNotificationsRead() {
  const uid =
    currentUserId();

  if (!uid) {
    return;
  }

  const snapshot =
    await getDocs(
      query(
        collection(
          db,
          "notifications"
        ),
        where(
          "recipientUserId",
          "==",
          uid
        ),
        where(
          "read",
          "==",
          false
        )
      )
    );

  if (
    snapshot.empty
  ) {
    return;
  }

  const batch =
    writeBatch(
      db
    );

  const now =
    new Date()
      .toISOString();

  snapshot.docs.forEach(
    (item) => {
      batch.update(
        item.ref,
        {
          read:
            true,
          readAtISO:
            now,
          readAt:
            serverTimestamp()
        }
      );
    }
  );

  await batch.commit();
}
