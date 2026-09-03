*** storage.js — default General Class Discussion ***

Use the latest createGroup() implementation.

1) Immediately after `memberRef`, create a forum post reference:

  const generalDiscussionRef = doc(
    collection(
      db,
      "groups",
      groupRef.id,
      "forumPosts"
    )
  );

2) Inside the existing runTransaction(), after transaction.set(memberRef,...),
add this only for classes:

      if (cleanType === "class") {
        transaction.set(
          generalDiscussionRef,
          {
            id: generalDiscussionRef.id,
            groupId: groupRef.id,
            userId: user.uid,
            title: "General Class Discussion",
            body:
              "Use this discussion for class-wide questions, announcements, and conversation.",
            pinned: false,
            locked: false,
            isGeneralClassDiscussion: true,
            createdAtISO: now,
            updatedAtISO: now,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }
        );
      }

3) IMPORTANT: because this post is created in the SAME transaction as the
owner membership, the current forum create rule's `isGroupMember(groupId)`
may not see the new membership until after the transaction.

For the cleanest atomic implementation, add this helper to firestore.rules:

function classMemberAfter(groupId) {
  return signedIn()
   && existsAfter(
     /databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)
   )
   && !(
     getAfter(
       /databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)
     ).data.keys().hasAll(["status"])
     && getAfter(
       /databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)
     ).data.status in ["removed", "suspended"]
   );
}

Then adjust the forum post create rule's membership portion to:

     && (
       isGroupMember(groupId)
       || (
         classMemberAfter(groupId)
         && existsAfter(
           /databases/$(database)/documents/groups/$(groupId)
         )
         && getAfter(
           /databases/$(database)/documents/groups/$(groupId)
         ).data.type == "class"
         && getAfter(
           /databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)
         ).data.role in ["owner", "admin", "moderator"]
       )
     )

and then apply the class topic restriction against the after-state too:

     && (
       (
         exists(
           /databases/$(database)/documents/groups/$(groupId)
         )
         && get(
           /databases/$(database)/documents/groups/$(groupId)
         ).data.type != "class"
       )
       ||
       classTeacher(groupId)
       ||
       (
         existsAfter(
           /databases/$(database)/documents/groups/$(groupId)
         )
         && getAfter(
           /databases/$(database)/documents/groups/$(groupId)
         ).data.type == "class"
         && getAfter(
           /databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)
         ).data.role in ["owner", "admin", "moderator"]
       )
     )

This keeps class creation + owner membership + General Class Discussion atomic.
If any one write is rejected, the class is not partially created.
