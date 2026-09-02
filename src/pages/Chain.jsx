import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Link2,
  Link2Off,
  BookOpen,
  Flag,
  MessageCircle,
  Send,
  Share2,
  Shuffle,
  Search,
  Trash2,
  Users,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";
import {
  createGroupForumPost
} from "../services/groupsPhase3A.js";
import {
  getMyGroups
} from "../services/storage.js";
import {
  getChainFeed,
  getFriendsChainFeed,
  getGroupsChainFeed,
  getSavedChainEntries,
  getChainBranches,
  prefetchChainBranches,
  getMyChainVotes,
  reportChainEntry,
  sortChainEntriesByVote,
  voteOnChainEntry,
  saveChainEntry,
  unsaveChainEntry
} from "../services/chainStorage.js";
import {
  deleteChainReply,
  getChainReplies,
  replyToChain
} from "../services/chainRepliesPhase3A.js";
import { getProfileAvatar } from "../data/avatars.js";
import { getGroupAvatar } from "../data/groupAvatars.js";
import SEO from "../components/SEO.jsx";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function savedChainKey(entry) {
  return [entry?.userId || "", entry?.id || ""].filter(Boolean).join("_");
}


function sourceBookCoverUrl(book) {
  const explicit =
    book?.coverUrl ||
    book?.cover ||
    book?.image ||
    book?.thumbnail ||
    "";

  if (explicit) return explicit;

  const numericId = String(book?.bookId || book?.id || "").match(/\d+/)?.[0];
  if (!numericId) return "";

  return `https://www.gutenberg.org/cache/epub/${numericId}/pg${numericId}.cover.medium.jpg`;
}

function readingLink(entry) {
  const base = `/read/reader/${entry.bookId}`;

  if (
    entry.paragraphIndex !== undefined &&
    entry.paragraphIndex !== null
  ) {
    return `${base}?paragraph=${Number(entry.paragraphIndex)}`;
  }

  if (
    entry.paragraphNumber !== undefined &&
    entry.paragraphNumber !== null
  ) {
    return `${base}?paragraph=${Math.max(Number(entry.paragraphNumber) - 1, 0)}`;
  }

  return base;
}

