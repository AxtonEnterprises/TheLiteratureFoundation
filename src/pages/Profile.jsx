import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  onAuthStateChanged
} from "firebase/auth";

import {
  Link,
  useSearchParams
} from "react-router-dom";

import {
  Bookmark,
  Book,
  BookOpen,
  Globe2,
  Lock,
  MessageCircle,
  NotebookPen,
  Pencil,
  Search,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Plus,
  Users,
  X
} from "lucide-react";

import { auth } from "../firebase";

import {
  getJournal,
  getReadingTimeline,
  getReadingTimelineVisibility,
  getSavedBooks,
  getSavedMargins,
  getUserProfile,
  getFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  respondToFriendRequest,
  removeFriend,
  saveUserProfile,
  searchReaders,
  sendFriendRequest,
  cancelFriendRequest,
  checkUsernameAvailability,
  createGroup,
  getIncomingGroupInvites,
  getMyGroups,
  respondToGroupInvite,
  setReadingProgressVisibility,
  setReadingTimelineVisibility
} from "../services/storage.js";

import {
  PROFILE_AVATARS,
  getProfileAvatar
} from "../data/avatars.js";

import { getGroupAvatar } from "../data/groupAvatars.js";

import ReadersHere from "../components/ReadersHere.jsx";
import SEO from "../components/SEO.jsx";


const PROFILE_TABS = [
  {
    id: "timeline",
    label: "Timeline"
  },
  {
    id: "journal",
    label: "Journal"
  },
  {
    id: "margins",
    label: "Saved"
  },
  {
    id: "friends",
    label: "Friends"
  },
  {
    id: "groups",
    label: "Groups"
  }
];


function formatDate(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}


function ProgressBar({
  percent = 0
}) {
  const safePercent =
    Math.min(
      Math.max(
        Number(percent) || 0,
        0
      ),
      100
    );

  return (
    <div
      className="reading-progress-track"
      aria-label={`${safePercent}% complete`}
    >
      <div
        className="reading-progress-fill"
        style={{
          width:
            `${safePercent}%`
        }}
      />
    </div>
  );
}