export default function Chain() {
  const [filter, setFilter] = useState("all");
  const [entries, setEntries] = useState([]);
  const [user, setUser] = useState(null);
  const [savedChainEntries, setSavedChainEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [openReplyId, setOpenReplyId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [repliesByEntry, setRepliesByEntry] = useState({});
  const [repliesLoading, setRepliesLoading] = useState({});
  const [reportEntry, setReportEntry] = useState(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);
  const [shareMenuId, setShareMenuId] = useState(null);
  const [discussEntry, setDiscussEntry] = useState(null);
  const [myGroups, setMyGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [discussionGroupId, setDiscussionGroupId] = useState("");
  const [discussionTitle, setDiscussionTitle] = useState("");
  const [discussionBody, setDiscussionBody] = useState("");
  const [discussionPosting, setDiscussionPosting] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [levels, setLevels] = useState([]);
  const [initialChainSeeded, setInitialChainSeeded] = useState(false);
  const [levelLoading, setLevelLoading] = useState(false);
  const [chromeVisible] = useState(true);
  const [depthMotion, setDepthMotion] = useState("");
  const [myVotes, setMyVotes] = useState({});
  const [voteLoadingKey, setVoteLoadingKey] = useState("");
  const [emptyLinkPrompt, setEmptyLinkPrompt] = useState(null);
  const chainSwipeStartRef = useRef(null);
  const reelsRef = useRef(null);
  const sourceReelsRef = useRef(null);
  const depthMotionTimerRef = useRef(null);


  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    document.body.classList.add("chain-immersive");

    return () => {
      if (depthMotionTimerRef.current) {
        window.clearTimeout(depthMotionTimerRef.current);
      }

      document.body.classList.remove(
        "chain-immersive",
        "chain-chrome-visible"
      );
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle(
      "chain-chrome-visible",
      chromeVisible
    );
  }, [chromeVisible]);

  useEffect(() => {
    let active = true;

    async function loadChain() {
      try {
        setLoading(true);
        setStatus("");

        const feed =
          filter === "friends"
            ? await getFriendsChainFeed()
            : filter === "groups"
              ? await getGroupsChainFeed()
              : await getChainFeed();

        if (active) setEntries(feed);
      } catch (error) {
        console.error("Could not load The Chain:", error);
        if (active) setStatus("We couldn't load The Chain.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadChain();
    return () => { active = false; };
  }, [filter]);

  useEffect(() => {
    let active = true;

    async function loadSaved() {
      if (!user) {
        setSavedChainEntries([]);
        return;
      }

      try {
        const saved = await getSavedChainEntries();
        if (active) setSavedChainEntries(saved);
      } catch (error) {
        console.error("Could not load saved Chain posts:", error);
      }
    }

    loadSaved();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadReplies() {
      if (!entries.length) {
        if (active) setRepliesByEntry({});
        return;
      }

      setRepliesLoading(
        Object.fromEntries(entries.map((entry) => [entry.id, true]))
      );

      const pairs = await Promise.all(
        entries.map(async (entry) => {
          try {
            return [entry.id, await getChainReplies(entry)];
          } catch (error) {
            console.error(`Could not load replies for ${entry.id}:`, error);
            return [entry.id, []];
          }
        })
      );

      if (!active) return;
      setRepliesByEntry(Object.fromEntries(pairs));
      setRepliesLoading({});
    }

    loadReplies();
    return () => { active = false; };
  }, [entries, user]);

  const savedKeys = useMemo(
    () =>
      new Set(
        savedChainEntries.map((saved) =>
          [saved.sourceUserId, saved.sourceEntryId]
            .filter(Boolean)
            .join("_")
        )
      ),
    [savedChainEntries]
  );

  function requireLogin() {
    if (user) return true;
    setStatus("Log in to reply, save, or report Chain posts.");
    return false;
  }

  async function openReply(entry) {
    if (!requireLogin()) return;
    setStatus("");

    if (openReplyId === entry.id) {
      setOpenReplyId(null);
      setReplyText("");
      return;
    }

    setOpenReplyId(entry.id);
    setReplyText("");

    if (!Object.prototype.hasOwnProperty.call(repliesByEntry, entry.id)) {
      try {
        setRepliesLoading((current) => ({ ...current, [entry.id]: true }));
        const replies = await getChainReplies(entry);
        setRepliesByEntry((current) => ({
          ...current,
          [entry.id]: replies
        }));
      } catch (error) {
        console.error(`Could not load replies for ${entry.id}:`, error);
      } finally {
        setRepliesLoading((current) => ({ ...current, [entry.id]: false }));
      }
    }
  }

  async function refreshReplies(entry) {
    try {
      setRepliesLoading((current) => ({ ...current, [entry.id]: true }));
      const replies = await getChainReplies(entry);
      setRepliesByEntry((current) => ({ ...current, [entry.id]: replies }));
    } finally {
      setRepliesLoading((current) => ({ ...current, [entry.id]: false }));
    }
  }

  async function handleReply(entry) {
    if (!requireLogin()) return;

    const cleanReply = replyText.trim();
    if (!cleanReply) {
      setStatus("Write a reply first.");
      return;
    }

    try {
      setReplying(true);
      setStatus("");

      await replyToChain(entry, {
        note: cleanReply,
        visibility: entry.visibility,
        groupId: entry.visibility === "group" ? entry.groupId : null
      });

      setReplyText("");
      setOpenReplyId(null);
      await refreshReplies(entry);
      setStatus("Reply posted.");
    } catch (error) {
      console.error("Could not post reply:", error);
      setStatus("We couldn't post your reply.");
    } finally {
      setReplying(false);
    }
  }

  async function handleDeleteReply(entry, reply) {
    if (!window.confirm("Delete this reply? This cannot be undone.")) return;

    try {
      await deleteChainReply(reply);
      await refreshReplies(entry);
      setStatus("Reply removed.");
    } catch (error) {
      setStatus(error?.message || "We couldn't remove that reply.");
    }
  }

  async function handleSave(entry) {
    if (!requireLogin()) return;

    const key = savedChainKey(entry);
    const alreadySaved = savedKeys.has(key);

    try {
      setStatus("");

      if (alreadySaved) {
        await unsaveChainEntry(entry);
        setSavedChainEntries((current) =>
          current.filter(
            (saved) =>
              [saved.sourceUserId, saved.sourceEntryId]
                .filter(Boolean)
                .join("_") !== key
          )
        );
        setStatus("Removed from saved Chain posts.");
        return;
      }

      const saved = await saveChainEntry(entry);
      setSavedChainEntries((current) => [saved, ...current]);
      setStatus("Chain post saved.");
    } catch (error) {
      setStatus("We couldn't update your saved Chain posts.");
    }
  }

  async function handleShare(entry) {
    const chainUrl = `${window.location.origin}/read#chain-${entry.id}`;
    const shareData = {
      title: `${entry.title || "The Chain"} | Lit Chain`,
      text: entry.note || "Read this Chain post on Lit Chain.",
      url: chainUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(chainUrl);
        setStatus("Chain post link copied.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setStatus("We couldn't share that Chain post.");
      }
    }
  }

  function openDiscussInGroup(entry) {
    if (!requireLogin()) return;

    setShareMenuId(null);
    setDiscussEntry(entry);
    setDiscussionTitle(
      entry.title ? `Discussion: ${entry.title}` : "Discussion from The Chain"
    );
    setDiscussionBody("");
    setDiscussionGroupId("");
    setGroupsLoading(true);

    Promise.resolve()
      .then(() => getMyGroups())
      .then((groups) => {
        const availableGroups = Array.isArray(groups) ? groups : [];
        setMyGroups(availableGroups);

        if (availableGroups.length === 1) {
          setDiscussionGroupId(
            String(availableGroups[0].id || availableGroups[0].groupId || "")
          );
        }
      })
      .catch((error) => {
        console.error("Could not load groups:", error);
        setMyGroups([]);
        setStatus("We couldn't load your groups.");
      })
      .finally(() => {
        setGroupsLoading(false);
      });
  }

  async function handleCreateGroupDiscussion(event) {
    event.preventDefault();
    if (!discussEntry) return;

    if (!discussionGroupId) {
      setStatus("Choose a group first.");
      return;
    }

    if (!discussionTitle.trim()) {
      setStatus("Add a discussion title.");
      return;
    }

    if (!discussionBody.trim()) {
      setStatus("Add an opening comment for the group.");
      return;
    }

    try {
      setDiscussionPosting(true);
      setStatus("");

      await createGroupForumPost(discussionGroupId, {
        title: discussionTitle,
        body: discussionBody,
        sourceChainEntry: discussEntry
      });

      setDiscussEntry(null);
      setDiscussionGroupId("");
      setDiscussionTitle("");
      setDiscussionBody("");
      setStatus("Group discussion created.");
    } catch (error) {
      console.error("Could not create group discussion:", error);
      setStatus(error?.message || "We couldn't create that group discussion.");
    } finally {
      setDiscussionPosting(false);
    }
  }



  const sourceBooks = useMemo(() => {
    const byBook = new Map();

    for (const entry of entries) {
      if (!entry?.bookId) continue;
      const bookId = String(entry.bookId);

      if (!byBook.has(bookId)) {
        byBook.set(bookId, {
          id: bookId,
          bookId,
          title: entry.title || "Untitled",
          author: entry.author || "",
          coverUrl:
            entry.coverUrl ||
            entry.cover ||
            entry.image ||
            entry.thumbnail ||
            "",
          linkCount: 0,
          latestAt: entry.updatedAtISO || entry.createdAt || ""
        });
      }

      const book = byBook.get(bookId);

      // Level 1 is a direct connection to literature itself.
      if (!entry.sourceChainEntryId) {
        book.linkCount += 1;
      }

      const candidateDate = entry.updatedAtISO || entry.createdAt || "";
      if (String(candidateDate) > String(book.latestAt || "")) {
        book.latestAt = candidateDate;
      }
    }

    return [...byBook.values()]
      .filter((book) => book.linkCount > 0)
      .sort((a, b) => {
        const linkDifference = Number(b.linkCount || 0) - Number(a.linkCount || 0);
        if (linkDifference !== 0) return linkDifference;

        return String(b.latestAt || "").localeCompare(
          String(a.latestAt || "")
        );
      });
  }, [entries]);

  const selectedSourceBook = useMemo(
    () =>
      sourceBooks.find((book) => String(book.id) === String(selectedBookId)) ||
      sourceBooks[0] ||
      null,
    [sourceBooks, selectedBookId]
  );

  const selectedSourceIndex = Math.max(
    0,
    sourceBooks.findIndex(
      (book) => String(book.id) === String(selectedSourceBook?.id)
    )
  );

  useEffect(() => {
    if (loading || initialChainSeeded) return;

    if (sourceBooks.length && !selectedBookId) {
      setSelectedBookId(String(sourceBooks[0].id));
    }

    // Lit Chain now opens at Level 0: literature first.
    setLevels([]);
    setInitialChainSeeded(true);
  }, [
    loading,
    initialChainSeeded,
    sourceBooks,
    selectedBookId
  ]);

  const currentLevel = levels.length ? levels[levels.length - 1] : null;
  const currentDepth = levels.length;
  const currentItems = currentLevel?.items || [];
  const currentSelectedIndex = Math.min(
    currentLevel?.selectedIndex || 0,
    Math.max(currentItems.length - 1, 0)
  );
  const currentSelectedItem = currentItems[currentSelectedIndex] || null;
  const replyEntry = useMemo(() => {
    if (!openReplyId) return null;

    return (
      currentItems.find((entry) => entry?.id === openReplyId) ||
      entries.find((entry) => entry?.id === openReplyId) ||
      null
    );
  }, [openReplyId, currentItems, entries]);


  function animateDepthChange(direction, applyChange) {
    const exitClass =
      direction === "forward"
        ? "chain-depth-exit-forward"
        : "chain-depth-exit-back";

    const enterClass =
      direction === "forward"
        ? "chain-depth-enter-forward"
        : "chain-depth-enter-back";

    if (depthMotionTimerRef.current) {
      window.clearTimeout(depthMotionTimerRef.current);
    }

    setDepthMotion(exitClass);

    depthMotionTimerRef.current = window.setTimeout(() => {
      applyChange();
      setDepthMotion(enterClass);

      requestAnimationFrame(() => {
        depthMotionTimerRef.current = window.setTimeout(() => {
          setDepthMotion("");
        }, 190);
      });
    }, 135);
  }

  function jumpToDepth(depth) {
    const safeDepth = Math.max(0, Math.min(depth, currentDepth));

    if (safeDepth === currentDepth) return;

    animateDepthChange("back", () => {
      if (safeDepth === 0) {
        setLevels([]);
      } else {
        setLevels((current) => current.slice(0, safeDepth));
      }
      setStatus("");
    });
  }

  function levelOneForBook(book) {
    if (!book) return [];

    return sortChainEntriesByVote(
      entries.filter(
        (entry) =>
          String(entry.bookId || "") === String(book.id) &&
          !entry.sourceChainEntryId
      )
    );
  }

  function enterSourceBook(book = selectedSourceBook) {
    if (!book) return;

    const items = levelOneForBook(book);

    setSelectedBookId(String(book.id));

    animateDepthChange("forward", () => {
      setLevels([
        {
          parent: {
            nodeType: "book",
            ...book
          },
          items,
          selectedIndex: 0
        }
      ]);
      setStatus("");
    });
  }

  function selectLevelItem(index) {
    setLevels((current) => {
      if (!current.length) return current;

      const lastLevel = current[current.length - 1];
      const maxIndex = Math.max((lastLevel.items?.length || 1) - 1, 0);
      const safeIndex = Math.max(0, Math.min(index, maxIndex));

      const next = [...current];
      next[next.length - 1] = {
        ...lastLevel,
        selectedIndex: safeIndex
      };
      return next;
    });
  }

  function goToSibling(index, behavior = "smooth") {
    if (!currentItems.length) return;

    const safeIndex = Math.max(
      0,
      Math.min(index, currentItems.length - 1)
    );

    selectLevelItem(safeIndex);

    const scroller = reelsRef.current;
    if (!scroller) return;

    scroller.scrollTo({
      top: safeIndex * scroller.clientHeight,
      behavior
    });
  }

  function goToSourceSibling(index, behavior = "smooth") {
    if (!sourceBooks.length) return;

    const safeIndex = Math.max(
      0,
      Math.min(index, sourceBooks.length - 1)
    );

    const book = sourceBooks[safeIndex];
    setSelectedBookId(String(book.id));

    const scroller = sourceReelsRef.current;
    if (!scroller) return;

    scroller.scrollTo({
      top: safeIndex * scroller.clientHeight,
      behavior
    });
  }

  function showRandomSourceBook() {
    if (!sourceBooks.length) return;

    if (sourceBooks.length === 1) {
      goToSourceSibling(0);
      return;
    }

    let nextIndex = selectedSourceIndex;

    while (nextIndex === selectedSourceIndex) {
      nextIndex = Math.floor(Math.random() * sourceBooks.length);
    }

    goToSourceSibling(nextIndex);
  }

  function handleSourceReelsScroll(event) {
    const scroller = event.currentTarget;
    const pageHeight = scroller.clientHeight || 1;
    const nextIndex = Math.round(scroller.scrollTop / pageHeight);

    if (
      nextIndex >= 0 &&
      nextIndex < sourceBooks.length &&
      nextIndex !== selectedSourceIndex
    ) {
      setSelectedBookId(String(sourceBooks[nextIndex].id));
    }
  }

  function orientationDotIndexes(count, selectedIndex, maxDots = 9) {
    if (count <= maxDots) {
      return Array.from({ length: count }, (_, index) => index);
    }

    const half = Math.floor(maxDots / 2);
    let start = Math.max(0, selectedIndex - half);
    let end = start + maxDots;

    if (end > count) {
      end = count;
      start = Math.max(0, end - maxDots);
    }

    return Array.from({ length: end - start }, (_, offset) => start + offset);
  }

  function renderOrientationDots(count, selectedIndex, onSelect, label) {
    if (count <= 1) return null;

    const indexes = orientationDotIndexes(count, selectedIndex);

    return (
      <div className="chain-orientation-dots" aria-label={label}>
        {indexes.map((index) => (
          <button
            key={index}
            type="button"
            className={
              index === selectedIndex
                ? "chain-orientation-dot active"
                : "chain-orientation-dot"
            }
            aria-label={`${label} ${index + 1} of ${count}`}
            aria-current={index === selectedIndex ? "true" : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(index);
            }}
          />
        ))}
      </div>
    );
  }

  function renderLevelDots() {
    const count = levels.length + 1;

    return (
      <nav className="chain-level-dots" aria-label="Chain levels">
        {Array.from({ length: count }, (_, depth) => {
          const level = depth === 0 ? null : levels[depth - 1];
          const isAddLevel =
            depth > 0 &&
            level?.items?.[level.selectedIndex || 0]?.nodeType === "add-link";

          return (
            <button
              key={depth}
              type="button"
              className={[
                "chain-level-dot",
                depth === currentDepth ? "active" : "",
                isAddLevel ? "add" : ""
              ].filter(Boolean).join(" ")}
              aria-label={
                isAddLevel
                  ? `Add link at level ${depth}`
                  : depth === 0
                    ? "Literature source"
                    : `Level ${depth}`
              }
              aria-current={depth === currentDepth ? "true" : undefined}
              disabled={depth > currentDepth}
              onClick={(event) => {
                event.stopPropagation();
                jumpToDepth(depth);
              }}
            >
              {isAddLevel ? <span>+</span> : null}
            </button>
          );
        })}
      </nav>
    );
  }

  async function followSelectedIdea() {
    if (
      !currentSelectedItem ||
      currentSelectedItem.nodeType === "group" ||
      currentSelectedItem.nodeType === "add-link"
    ) {
      return;
    }

    try {
      setLevelLoading(true);
      setStatus("");

      const branches = await getChainBranches(currentSelectedItem);
      const nextItems = [
        ...sortChainEntriesByVote(
          (branches?.notes || []).map((item) => ({
            ...item,
            nodeType: "note"
          }))
        ),
        ...(branches?.groupDiscussions || []).map((item) => ({
          ...item,
          nodeType: "group"
        }))
      ];

      const itemsToOpen = nextItems.length
        ? nextItems
        : [
            {
              id: `add_${currentSelectedItem.userId || "reader"}_${currentSelectedItem.id}`,
              nodeType: "add-link",
              sourceEntry: currentSelectedItem
            }
          ];

      animateDepthChange("forward", () => {
        setLevels((current) => [
          ...current,
          {
            parent: currentSelectedItem,
            items: itemsToOpen,
            selectedIndex: 0
          }
        ]);
      });
    } catch (error) {
      console.error("Could not follow this Chain link:", error);
      setStatus("We couldn't load the next Chain level.");
    } finally {
      setLevelLoading(false);
    }
  }

  function goBackOneLevel() {
    if (!levels.length) return;
    setStatus("");
    setLevels((current) => current.slice(0, -1));
  }

  function handleChainTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) return;

    chainSwipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  }

  function handleChainTouchEnd(event) {
    const start = chainSwipeStartRef.current;
    chainSwipeStartRef.current = null;

    const touch = event.changedTouches?.[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const elapsed = Date.now() - start.time;

    if (elapsed > 1000) return;

    const horizontalSwipe =
      Math.abs(deltaX) >= 58 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.15;

    const verticalSwipe =
      Math.abs(deltaY) >= 52 &&
      Math.abs(deltaY) > Math.abs(deltaX) * 1.15;

    // Reel navigation:
    // swipe UP = next item; swipe DOWN = previous item.
    if (verticalSwipe) {
      if (currentDepth === 0) {
        if (deltaY < 0) {
          goToSourceSibling(selectedSourceIndex + 1);
        } else {
          goToSourceSibling(selectedSourceIndex - 1);
        }
      } else if (deltaY < 0) {
        goToSibling(currentSelectedIndex + 1);
      } else {
        goToSibling(currentSelectedIndex - 1);
      }
      return;
    }

    if (!horizontalSwipe) return;

    // Depth navigation:
    // swipe LEFT = move deeper; swipe RIGHT = move back.
    if (deltaX < 0) {
      if (currentDepth === 0) {
        enterSourceBook();
      } else {
        followSelectedIdea();
      }
    } else {
      goBackOneLevel();
    }
  }


  useEffect(() => {
    if (
      currentDepth < 1 ||
      !currentSelectedItem ||
      currentSelectedItem.nodeType === "group"
    ) {
      return;
    }

    const candidates = [
      currentSelectedItem,
      currentItems[currentSelectedIndex + 1],
      currentItems[currentSelectedIndex - 1]
    ].filter(
      (item) => item && item.nodeType !== "group"
    );

    for (const item of candidates) {
      prefetchChainBranches(item);
    }
  }, [
    currentDepth,
    currentSelectedItem?.id,
    currentSelectedItem?.userId,
    currentSelectedIndex,
    currentItems.length
  ]);

  useEffect(() => {
    let active = true;

    async function loadVotes() {
      if (!user || !currentItems.length) {
        if (active) setMyVotes({});
        return;
      }

      const noteItems = currentItems.filter(
        (item) => item?.nodeType !== "group"
      );

      const votes = await getMyChainVotes(noteItems);
      if (active) {
        setMyVotes((current) => ({
          ...current,
          ...votes
        }));
      }
    }

    loadVotes();

    return () => {
      active = false;
    };
  }, [user, currentDepth, currentLevel?.parent?.id, currentItems.length]);

  async function handleChainVote(entry, direction) {
    if (!requireLogin()) return;

    const key = savedChainKey(entry);

    try {
      setVoteLoadingKey(key);
      setStatus("");

      const result = await voteOnChainEntry(entry, direction);

      setMyVotes((current) => ({
        ...current,
        [key]: result.direction
      }));

      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id && item.userId === entry.userId
            ? { ...item, ...result }
            : item
        )
      );

      setLevels((current) =>
        current.map((level) => ({
          ...level,
          items: sortChainEntriesByVote(
            level.items.map((item) =>
              item.id === entry.id && item.userId === entry.userId
                ? { ...item, ...result }
                : item
            )
          )
        }))
      );
    } catch (error) {
      console.error("Could not save Chain vote:", error);

      const code = String(error?.code || "");
      const message = String(error?.message || "");

      if (
        code.includes("permission-denied") ||
        message.toLowerCase().includes("insufficient permissions")
      ) {
        setStatus(
          "We couldn't record that Chain vote. Please refresh and try again."
        );
      } else if (code.includes("unavailable")) {
        setStatus(
          "Voting is temporarily unavailable. Please try again in a moment."
        );
      } else {
        setStatus("We couldn't record that Chain vote. Please try again.");
      }
    } finally {
      setVoteLoadingKey("");
    }
  }

  function handleReelsScroll(event) {
    const scroller = event.currentTarget;
    const pageHeight = scroller.clientHeight || 1;
    const nextIndex = Math.round(scroller.scrollTop / pageHeight);

    if (
      nextIndex >= 0 &&
      nextIndex < currentItems.length &&
      nextIndex !== currentSelectedIndex
    ) {
      selectLevelItem(nextIndex);
    }
  }

  async function handleReport(event) {
    event.preventDefault();
    if (!reportEntry) return;

    try {
      setReporting(true);
      await reportChainEntry(reportEntry, {
        reason: reportReason,
        details: reportDetails
      });
      setReportEntry(null);
      setReportDetails("");
      setStatus("Report submitted. Thank you.");
    } catch (error) {
      setStatus("We couldn't submit your report.");
    } finally {
      setReporting(false);
    }
  }

  function renderNoteCard(entry, index) {
    const reader = entry.reader;
    const avatar = getProfileAvatar(reader?.avatar);
    const groupAvatar = getGroupAvatar(entry.group?.avatar);
    const isSaved = savedKeys.has(savedChainKey(entry));
    const replyOpen = openReplyId === entry.id;
    const replies = repliesByEntry[entry.id] || [];
    const link = readingLink(entry);
    const selected = index === currentSelectedIndex;

    return (
      <article
        key={`${entry.userId || "note"}_${entry.id}`}
        id={`chain-${entry.id}`}
        className={[
          "margins-entry",
          "chain-level-card",
          "chain-reel-page",
          selected ? "selected" : ""
        ].filter(Boolean).join(" ")}
        onClick={() => selectLevelItem(index)}
      >
        <div className="margins-reader-row">
          <Link
            to={`/read/public/${entry.userId}`}
            className="margins-reader-link"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="margins-reader-avatar">
              {avatar ? <img src={avatar.image} alt="" /> : <Users size={20} />}
            </div>
            <div>
              <strong>{reader?.displayName || "Reader"}</strong>
              <small>{formatDate(entry.updatedAtISO || entry.createdAt)}</small>
            </div>
          </Link>
        </div>

        {entry.group && (
          <Link
            to={`/read/groups/${entry.groupId || entry.group.id}`}
            className="margins-group-link"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="chain-level-group-avatar">
              {groupAvatar ? (
                <img src={groupAvatar.image} alt="" />
              ) : (
                <Users size={16} />
              )}
            </div>
            <strong>{entry.group.name}</strong>
          </Link>
        )}

        <div className="public-entry-heading">
          <div>
            <p className="eyebrow">
              {currentDepth === 1 ? "Linked to literature" : `Level ${currentDepth} link`}
            </p>
            <Link
              to={`${link}${link.includes("?") ? "&" : "?"}note=${encodeURIComponent(entry.id)}`}
              state={{
                book: {
                  id: entry.bookId,
                  bookId: entry.bookId,
                  title: entry.title,
                  author: entry.author
                }
              }}
              className="public-entry-book-title"
              onClick={(event) => event.stopPropagation()}
            >
              {entry.title || "Untitled"}
            </Link>
            {entry.author && <p className="public-entry-author">{entry.author}</p>}
          </div>

          <div className="chain-share-menu-wrap chain-share-menu-top">
            <button
              type="button"
              className="public-entry-book-icon"
              aria-label="Share this Chain post"
              aria-expanded={shareMenuId === entry.id}
              onClick={(event) => {
                event.stopPropagation();
                setShareMenuId((current) =>
                  current === entry.id ? null : entry.id
                );
              }}
            >
              <Share2 size={20} />
            </button>

            {shareMenuId === entry.id && (
              <div className="chain-share-menu" onClick={(event) => event.stopPropagation()}>
                <Link
                  to={link}
                  state={{
                    book: {
                      id: entry.bookId,
                      bookId: entry.bookId,
                      title: entry.title,
                      author: entry.author
                    },
                    addFromChain: true,
                    sourceChainEntry: entry
                  }}
                  className="chain-share-menu-item"
                  onClick={(event) => {
                    if (!user) {
                      event.preventDefault();
                      requireLogin();
                      return;
                    }
                    setShareMenuId(null);
                  }}
                >
                  Add to My Notes
                </Link>

                <button
                  type="button"
                  className="chain-share-menu-item"
                  onClick={(event) => {
                    event.preventDefault();
                    openDiscussInGroup(entry);
                  }}
                >
                  Discuss in Group
                </button>

                <button
                  type="button"
                  className="chain-share-menu-item"
                  onClick={(event) => {
                    event.preventDefault();
                    setShareMenuId(null);
                    handleShare(entry);
                  }}
                >
                  Share Link
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="public-entry-meta">
          {entry.paragraphNumber && <span>Paragraph {entry.paragraphNumber}</span>}
          {entry.updatedAtISO && <span>Edited</span>}
        </div>

        {entry.paragraphPreview && (
          <div className="public-entry-quote">
            <p>“{entry.paragraphPreview}”</p>
          </div>
        )}

        <p className="public-journal-note">{entry.note}</p>

        <div
          className="chain-vote-row"
          onClick={(event) => event.stopPropagation()}
          aria-label="Chain voting"
        >
          <button
            type="button"
            className={
              myVotes[savedChainKey(entry)] === 1
                ? "chain-vote-button up active"
                : "chain-vote-button up"
            }
            disabled={voteLoadingKey === savedChainKey(entry)}
            onClick={() => handleChainVote(entry, 1)}
            aria-label="Up Chain"
            title="Up Chain"
          >
            <Link2 size={20} strokeWidth={3} />
            <span>Up Chain</span>
            <strong>{Number(entry.chainUpCount) || 0}</strong>
          </button>

          <div className="chain-vote-score" title="Chain score">
            {Number(entry.chainScore) || 0}
          </div>

          <button
            type="button"
            className={
              myVotes[savedChainKey(entry)] === -1
                ? "chain-vote-button down active"
                : "chain-vote-button down"
            }
            disabled={voteLoadingKey === savedChainKey(entry)}
            onClick={() => handleChainVote(entry, -1)}
            aria-label="Down Chain"
            title="Down Chain"
          >
            <Link2Off size={20} />
            <span>Down Chain</span>
            <strong>{Number(entry.chainDownCount) || 0}</strong>
          </button>
        </div>

        <div className="chain-level-selection">
          {selected ? (
            <span>Selected · swipe left to follow</span>
          ) : (
            <span>Tap to select this link</span>
          )}
        </div>

        <div className="margins-actions" onClick={(event) => event.stopPropagation()}>
          <Link
            to={`${link}${link.includes("?") ? "&" : "?"}note=${encodeURIComponent(entry.id)}`}
            state={{
              book: {
                id: entry.bookId,
                bookId: entry.bookId,
                title: entry.title,
                author: entry.author
              }
            }}
            className="margin-action"
          >
            <BookOpen size={17} />
            Read Context
          </Link>

          <button
            type="button"
            className={replyOpen ? "margin-action active" : "margin-action"}
            onClick={() => openReply(entry)}
          >
            <MessageCircle size={17} />
            Reply{replies.length > 0 ? ` (${replies.length})` : ""}
          </button>

          <button
            type="button"
            className={isSaved ? "margin-action active" : "margin-action"}
            onClick={() => handleSave(entry)}
          >
            <Bookmark size={17} fill={isSaved ? "currentColor" : "none"} />
            {isSaved ? "Saved" : "Save"}
          </button>

          <button
            type="button"
            className="margin-action report"
            onClick={() => {
              if (requireLogin()) {
                setReportEntry(entry);
                setReportReason("harassment");
                setReportDetails("");
              }
            }}
          >
            <Flag size={17} />
            Report
          </button>
        </div>

        {discussEntry?.id === entry.id && (
          <form
            className="chain-discussion-composer"
            onSubmit={handleCreateGroupDiscussion}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="margin-reply-heading">
              <strong>Discuss in Group</strong>
              <button
                type="button"
                className="margin-close-button"
                onClick={() => setDiscussEntry(null)}
                aria-label="Close group discussion"
              >
                <X size={18} />
              </button>
            </div>

            <div className="chain-discussion-source">
              <small>From The Chain</small>
              <strong>{discussEntry.title || "Untitled"}</strong>
              {discussEntry.author && <span>{discussEntry.author}</span>}
              {discussEntry.paragraphNumber && (
                <span>Paragraph {discussEntry.paragraphNumber}</span>
              )}
              {discussEntry.note && <p>“{discussEntry.note}”</p>}
            </div>

            <label>
              Group
              <select
                value={discussionGroupId}
                onChange={(event) => setDiscussionGroupId(event.target.value)}
                disabled={groupsLoading}
              >
                <option value="">
                  {groupsLoading ? "Loading groups..." : "Choose a group..."}
                </option>
                {myGroups.map((item) => (
                  <option key={item.id || item.groupId} value={item.id || item.groupId}>
                    {item.name || "Reading Group"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Discussion title
              <input
                value={discussionTitle}
                onChange={(event) => setDiscussionTitle(event.target.value)}
                maxLength={200}
              />
            </label>

            <label>
              Your comment
              <textarea
                rows={4}
                value={discussionBody}
                onChange={(event) => setDiscussionBody(event.target.value)}
                maxLength={2000}
              />
            </label>

            <button
              className="button primary"
              disabled={discussionPosting || groupsLoading || !myGroups.length}
            >
              {discussionPosting ? "Posting..." : "Start Discussion"}
            </button>
          </form>
        )}

      </article>
    );
  }

  function renderAddLinkCard(item, index) {
    const sourceEntry = item.sourceEntry;
    const selected = index === currentSelectedIndex;

    return (
      <article
        key={item.id}
        className={[
          "chain-level-card",
          "chain-reel-page",
          "chain-add-link-card",
          selected ? "selected" : ""
        ].filter(Boolean).join(" ")}
        onClick={() => selectLevelItem(index)}
      >
        <div className="chain-add-link-content">
          <div className="chain-add-link-icon">
            <span>+</span>
          </div>

          <p className="eyebrow">End of this branch</p>
          <h2>Add your own link</h2>
          <p>
            No reader has connected another idea here yet. Continue the Chain
            from this note.
          </p>

          <Link
            to={readingLink(sourceEntry)}
            state={{
              book: {
                id: sourceEntry.bookId,
                bookId: sourceEntry.bookId,
                title: sourceEntry.title,
                author: sourceEntry.author
              },
              addFromChain: true,
              sourceChainEntry: sourceEntry
            }}
            className="button primary chain-add-link-button"
            onClick={(event) => {
              event.stopPropagation();

              if (!user) {
                event.preventDefault();
                requireLogin();
              }
            }}
          >
            <Link2 size={18} />
            Add your own link
          </Link>
        </div>
      </article>
    );
  }

  function renderGroupDiscussionCard(item, index) {
    const selected = index === currentSelectedIndex;
    return (
      <article
        key={`group_${item.groupId}_${item.id}`}
        className={[
          "margins-entry",
          "chain-level-card",
          "chain-reel-page",
          "chain-level-discussion",
          selected ? "selected" : ""
        ].filter(Boolean).join(" ")}
        onClick={() => selectLevelItem(index)}
      >
        <p className="eyebrow">Group discussion</p>
        <h3>{item.title || "Group discussion"}</h3>
        {item.group?.name && <p className="muted">{item.group.name}</p>}
        {item.body && <p>{item.body}</p>}
        <Link
          to={`/read/groups/${item.groupId}`}
          className="button secondary"
          onClick={(event) => event.stopPropagation()}
        >
          Open Discussion
        </Link>
      </article>
    );
  }

  return (
    <main
      className={
        chromeVisible
          ? "chain-browser-page chain-chrome-visible"
          : "chain-browser-page"
      }
      onTouchStart={handleChainTouchStart}
      onTouchEnd={handleChainTouchEnd}
    >
      <SEO
        title="Lit Chain"
        description="Follow ideas outward from literature through connected reader notes and discussions."
        path="/read"
      />

      <div
        className={[
          "chain-immersive-stage",
          depthMotion
        ].filter(Boolean).join(" ")}
      >
        <section className="chain-fixed-filter" aria-label="Chain filter">
          <div className="margins-filter-bar">
            {["all", "friends", "groups"].map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "margins-filter active" : "margins-filter"}
                onClick={() => {
                  setFilter(value);
                  setLevels([]);
                  setInitialChainSeeded(false);
                }}
              >
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        {loading && (
          <section className="panel margins-loading">
            <p className="muted">Loading Lit Chain...</p>
          </section>
        )}

        {!loading && currentDepth === 0 && (
          <section className="chain-link-shell chain-source-level">

            <div className="chain-link-body">
              {renderOrientationDots(
                sourceBooks.length,
                selectedSourceIndex,
                goToSourceSibling,
                "Source book"
              )}

              {sourceBooks.length === 0 ? (
                <div className="panel margins-empty">
                  <p className="muted">
                    No source-linked notes are available in this view yet.
                  </p>
                </div>
              ) : (
                <div
                  ref={sourceReelsRef}
                  className="chain-source-reels"
                  onScroll={handleSourceReelsScroll}
                >
                  {sourceBooks.map((book, index) => (
                    <article
                      key={book.id}
                      className={[
                        "chain-source-reel",
                        index === selectedSourceIndex ? "selected" : ""
                      ].filter(Boolean).join(" ")}
                    >
                      <Link
                        to={`/read/reader/${book.id}`}
                        state={{
                          book: {
                            ...book,
                            id: book.id,
                            bookId: book.id
                          }
                        }}
                        className="chain-source-cover-screen"
                        aria-label={`Read ${book.title}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="chain-source-cover-fallback">
                          <BookOpen size={48} />
                          <strong>{book.title}</strong>
                        </div>

                        {sourceBookCoverUrl(book) && (
                          <img
                            src={sourceBookCoverUrl(book)}
                            alt=""
                            loading={index <= 1 ? "eager" : "lazy"}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                      </Link>

                      <div
                        className="chain-source-overlay-card"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <p className="eyebrow">Literature source</p>
                        <h2>{book.title}</h2>
                        {book.author && (
                          <p className="timeline-author">{book.author}</p>
                        )}

                        <div className="chain-source-link-summary">
                          <strong>{book.linkCount}</strong>
                          <span>
                            {book.linkCount === 1
                              ? "direct link"
                              : "direct links"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="button primary chain-source-open"
                          onClick={() => enterSourceBook(book)}
                        >
                          Explore this Chain
                          <ArrowRight size={17} />
                        </button>

                        <div className="chain-source-discovery-actions">
                          <button
                            type="button"
                            className="chain-source-discovery-button"
                            onClick={showRandomSourceBook}
                          >
                            <Shuffle size={15} />
                            Random
                          </button>

                          <Link
                            to="/read/search"
                            className="chain-source-discovery-button"
                          >
                            <Search size={15} />
                            Search
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && currentDepth > 0 && (
          <section className="chain-link-shell chain-link-level">
            <div className="chain-link-body">

            <div className="chain-level-heading">
              <div>
                <p className="eyebrow">Level {currentDepth}</p>
                <h2>
                  {currentDepth === 1
                    ? currentLevel?.parent?.title || "Linked ideas"
                    : "Connected ideas"}
                </h2>
                {currentDepth === 1 && currentLevel?.parent?.author && (
                  <p className="muted">{currentLevel.parent.author}</p>
                )}
              </div>
            </div>

            {renderOrientationDots(
              currentItems.length,
              currentSelectedIndex,
              goToSibling,
              "Linked note"
            )}

            {levelLoading && (
              <div className="panel">
                <p className="muted">Following the Chain…</p>
              </div>
            )}

            {!levelLoading && currentItems.length > 0 && (
              <div
                ref={reelsRef}
                className="margins-feed chain-level-list chain-reels"
                onScroll={handleReelsScroll}
              >
                {currentItems.map((item, index) =>
                  item.nodeType === "group"
                    ? renderGroupDiscussionCard(item, index)
                    : item.nodeType === "add-link"
                      ? renderAddLinkCard(item, index)
                      : renderNoteCard(item, index)
                )}
              </div>
            )}

            <div className="chain-swipe-cue chain-swipe-cue-split">
              <span><ArrowRight size={17} /> Swipe right: back</span>
              <span>Swipe left: follow <ArrowLeft size={17} /></span>
            </div>
            </div>
          </section>
        )}

        {renderLevelDots()}
      </div>

      {replyEntry && openReplyId && (
        <div
          className="margin-modal-backdrop chain-reply-modal-backdrop"
          onClick={() => {
            setOpenReplyId(null);
            setReplyText("");
          }}
        >
          <section
            className="chain-reply-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="margin-reply-heading">
              <div>
                <p className="eyebrow">Chain conversation</p>
                <strong>Replies</strong>
              </div>
              <button
                type="button"
                className="margin-close-button"
                onClick={() => {
                  setOpenReplyId(null);
                  setReplyText("");
                }}
                aria-label="Close replies"
              >
                <X size={18} />
              </button>
            </div>

            <div className="chain-reply-modal-source">
              <strong>{replyEntry.title || "Untitled"}</strong>
              {replyEntry.note && <p>“{replyEntry.note}”</p>}
            </div>

            <div className="chain-reply-modal-scroll">
              {repliesLoading[replyEntry.id] && (
                <p className="muted">Loading replies…</p>
              )}

              {(repliesByEntry[replyEntry.id] || []).length > 0 ? (
                <div className="margin-replies">
                  {(repliesByEntry[replyEntry.id] || []).map((reply) => (
                    <div key={reply.id} className="margin-reply">
                      <div>
                        <strong>{reply.reader?.displayName || "Reader"}</strong>
                        <small>
                          {formatDate(reply.createdAtISO || reply.createdAt)}
                        </small>
                      </div>
                      <p>{reply.note}</p>
                      {reply.userId === user?.uid && (
                        <button
                          type="button"
                          className="margin-action report"
                          onClick={() => handleDeleteReply(replyEntry, reply)}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                !repliesLoading[replyEntry.id] && (
                  <p className="muted">No replies yet.</p>
                )
              )}
            </div>

            <div className="chain-reply-modal-compose">
              <textarea
                rows={3}
                maxLength={3000}
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                placeholder="Add to the conversation…"
              />

              <button
                type="button"
                className="button primary"
                disabled={replying || !replyText.trim()}
                onClick={() => handleReply(replyEntry)}
              >
                <Send size={16} />
                {replying ? "Posting..." : "Post Reply"}
              </button>
            </div>
          </section>
        </div>
      )}

      {reportEntry && (
        <div className="modal-backdrop">
          <section className="modal-card">
            <div className="margin-reply-heading">
              <strong>Report Chain Post</strong>
              <button
                type="button"
                className="margin-close-button"
                onClick={() => setReportEntry(null)}
                aria-label="Close report"
              >
                <X size={18} />
              </button>
            </div>

            <label>
              Reason
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              >
                <option value="harassment">Harassment</option>
                <option value="hate">Hate or abuse</option>
                <option value="spam">Spam</option>
                <option value="sexual">Sexual content</option>
                <option value="violence">Violence or threats</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Details
              <textarea
                rows={4}
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
              />
            </label>

            <button
              type="button"
              className="button primary"
              disabled={reporting}
              onClick={handleReport}
            >
              {reporting ? "Submitting..." : "Submit Report"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