export default function Profile() {
  const [
    searchParams,
    setSearchParams
  ] = useSearchParams();

  const requestedTab =
    searchParams.get("tab");

  const activeTab =
    PROFILE_TABS.some(
      (tab) =>
        tab.id === requestedTab
    )
      ? requestedTab
      : "timeline";

  const editingFromUrl =
    searchParams.get("edit") === "1";

  const [
    editingProfile,
    setEditingProfile
  ] = useState(
    editingFromUrl
  );

  const [
    user,
    setUser
  ] = useState(null);

  const [
    profile,
    setProfile
  ] = useState(null);

  const [
    readingTimeline,
    setReadingTimeline
  ] = useState([]);

  const [
    journalEntries,
    setJournalEntries
  ] = useState([]);

  const [
    savedBooks,
    setSavedBooks
  ] = useState([]);

  const [
    savedMargins,
    setSavedMargins
  ] = useState([]);

  const [
    displayName,
    setDisplayName
  ] = useState("");


  const [
    username,
    setUsername
  ] = useState("");

  const [
    usernameStatus,
    setUsernameStatus
  ] = useState("");

  const [
    checkingUsername,
    setCheckingUsername
  ] = useState(false);

  const [
    about,
    setAbout
  ] = useState("");

  const [
    selectedAvatar,
    setSelectedAvatar
  ] = useState("");

  const [
    showReadingPresence,
    setShowReadingPresence
  ] = useState(false);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    status,
    setStatus
  ] = useState("");


  const [
    statHelp,
    setStatHelp
  ] = useState(null);

  const [
    timelineFilter,
    setTimelineFilter
  ] = useState(
    searchParams.get("filter") ||
    "all"
  );

  const [
    timelinePublic,
    setTimelinePublic
  ] = useState(false);

  const [
    privacySaving,
    setPrivacySaving
  ] = useState(false);

  const [
    bookPrivacySaving,
    setBookPrivacySaving
  ] = useState(null);


  const [
    friends,
    setFriends
  ] = useState([]);

  const [
    incomingRequests,
    setIncomingRequests
  ] = useState([]);

  const [
    outgoingRequests,
    setOutgoingRequests
  ] = useState([]);

  const [
    readerSearch,
    setReaderSearch
  ] = useState("");

  const [
    readerResults,
    setReaderResults
  ] = useState([]);

  const [
    socialBusy,
    setSocialBusy
  ] = useState(false);

  const [
    socialLoading,
    setSocialLoading
  ] = useState(false);

  const [
    socialStatus,
    setSocialStatus
  ] = useState("");


  const [groups, setGroups] = useState([]);
  const [groupInvites, setGroupInvites] = useState([]);
  const [groupStatus, setGroupStatus] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupType, setGroupType] = useState("group");


  useEffect(() => {
    setEditingProfile(
      searchParams.get("edit") === "1"
    );
  }, [searchParams]);


  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (
          firebaseUser
        ) => {
          setUser(
            firebaseUser
          );

          if (
            !firebaseUser
          ) {
            setProfile(null);
            setReadingTimeline([]);
            setJournalEntries([]);
            setSavedBooks([]);
            setSavedMargins([]);
            setFriends([]);
            setIncomingRequests([]);
            setOutgoingRequests([]);
            setReaderResults([]);
            setSocialStatus("");
            setShowReadingPresence(false);
            setLoading(false);

            return;
          }

          try {
            setLoading(true);
            setStatus("");

            const [
              loadedProfile,
              timeline,
              journal,
              books,
              margins,
              timelineVisibility
            ] =
              await Promise.all([
                getUserProfile(),
                getReadingTimeline(),
                getJournal(),
                getSavedBooks(),
                getSavedMargins(),
                getReadingTimelineVisibility()
              ]);

            setProfile(
              loadedProfile
            );

            setDisplayName(
              loadedProfile
                ?.displayName ||
              ""
            );

            setUsername(
              loadedProfile
                ?.username ||
              ""
            );

            setAbout(
              loadedProfile
                ?.about ||
              ""
            );

            setSelectedAvatar(
              loadedProfile
                ?.avatar ||
              ""
            );

            setShowReadingPresence(
              loadedProfile
                ?.showReadingPresence ===
              true
            );

            setReadingTimeline(
              timeline
            );

            setJournalEntries(
              journal
            );

            setSavedBooks(
              books
            );

            setSavedMargins(
              margins
            );

            setTimelinePublic(
              timelineVisibility ===
              "public"
            );
          } catch (error) {
            console.error(
              "Could not load profile:",
              error
            );

            setStatus(
              "We couldn't load your profile."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return unsubscribe;
  }, []);


  /*
   * Friends are deliberately loaded separately from the core
   * reader profile. If a friendship query fails, the timeline,
   * journal, saved items, avatar, and profile still load.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    async function loadSocial() {
      try {
        setSocialLoading(true);
        setSocialStatus("");

        const [
          loadedFriends,
          loadedIncoming,
          loadedOutgoing
        ] =
          await Promise.all([
            getFriends(),
            getIncomingFriendRequests(),
            getOutgoingFriendRequests()
          ]);

        if (!active) {
          return;
        }

        setFriends(
          loadedFriends
        );

        setIncomingRequests(
          loadedIncoming
        );

        setOutgoingRequests(
          loadedOutgoing
        );
      } catch (error) {
        console.error(
          "Could not load Friends:",
          error
        );

        if (active) {
          setFriends([]);
          setIncomingRequests([]);
          setOutgoingRequests([]);

          setSocialStatus(
            `Friends load error: ${
              error?.code ||
              error?.message ||
              "unknown"
            }`
          );
        }
      } finally {
        if (active) {
          setSocialLoading(false);
        }
      }
    }

    loadSocial();

    return () => {
      active = false;
    };
  }, [
    user
  ]);


  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;

    async function loadGroups() {
      try {
        const [
          loadedGroups,
          loadedInvites
        ] = await Promise.all([
          getMyGroups(),
          getIncomingGroupInvites()
        ]);

        if (!active) {
          return;
        }

        setGroups(loadedGroups);
        setGroupInvites(loadedInvites);
      } catch (error) {
        console.error(
          "Could not load groups:",
          error
        );

        if (active) {
          setGroupStatus(
            error?.message ||
            error?.code ||
            "We couldn't load groups."
          );
        }
      }
    }

    loadGroups();

    return () => {
      active = false;
    };
  }, [user]);


  const journalCountsByBook =
    useMemo(() => {
      const counts =
        new Map();

      for (
        const entry
        of journalEntries
      ) {
        if (
          entry.bookId ===
            undefined ||
          entry.bookId ===
            null
        ) {
          continue;
        }

        const key =
          String(
            entry.bookId
          );

        counts.set(
          key,
          (
            counts.get(
              key
            ) ||
            0
          ) + 1
        );
      }

      return counts;
    }, [
      journalEntries
    ]);


  const activeAvatar =
    getProfileAvatar(
      profile?.avatar
    );


  const completedBooks =
    readingTimeline.filter(
      (item) =>
        Number(
          item.percentComplete
        ) >= 100
    ).length;


  const savedBookIds =
    useMemo(
      () =>
        new Set(
          savedBooks.map(
            (book) =>
              String(
                book.id ||
                book.bookId ||
                ""
              )
          )
        ),
      [
        savedBooks
      ]
    );


  const timelineByBookId =
    useMemo(
      () =>
        new Map(
          readingTimeline.map(
            (item) => [
              String(
                item.bookId ||
                item.id ||
                ""
              ),
              item
            ]
          )
        ),
      [
        readingTimeline
      ]
    );


  const savedTimelineItems =
    useMemo(
      () =>
        savedBooks.map(
          (book) => {
            const bookId =
              String(
                book.id ||
                book.bookId ||
                ""
              );

            const timelineItem =
              timelineByBookId.get(
                bookId
              );

            if (
              timelineItem
            ) {
              return {
                ...book,
                ...timelineItem,
                bookId,
                isSaved:
                  true
              };
            }

            return {
              ...book,
              bookId,
              percentComplete:
                0,
              savedOnly:
                true,
              isSaved:
                true
            };
          }
        ),
      [
        savedBooks,
        timelineByBookId
      ]
    );


  const filteredTimeline =
    useMemo(
      () => {
        switch (
          timelineFilter
        ) {
          case "reading":
            return readingTimeline.filter(
              (item) =>
                Number(
                  item.percentComplete
                ) < 100
            );

          case "completed":
            return readingTimeline.filter(
              (item) =>
                Number(
                  item.percentComplete
                ) >= 100
            );

          case "saved":
            return savedTimelineItems;

          default:
            return readingTimeline;
        }
      },
      [
        timelineFilter,
        readingTimeline,
        savedTimelineItems
      ]
    );


  function changeTab(
    tabId,
    filterId = null
  ) {
    setEditingProfile(false);
    setStatus("");
    setStatHelp(null);

    if (
      tabId === "timeline"
    ) {
      const nextFilter =
        filterId ||
        timelineFilter ||
        "all";

      setTimelineFilter(
        nextFilter
      );

      setSearchParams({
        tab: "timeline",
        filter:
          nextFilter
      });

      return;
    }

    setSearchParams({
      tab:
        tabId
    });
  }


  function changeTimelineFilter(
    filterId
  ) {
    setTimelineFilter(
      filterId
    );

    setSearchParams({
      tab: "timeline",
      filter:
        filterId
    });
  }


  async function handleTimelineVisibility() {
    const nextVisibility =
      timelinePublic
        ? "private"
        : "public";

    try {
      setPrivacySaving(true);
      setStatus("");

      await setReadingTimelineVisibility(
        nextVisibility
      );

      setTimelinePublic(
        nextVisibility ===
        "public"
      );

      setStatus(
        nextVisibility ===
          "public"
          ? "Reading timeline is public."
          : "Reading timeline is private."
      );
    } catch (error) {
      console.error(
        "Could not update timeline visibility:",
        error
      );

      setStatus(
        "We couldn't update timeline visibility."
      );
    } finally {
      setPrivacySaving(false);
    }
  }


  async function handleBookVisibility(
    item
  ) {
    const bookId =
      String(
        item.bookId ||
        item.id ||
        ""
      );

    if (
      !bookId ||
      item.savedOnly
    ) {
      return;
    }

    const currentVisibility =
      item.visibility ===
      "public"
        ? "public"
        : "private";

    const nextVisibility =
      currentVisibility ===
      "public"
        ? "private"
        : "public";

    try {
      setBookPrivacySaving(
        bookId
      );

      setStatus("");

      await setReadingProgressVisibility(
        bookId,
        nextVisibility
      );

      setReadingTimeline(
        (current) =>
          current.map(
            (record) =>
              String(
                record.bookId ||
                record.id ||
                ""
              ) ===
              bookId
                ? {
                    ...record,
                    visibility:
                      nextVisibility
                  }
                : record
          )
      );
    } catch (error) {
      console.error(
        "Could not update book visibility:",
        error
      );

      setStatus(
        "We couldn't update that book's visibility."
      );
    } finally {
      setBookPrivacySaving(
        null
      );
    }
  }


  async function refreshSocial() {
    try {
      setSocialLoading(true);
      setSocialStatus("");

      const [
        loadedFriends,
        loadedIncoming,
        loadedOutgoing
      ] =
        await Promise.all([
          getFriends(),
          getIncomingFriendRequests(),
          getOutgoingFriendRequests()
        ]);

      setFriends(
        loadedFriends
      );

      setIncomingRequests(
        loadedIncoming
      );

      setOutgoingRequests(
        loadedOutgoing
      );
    } catch (error) {
      console.error(
        "Could not refresh Friends:",
        error
      );

      setSocialStatus(
        "We couldn't refresh Friends. Please try again."
      );

      throw error;
    } finally {
      setSocialLoading(false);
    }
  }


  async function handleReaderSearch(
    event
  ) {
    event?.preventDefault();

    try {
      setSocialBusy(true);
      setSocialStatus("");

      const results =
        await searchReaders(
          readerSearch
        );

      setReaderResults(
        results
      );
    } catch (error) {
      console.error(
        "Could not search readers:",
        error
      );

      setSocialStatus(
        "We couldn't search readers."
      );
    } finally {
      setSocialBusy(false);
    }
  }


  async function handleSocialAction(
    otherUserId,
    action
  ) {
    try {
      setSocialBusy(true);
      setSocialStatus("");

      if (action === "send") {
        await sendFriendRequest(
          otherUserId
        );
      } else if (action === "cancel") {
        await cancelFriendRequest(
          otherUserId
        );
      } else if (action === "accept") {
        await respondToFriendRequest(
          otherUserId,
          true
        );
      } else if (action === "decline") {
        await respondToFriendRequest(
          otherUserId,
          false
        );
      } else if (action === "remove") {
        await removeFriend(
          otherUserId
        );
      }

      await refreshSocial();

      if (readerSearch.trim()) {
        setReaderResults(
          await searchReaders(
            readerSearch
          )
        );
      }
    } catch (error) {
      console.error(
        "Friend action failed:",
        error
      );

      setSocialStatus(
        `Friend error: ${
          error?.code ||
          error?.message ||
          "unknown"
        }`
      );
    } finally {
      setSocialBusy(false);
    }
  }



  async function refreshGroups() {
    const [
      loadedGroups,
      loadedInvites
    ] = await Promise.all([
      getMyGroups(),
      getIncomingGroupInvites()
    ]);

    setGroups(loadedGroups);
    setGroupInvites(loadedInvites);
  }


  async function handleCreateGroup(event) {
    event.preventDefault();

    try {
      setCreatingGroup(true);
      setGroupStatus("");

      await createGroup({
        name: groupName,
        description: groupDescription,
        type: groupType
      });

      setGroupName("");
      setGroupDescription("");
      setGroupType("group");

      await refreshGroups();

      setGroupStatus(
        "Group created."
      );
    } catch (error) {
      console.error(
        "Could not create group:",
        error
      );

      setGroupStatus(
        error?.message ||
        "We couldn't create that group."
      );
    } finally {
      setCreatingGroup(false);
    }
  }


  async function handleGroupInvite(
    groupId,
    accept
  ) {
    try {
      setGroupStatus("");

      await respondToGroupInvite(
        groupId,
        accept
      );

      await refreshGroups();

      setGroupStatus(
        accept
          ? "Group invitation accepted."
          : "Group invitation declined."
      );
    } catch (error) {
      console.error(
        "Could not update group invitation:",
        error
      );

      setGroupStatus(
        error?.message ||
        "We couldn't update that invitation."
      );
    }
  }


  function openEditProfile() {
    setEditingProfile(
      true
    );

    setSearchParams({
      tab: "timeline",
      edit: "1"
    });
  }


  function closeEditProfile() {
    setEditingProfile(
      false
    );

    setSearchParams({
      tab: "timeline"
    });

    setStatus("");

    setDisplayName(
      profile
        ?.displayName ||
      ""
    );

    setAbout(
      profile
        ?.about ||
      ""
    );

    setSelectedAvatar(
      profile
        ?.avatar ||
      ""
    );

    setShowReadingPresence(
      profile
        ?.showReadingPresence ===
      true
    );
  }


  async function handleUsernameCheck() {
    const clean =
      username
        .trim()
        .replace(
          /^@+/,
          ""
        )
        .toLowerCase();

    if (!clean) {
      setUsernameStatus(
        profile?.username
          ? ""
          : "Choose a unique username when you're ready."
      );

      return;
    }

    try {
      setCheckingUsername(
        true
      );

      const result =
        await checkUsernameAvailability(
          clean
        );

      setUsername(
        result.username
      );

      setUsernameStatus(
        result.available
          ? `@${result.username} is available.`
          : result.reason
      );
    } catch (error) {
      console.error(
        "Could not check username:",
        error
      );

      setUsernameStatus(
        "We couldn't check that username."
      );
    } finally {
      setCheckingUsername(
        false
      );
    }
  }


  async function handleSaveProfile(
    event
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setStatus("");

      const saved =
        await saveUserProfile({
          displayName,
          username,
          about,
          avatar:
            selectedAvatar,
          showReadingPresence
        });

      setProfile(
        saved
      );

      setStatus(
        "Profile saved."
      );

      setEditingProfile(
        false
      );

      setSearchParams({
        tab: "timeline"
      });
    } catch (error) {
      console.error(
        "Could not save profile:",
        error
      );

      setStatus(
        error?.code ===
        "username-taken"
          ? "That username is already taken."
          : error?.code ===
            "invalid-username"
            ? error.message
            : "We couldn't save your profile."
      );
    } finally {
      setSaving(false);
    }
  }


  if (loading) {
    return (
      <main className="page-wrap">
        <SEO
          title="Profile | Random Reads"
          description="Your Random Reads profile."
          path="/read/profile"
          noindex
        />

        <section className="hero-card small">
          <p className="eyebrow">
            Reader Profile
          </p>

          <h1>
            Loading profile...
          </h1>
        </section>
      </main>
    );
  }


  if (!user) {
    return (
      <main className="page-wrap">
        <SEO
          title="Profile | Random Reads"
          description="Your Random Reads profile."
          path="/read/profile"
          noindex
        />

        <section className="hero-card small">
          <p className="eyebrow">
            Reader Profile
          </p>

          <h1>
            Log in to view your profile.
          </h1>

          <p>
            Your reading timeline,
            profile, journal, saved books,
            and saved Margins are connected
            to your Random Reads account.
          </p>

          <Link
            to="/read/login"
            className="button primary large"
          >
            Log In
          </Link>
        </section>
      </main>
    );
  }


  return (
    <main className="page-wrap">
      <SEO
        title="Profile | Random Reads"
        description="Your Random Reads reading profile."
        path="/read/profile"
        noindex
      />

      <div className="stack-lg">

        <section
          className="profile-header-card"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(92px, 0.65fr) minmax(0, 1.55fr)",
            gap: "1.25rem",
            alignItems: "start"
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.6rem",
              minWidth: 0
            }}
          >
            <div className="profile-avatar">
              {activeAvatar ? (
                <img
                  src={
                    activeAvatar.image
                  }
                  alt={`${profile?.displayName || "Reader"} avatar`}
                />
              ) : profile?.photoURL ? (
                <img
                  src={
                    profile.photoURL
                  }
                  alt=""
                />
              ) : (
                <User
                  size={42}
                />
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.45rem",
                flexWrap: "wrap",
                justifyContent: "center"
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setStatHelp(
                    statHelp ===
                    "timeline"
                      ? null
                      : "timeline"
                  )
                }
                aria-label={`${readingTimeline.length} books in reading timeline`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.38rem",
                  minWidth: "58px",
                  justifyContent: "center",
                  padding: "0.48rem 0.6rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                <BookOpen
                  size={17}
                />
                <strong>
                  {readingTimeline.length}
                </strong>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatHelp(
                    statHelp ===
                    "completed"
                      ? null
                      : "completed"
                  )
                }
                aria-label={`${completedBooks} books completed`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.38rem",
                  minWidth: "58px",
                  justifyContent: "center",
                  padding: "0.48rem 0.6rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                <Book
                  size={17}
                />
                <strong>
                  {completedBooks}
                </strong>
              </button>

              <button
                type="button"
                onClick={() =>
                  setStatHelp(
                    statHelp ===
                    "journal"
                      ? null
                      : "journal"
                  )
                }
                aria-label={`${journalEntries.length} journal entries`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.38rem",
                  minWidth: "58px",
                  justifyContent: "center",
                  padding: "0.48rem 0.6rem",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  background: "#fff",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                <NotebookPen
                  size={17}
                />
                <strong>
                  {journalEntries.length}
                </strong>
              </button>
            </div>

            {statHelp ===
              "timeline" && (
              <button
                type="button"
                className="button secondary"
                style={{
                  width: "100%",
                  whiteSpace: "normal",
                  textAlign: "center"
                }}
                onClick={() =>
                  changeTab(
                    "timeline",
                    "all"
                  )
                }
              >
                {readingTimeline.length} books
                in your reading timeline
              </button>
            )}

            {statHelp ===
              "completed" && (
              <button
                type="button"
                className="button secondary"
                style={{
                  width: "100%",
                  whiteSpace: "normal",
                  textAlign: "center"
                }}
                onClick={() =>
                  changeTab(
                    "timeline",
                    "completed"
                  )
                }
              >
                {completedBooks} completed
                books
              </button>
            )}

            {statHelp ===
              "journal" && (
              <button
                type="button"
                className="button secondary"
                style={{
                  width: "100%",
                  whiteSpace: "normal",
                  textAlign: "center"
                }}
                onClick={() =>
                  changeTab(
                    "journal"
                  )
                }
              >
                {journalEntries.length}
                journal entries
              </button>
            )}
          </div>

          <div
            className="profile-header-content"
            style={{
              minWidth: 0,
              paddingTop: "0.1rem"
            }}
          >
            <p className="eyebrow">
              Reader Profile
            </p>

            <h1 className="profile-title">
              {profile?.displayName ||
                "Reader"}
            </h1>

            {profile?.username ? (
              <p
                className="muted"
                style={{
                  marginTop: "0.2rem",
                  marginBottom: "0"
                }}
              >
                @{profile.username}
              </p>
            ) : (
              <button
                type="button"
                className="button secondary"
                style={{
                  marginTop: "0.35rem",
                  padding: "0.35rem 0.65rem"
                }}
                onClick={
                  openEditProfile
                }
              >
                Claim your @username
              </button>
            )}

            <button
              type="button"
              className="button secondary profile-edit-button"
              onClick={
                openEditProfile
              }
              style={{
                marginTop: "0.45rem"
              }}
            >
              <Pencil
                size={16}
              />
              Edit Profile
            </button>

            {profile?.about && (
              <p
                className="muted"
                style={{
                  marginTop: "1rem"
                }}
              >
                {profile.about}
              </p>
            )}
          </div>
        </section>

        <nav
          aria-label="Profile sections"
          style={{
            display: "flex",
            gap: "0.45rem",
            overflowX: "auto",
            padding: "0.4rem",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: "999px",
            WebkitOverflowScrolling:
              "touch"
          }}
        >
          {PROFILE_TABS.map(
            (tab) => {
              const selected =
                activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={
                    selected
                      ? "margins-filter active"
                      : "margins-filter"
                  }
                  style={{
                    flex: "0 0 auto",
                    whiteSpace: "nowrap"
                  }}
                  onClick={() =>
                    changeTab(
                      tab.id
                    )
                  }
                  aria-current={
                    selected
                      ? "page"
                      : undefined
                  }
                >
                  {tab.id === "friends" &&
                  incomingRequests.length > 0
                    ? `${tab.label} (${incomingRequests.length})`
                    : tab.id === "groups" &&
                      groupInvites.length > 0
                      ? `${tab.label} (${groupInvites.length})`
                      : tab.label}
                </button>
              );
            }
          )}
        </nav>


        {status && (
          <p className="status">
            {status}
          </p>
        )}


        {editingProfile && (
              <section className="panel profile-panel">
                <div className="section-heading-row">
                  <div>
                    <p className="eyebrow">
                      Account
                    </p>

                    <h2>
                      Edit Profile
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="button secondary"
                    onClick={
                      closeEditProfile
                    }
                  >
                    <X
                      size={16}
                    />

                    Cancel
                  </button>
                </div>


                <form
                  className="profile-form"
                  onSubmit={
                    handleSaveProfile
                  }
                >
                  <label>
                    Username

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem"
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          fontWeight: 700
                        }}
                      >
                        @
                      </span>

                      <input
                        type="text"
                        value={
                          username
                        }
                        onChange={(
                          event
                        ) => {
                          setUsername(
                            event.target.value
                              .replace(
                                /^@+/,
                                ""
                              )
                              .toLowerCase()
                          );

                          setUsernameStatus(
                            ""
                          );
                        }}
                        onBlur={
                          handleUsernameCheck
                        }
                        placeholder="your_username"
                        minLength={3}
                        maxLength={24}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>

                    <small className="muted">
                      Unique. 3–24 characters.
                      Letters, numbers, and underscores only.
                    </small>

                    {checkingUsername && (
                      <small className="muted">
                        Checking availability...
                      </small>
                    )}

                    {usernameStatus && (
                      <small className="status">
                        {usernameStatus}
                      </small>
                    )}
                  </label>


                  <label>
                    Display name

                    <input
                      type="text"
                      value={
                        displayName
                      }
                      onChange={(
                        event
                      ) =>
                        setDisplayName(
                          event.target.value
                        )
                      }
                      maxLength={80}
                    />
                  </label>


                  <div className="profile-avatar-picker">
                    <div>
                      <p className="profile-field-label">
                        Choose your avatar
                      </p>

                      <p className="muted">
                        Select a classic author
                        or literary character.
                      </p>
                    </div>

                    <div className="profile-avatar-grid">
                      {PROFILE_AVATARS.map(
                        (
                          avatar
                        ) => {
                          const selected =
                            selectedAvatar ===
                            avatar.id;

                          return (
                            <button
                              key={
                                avatar.id
                              }
                              type="button"
                              className={
                                selected
                                  ? "profile-avatar-option selected"
                                  : "profile-avatar-option"
                              }
                              onClick={() =>
                                setSelectedAvatar(
                                  avatar.id
                                )
                              }
                              aria-pressed={
                                selected
                              }
                              aria-label={`Choose ${avatar.name}`}
                            >
                              <img
                                src={
                                  avatar.image
                                }
                                alt=""
                              />

                              <span>
                                {avatar.name}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>


                  <label>
                    About me

                    <textarea
                      value={
                        about
                      }
                      onChange={(
                        event
                      ) =>
                        setAbout(
                          event.target.value
                        )
                      }
                      maxLength={500}
                      rows={6}
                      placeholder="Tell other readers a little about yourself..."
                    />
                  </label>


                  <small className="muted">
                    {about.length}/500
                  </small>


                  <div className="profile-presence-setting">
                    <label className="profile-presence-toggle">
                      <input
                        type="checkbox"
                        checked={
                          showReadingPresence
                        }
                        onChange={(
                          event
                        ) =>
                          setShowReadingPresence(
                            event.target.checked
                          )
                        }
                      />

                      <span>
                        Show when I'm reading
                      </span>
                    </label>

                    <p className="muted">
                      When enabled, other signed-in
                      readers may see your avatar on
                      books you're actively reading.
                    </p>
                  </div>


                  <div className="button-row">
                    <button
                      type="submit"
                      className="button primary"
                      disabled={
                        saving
                      }
                    >
                      {saving
                        ? "Saving..."
                        : "Save Profile"}
                    </button>
                  </div>
                </form>
              </section>
        )}

        {activeTab === "timeline" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Reading History
                </p>

                <h2>
                  Reading Timeline
                </h2>
              </div>

              <button
                type="button"
                className={
                  timelinePublic
                    ? "button primary"
                    : "button secondary"
                }
                onClick={
                  handleTimelineVisibility
                }
                disabled={
                  privacySaving
                }
                title={
                  timelinePublic
                    ? "Your timeline can be shared. Individual private books stay hidden."
                    : "Your entire timeline is private."
                }
              >
                {timelinePublic ? (
                  <Globe2
                    size={16}
                  />
                ) : (
                  <Lock
                    size={16}
                  />
                )}

                {privacySaving
                  ? "Saving..."
                  : timelinePublic
                    ? "Timeline Public"
                    : "Timeline Private"}
              </button>
            </div>

            <p className="muted">
              The timeline setting controls
              the entire reading history.
              Individual books can still be
              kept private.
            </p>

            <div
              style={{
                display: "flex",
                gap: "0.45rem",
                overflowX: "auto",
                paddingBottom: "0.35rem",
                margin: "1rem 0"
              }}
            >
              {[
                [
                  "all",
                  "All",
                  readingTimeline.length
                ],
                [
                  "reading",
                  "Reading",
                  readingTimeline.filter(
                    (item) =>
                      Number(
                        item.percentComplete
                      ) < 100
                  ).length
                ],
                [
                  "completed",
                  "Completed",
                  completedBooks
                ],
                [
                  "saved",
                  "Saved",
                  savedBooks.length
                ]
              ].map(
                ([
                  filterId,
                  label,
                  count
                ]) => (
                  <button
                    key={
                      filterId
                    }
                    type="button"
                    className={
                      timelineFilter ===
                      filterId
                        ? "margins-filter active"
                        : "margins-filter"
                    }
                    style={{
                      flex:
                        "0 0 auto",
                      whiteSpace:
                        "nowrap"
                    }}
                    onClick={() =>
                      changeTimelineFilter(
                        filterId
                      )
                    }
                  >
                    {label} ({count})
                  </button>
                )
              )}
            </div>

            {filteredTimeline.length ===
            0 ? (
              <p className="muted">
                {timelineFilter ===
                "saved"
                  ? "Books you save will appear here."
                  : timelineFilter ===
                    "completed"
                    ? "Completed books will appear here."
                    : "Your reading activity will appear here."}
              </p>
            ) : (
              <div className="reading-timeline">
                {filteredTimeline.map(
                  (
                    item,
                    index
                  ) => {
                    const percent =
                      Math.min(
                        Math.max(
                          Number(
                            item.percentComplete
                          ) || 0,
                          0
                        ),
                        100
                      );

                    const bookId =
                      String(
                        item.bookId ||
                        item.id ||
                        ""
                      );

                    const noteCount =
                      journalCountsByBook.get(
                        bookId
                      ) || 0;

                    const isSaved =
                      item.isSaved ===
                        true ||
                      savedBookIds.has(
                        bookId
                      );

                    const visibility =
                      item.visibility ===
                      "public"
                        ? "public"
                        : "private";

                    return (
                      <article
                        key={`reading-${bookId || index}`}
                        className="timeline-book"
                      >
                        <Link
                          to={`/read/reader/${bookId}`}
                          className="timeline-cover"
                        >
                          {item.image ||
                          item.cover ? (
                            <img
                              src={
                                item.image ||
                                item.cover
                              }
                              alt={`Cover of ${
                                item.title ||
                                "book"
                              }`}
                            />
                          ) : (
                            <div className="timeline-cover-placeholder">
                              <BookOpen
                                size={24}
                              />
                            </div>
                          )}
                        </Link>

                        <div className="timeline-book-content">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.75rem",
                              flexWrap: "wrap"
                            }}
                          >
                            <p className="timeline-event-label">
                              {item.savedOnly
                                ? "Saved Book"
                                : percent >=
                                  100
                                  ? "Finished Reading"
                                  : "Reading"}
                            </p>

                            {!item.savedOnly && (
                              <button
                                type="button"
                                className={
                                  visibility ===
                                  "public"
                                    ? "button primary"
                                    : "button secondary"
                                }
                                style={{
                                  padding:
                                    "0.35rem 0.55rem"
                                }}
                                onClick={() =>
                                  handleBookVisibility(
                                    item
                                  )
                                }
                                disabled={
                                  bookPrivacySaving ===
                                  bookId
                                }
                                title={
                                  visibility ===
                                  "public"
                                    ? "This book may appear on your public timeline when the timeline is public."
                                    : "This book is private."
                                }
                              >
                                {visibility ===
                                "public" ? (
                                  <Globe2
                                    size={14}
                                  />
                                ) : (
                                  <Lock
                                    size={14}
                                  />
                                )}

                                {bookPrivacySaving ===
                                bookId
                                  ? "Saving..."
                                  : visibility ===
                                    "public"
                                    ? "Public"
                                    : "Private"}
                              </button>
                            )}
                          </div>

                          <Link
                            to={`/read/reader/${bookId}`}
                            className="timeline-book-title"
                          >
                            {item.title ||
                              "Untitled"}
                          </Link>

                          <p className="timeline-author">
                            {item.author ||
                              "Unknown author"}
                          </p>

                          {isSaved && (
                            <small className="muted">
                              Saved to your library
                            </small>
                          )}

                          {!item.savedOnly && (
                            <>
                              <ReadersHere
                                bookId={
                                  bookId
                                }
                              />

                              <div className="timeline-progress-row">
                                <ProgressBar
                                  percent={
                                    percent
                                  }
                                />

                                <strong>
                                  {percent}%
                                </strong>
                              </div>

                              <small className="muted">
                                {percent >=
                                100
                                  ? "Completed"
                                  : "Last read"}

                                {item.updatedAtISO
                                  ? ` · ${formatDate(
                                      item.updatedAtISO
                                    )}`
                                  : ""}
                              </small>
                            </>
                          )}

                          {noteCount > 0 && (
                            <div className="timeline-journal-link-row">
                              <button
                                type="button"
                                className="timeline-journal-link"
                                onClick={() =>
                                  changeTab(
                                    "journal"
                                  )
                                }
                              >
                                <NotebookPen
                                  size={16}
                                />

                                Journal entries{" "}
                                ({noteCount})
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === "journal" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Your Notes
                </p>

                <h2>
                  Journal
                </h2>
              </div>

              <Link
                to="/read/journal"
                className="button secondary"
              >
                <NotebookPen
                  size={16}
                />

                Open Full Journal
              </Link>
            </div>


            {journalEntries.length ===
            0 ? (
              <p className="muted">
                Your journal entries
                will appear here.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {journalEntries.map(
                  (
                    entry,
                    index
                  ) => {
                    const bookId =
                      String(
                        entry.bookId ||
                        ""
                      );

                    return (
                      <article
                        key={
                          entry.id ||
                          `journal-${index}`
                        }
                        className="public-profile-entry"
                      >
                        <div className="public-entry-heading">
                          <div>
                            <p className="eyebrow">
                              Journal Entry
                            </p>

                            {bookId ? (
                              <Link
                                to={`/read/reader/${bookId}`}
                                className="public-entry-book-title"
                              >
                                {entry.title ||
                                  "Untitled"}
                              </Link>
                            ) : (
                              <strong className="public-entry-book-title">
                                {entry.title ||
                                  "Untitled"}
                              </strong>
                            )}

                            {entry.author && (
                              <p className="public-entry-author">
                                {entry.author}
                              </p>
                            )}
                          </div>
                        </div>


                        <div className="public-entry-meta">
                          {entry.paragraphNumber && (
                            <span>
                              Paragraph{" "}
                              {entry.paragraphNumber}
                            </span>
                          )}

                          {(entry.updatedAtISO ||
                            entry.createdAt) && (
                            <span>
                              {formatDate(
                                entry.updatedAtISO ||
                                  entry.createdAt
                              )}
                            </span>
                          )}

                          <span>
                            {entry.visibility ||
                              "private"}
                          </span>
                        </div>


                        {entry.paragraphPreview && (
                          <div className="public-entry-quote">
                            <p>
                              “{entry.paragraphPreview}”
                            </p>
                          </div>
                        )}


                        <p className="public-journal-note">
                          {entry.note}
                        </p>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}





        {activeTab === "friends" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Reader Community
                </p>

                <h2>
                  Friends
                </h2>
              </div>

              {socialLoading && (
                <span className="muted">
                  Loading...
                </span>
              )}
            </div>

            {socialStatus && (
              <p className="status">
                {socialStatus}
              </p>
            )}

            <form
              onSubmit={
                handleReaderSearch
              }
              style={{
                display: "flex",
                gap: "0.6rem",
                marginBottom: "1.25rem"
              }}
            >
              <input
                type="search"
                value={
                  readerSearch
                }
                onChange={(event) =>
                  setReaderSearch(
                    event.target.value
                  )
                }
                placeholder="Find readers by display name"
                style={{
                  flex: "1 1 auto"
                }}
              />

              <button
                type="submit"
                className="button primary"
                disabled={
                  socialBusy ||
                  readerSearch.trim().length < 2
                }
              >
                <Search
                  size={16}
                />
                Search
              </button>
            </form>

            {readerResults.length > 0 && (
              <>
                <h3>
                  Search Results
                </h3>

                <div className="public-profile-entry-list">
                  {readerResults.map(
                    (result) => {
                      const friend =
                        friends.find(
                          (item) =>
                            String(
                              item.otherUserId
                            ) ===
                            String(
                              result.id
                            )
                        );

                      const incoming =
                        incomingRequests.find(
                          (item) =>
                            String(
                              item.otherUserId
                            ) ===
                            String(
                              result.id
                            )
                        );

                      const outgoing =
                        outgoingRequests.find(
                          (item) =>
                            String(
                              item.otherUserId
                            ) ===
                            String(
                              result.id
                            )
                        );

                      return (
                        <article
                          key={
                            result.id
                          }
                          className="public-profile-entry"
                        >
                          <div className="section-heading-row">
                            <div>
                              <Link
                                to={`/read/public/${result.id}`}
                                className="public-entry-book-title"
                              >
                                {result.displayName ||
                                  "Reader"}
                              </Link>

                              {result.username && (
                                <p className="muted">
                                  @{result.username}
                                </p>
                              )}

                              {result.about && (
                                <p className="muted">
                                  {result.about}
                                </p>
                              )}
                            </div>

                            {!friend &&
                              !incoming &&
                              !outgoing && (
                              <button
                                type="button"
                                className="button secondary"
                                disabled={
                                  socialBusy
                                }
                                onClick={() =>
                                  handleSocialAction(
                                    result.id,
                                    "send"
                                  )
                                }
                              >
                                <UserPlus
                                  size={16}
                                />
                                Add Friend
                              </button>
                            )}

                            {friend && (
                              <span className="button secondary">
                                <UserCheck
                                  size={16}
                                />
                                Friends
                              </span>
                            )}

                            {outgoing && (
                              <button
                                type="button"
                                className="button secondary"
                                disabled={
                                  socialBusy
                                }
                                onClick={() =>
                                  handleSocialAction(
                                    result.id,
                                    "cancel"
                                  )
                                }
                              >
                                Request Sent
                              </button>
                            )}

                            {incoming && (
                              <button
                                type="button"
                                className="button primary"
                                disabled={
                                  socialBusy
                                }
                                onClick={() =>
                                  handleSocialAction(
                                    result.id,
                                    "accept"
                                  )
                                }
                              >
                                <UserCheck
                                  size={16}
                                />
                                Accept
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    }
                  )}
                </div>
              </>
            )}

            {incomingRequests.length > 0 && (
              <>
                <h3>
                  Friend Requests
                </h3>

                <div className="public-profile-entry-list">
                  {incomingRequests.map(
                    (request) => (
                      <article
                        key={
                          request.id
                        }
                        className="public-profile-entry"
                      >
                        <Link
                          to={`/read/public/${request.otherUserId}`}
                          className="public-entry-book-title"
                        >
                          {request.profile?.displayName ||
                            "Reader"}
                        </Link>

                        {request.profile?.username && (
                          <p className="muted">
                            @{request.profile.username}
                          </p>
                        )}

                        <div className="button-row">
                          <button
                            type="button"
                            className="button primary"
                            disabled={
                              socialBusy
                            }
                            onClick={() =>
                              handleSocialAction(
                                request.otherUserId,
                                "accept"
                              )
                            }
                          >
                            <UserCheck
                              size={16}
                            />
                            Accept
                          </button>

                          <button
                            type="button"
                            className="button secondary"
                            disabled={
                              socialBusy
                            }
                            onClick={() =>
                              handleSocialAction(
                                request.otherUserId,
                                "decline"
                              )
                            }
                          >
                            Decline
                          </button>
                        </div>
                      </article>
                    )
                  )}
                </div>
              </>
            )}

            {outgoingRequests.length > 0 && (
              <>
                <h3>
                  Sent Requests
                </h3>

                <div className="public-profile-entry-list">
                  {outgoingRequests.map(
                    (request) => (
                      <article
                        key={
                          request.id
                        }
                        className="public-profile-entry"
                      >
                        <Link
                          to={`/read/public/${request.otherUserId}`}
                          className="public-entry-book-title"
                        >
                          {request.profile?.displayName ||
                            "Reader"}
                        </Link>

                        {request.profile?.username && (
                          <p className="muted">
                            @{request.profile.username}
                          </p>
                        )}

                        <button
                          type="button"
                          className="button secondary"
                          disabled={
                            socialBusy
                          }
                          onClick={() =>
                            handleSocialAction(
                              request.otherUserId,
                              "cancel"
                            )
                          }
                        >
                          Cancel Request
                        </button>
                      </article>
                    )
                  )}
                </div>
              </>
            )}

            <h3>
              Your Friends
            </h3>

            {friends.length === 0 ? (
              <p className="muted">
                You haven't added any friends yet.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {friends.map(
                  (friend) => (
                    <article
                      key={
                        friend.id
                      }
                      className="public-profile-entry"
                    >
                      <Link
                        to={`/read/public/${friend.otherUserId}`}
                        className="public-entry-book-title"
                      >
                        {friend.profile?.displayName ||
                          "Reader"}
                      </Link>

                      {friend.profile?.username && (
                        <p className="muted">
                          @{friend.profile.username}
                        </p>
                      )}

                      {friend.profile?.about && (
                        <p className="muted">
                          {friend.profile.about}
                        </p>
                      )}

                      <button
                        type="button"
                        className="button secondary"
                        disabled={
                          socialBusy
                        }
                        onClick={() =>
                          handleSocialAction(
                            friend.otherUserId,
                            "remove"
                          )
                        }
                      >
                        <UserMinus
                          size={16}
                        />
                        Remove Friend
                      </button>
                    </article>
                  )
                )}
              </div>
            )}
          </section>
        )}



        {activeTab === "groups" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Reading Communities
                </p>

                <h2>
                  Groups & Classes
                </h2>
              </div>

              <Link
                to="/read/groups"
                className="button secondary"
              >
                <Search size={16} />
                Discover Groups
              </Link>
            </div>

            {groupStatus && (
              <p className="status">
                {groupStatus}
              </p>
            )}

            {groupInvites.length > 0 && (
              <>
                <h3>
                  Invitations
                </h3>

                <div className="public-profile-entry-list">
                  {groupInvites.map(
                    (invite) => (
                      <article
                        key={`${invite.groupId}-${invite.userId}`}
                        className="public-profile-entry"
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "0.8rem",
                            alignItems: "center"
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: "50%",
                              overflow: "hidden",
                              background: "#eef4f3",
                              display: "grid",
                              placeItems: "center",
                              flex: "0 0 auto"
                            }}
                          >
                            {getGroupAvatar(invite.group?.avatar) ? (
                              <img
                                src={getGroupAvatar(invite.group?.avatar).image}
                                alt=""
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover"
                                }}
                              />
                            ) : (
                              <Users size={24} />
                            )}
                          </div>

                          <div>
                            <strong className="public-entry-book-title">
                              {invite.group?.name || "Group"}
                            </strong>

                            <p className="muted">
                              {invite.group?.type === "class"
                                ? "Class"
                                : "Group"}

                              {invite.inviterProfile?.displayName
                                ? ` · Invited by ${invite.inviterProfile.displayName}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <div className="button-row">
                          <button
                            type="button"
                            className="button primary"
                            onClick={() =>
                              handleGroupInvite(
                                invite.groupId,
                                true
                              )
                            }
                          >
                            Accept
                          </button>

                          <button
                            type="button"
                            className="button secondary"
                            onClick={() =>
                              handleGroupInvite(
                                invite.groupId,
                                false
                              )
                            }
                          >
                            Decline
                          </button>
                        </div>
                      </article>
                    )
                  )}
                </div>
              </>
            )}

            <h3>
              Your Groups
            </h3>

            {groups.length === 0 ? (
              <p className="muted">
                You haven't joined any groups yet.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {groups.map((group) => (
                  <article
                    key={group.id}
                    className="public-profile-entry"
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.9rem",
                        alignItems: "center"
                      }}
                    >
                      <div
                        style={{
                          width: 62,
                          height: 62,
                          borderRadius: "50%",
                          overflow: "hidden",
                          background: "#eef4f3",
                          display: "grid",
                          placeItems: "center",
                          flex: "0 0 auto"
                        }}
                      >
                        {getGroupAvatar(group.avatar) ? (
                          <img
                            src={getGroupAvatar(group.avatar).image}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover"
                            }}
                          />
                        ) : (
                          <Users size={27} />
                        )}
                      </div>

                      <div>
                        <Link
                          to={`/read/groups/${group.id}`}
                          className="public-entry-book-title"
                        >
                          {group.name}
                        </Link>

                        <p className="muted">
                          {group.type === "class"
                            ? "Class"
                            : "Group"}

                          {group.membership?.role
                            ? ` · ${group.membership.role}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {group.description && (
                      <p>
                        {group.description}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1.25rem",
                borderTop:
                  "1px solid var(--line)"
              }}
            >
              <h3>
                Create a Group
              </h3>

              <form
                onSubmit={handleCreateGroup}
                className="profile-edit-form"
              >
                <label>
                  Type

                  <select
                    value={groupType}
                    onChange={(event) =>
                      setGroupType(
                        event.target.value
                      )
                    }
                  >
                    <option value="group">
                      Group
                    </option>

                    <option value="class">
                      Class
                    </option>
                  </select>
                </label>

                <label>
                  Name

                  <input
                    type="text"
                    value={groupName}
                    onChange={(event) =>
                      setGroupName(
                        event.target.value
                      )
                    }
                    maxLength={80}
                    placeholder="Classic Literature Club"
                  />
                </label>

                <label>
                  Description

                  <textarea
                    value={groupDescription}
                    onChange={(event) =>
                      setGroupDescription(
                        event.target.value
                      )
                    }
                    rows={3}
                    maxLength={500}
                    placeholder="What is this group reading or studying?"
                  />
                </label>

                <button
                  type="submit"
                  className="button primary"
                  disabled={
                    creatingGroup ||
                    groupName.trim().length < 2
                  }
                >
                  <Plus size={16} />

                  {creatingGroup
                    ? "Creating..."
                    : groupType === "class"
                      ? "Create Class"
                      : "Create Group"}
                </button>
              </form>
            </div>
          </section>
        )}


        {activeTab === "margins" && (
          <section className="panel profile-panel">
            <div className="section-heading-row">
              <div>
                <p className="eyebrow">
                  Bookmarked Discussions
                </p>

                <h2>
                  Saved Margins
                </h2>
              </div>

              <Link
                to="/read/margins"
                className="button secondary"
              >
                <MessageCircle
                  size={16}
                />

                The Margins
              </Link>
            </div>


            {savedMargins.length ===
            0 ? (
              <p className="muted">
                Margins you save will
                appear here.
              </p>
            ) : (
              <div className="public-profile-entry-list">
                {savedMargins.map(
                  (
                    entry,
                    index
                  ) => {
                    const bookId =
                      String(
                        entry.bookId ||
                        ""
                      );

                    return (
                      <article
                        key={
                          entry.id ||
                          `saved-margin-${index}`
                        }
                        className="public-profile-entry"
                      >
                        <div className="public-entry-heading">
                          <div>
                            <p className="eyebrow">
                              Saved Margin
                            </p>

                            {bookId ? (
                              <Link
                                to={`/read/reader/${bookId}`}
                                className="public-entry-book-title"
                              >
                                {entry.title ||
                                  "Untitled"}
                              </Link>
                            ) : (
                              <strong className="public-entry-book-title">
                                {entry.title ||
                                  "Untitled"}
                              </strong>
                            )}

                            {entry.author && (
                              <p className="public-entry-author">
                                {entry.author}
                              </p>
                            )}
                          </div>

                          <Bookmark
                            size={20}
                          />
                        </div>


                        <div className="public-entry-meta">
                          {entry.paragraphNumber && (
                            <span>
                              Paragraph{" "}
                              {entry.paragraphNumber}
                            </span>
                          )}

                          {entry.savedAtISO && (
                            <span>
                              Saved{" "}
                              {formatDate(
                                entry.savedAtISO
                              )}
                            </span>
                          )}
                        </div>


                        {entry.paragraphPreview && (
                          <div className="public-entry-quote">
                            <p>
                              “{entry.paragraphPreview}”
                            </p>
                          </div>
                        )}


                        <p className="public-journal-note">
                          {entry.note}
                        </p>


                        <div className="button-row">
                          {bookId && (
                            <Link
                              to={`/read/reader/${bookId}`}
                              className="button secondary"
                            >
                              <BookOpen
                                size={16}
                              />

                              Open Book
                            </Link>
                          )}

                          {entry.sourceEntryId && (
                            <Link
                              to={`/read/margins#margin-${entry.sourceEntryId}`}
                              className="button secondary"
                            >
                              <MessageCircle
                                size={16}
                              />

                              Open Margin
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        )}

      </div>
    </main>
  );
}
