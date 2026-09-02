import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookOpen,
  Flag,
  MessageCircle,
  Send,
  Share2,
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
  reportChainEntry,
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
  const [levelLoading, setLevelLoading] = useState(false);
  const chainSwipeStartRef = useRef(null);


  useEffect(() => onAuthStateChanged(auth, setUser), []);

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
      .sort((a, b) =>
        String(b.latestAt || "").localeCompare(String(a.latestAt || ""))
      );
  }, [entries]);

  const selectedSourceBook = useMemo(
    () =>
      sourceBooks.find((book) => String(book.id) === String(selectedBookId)) ||
      sourceBooks[0] ||
      null,
    [sourceBooks, selectedBookId]
  );

  const currentLevel = levels.length ? levels[levels.length - 1] : null;
  const currentDepth = levels.length;
  const currentItems = currentLevel?.items || [];
  const currentSelectedIndex = Math.min(
    currentLevel?.selectedIndex || 0,
    Math.max(currentItems.length - 1, 0)
  );
  const currentSelectedItem = currentItems[currentSelectedIndex] || null;

  function levelOneForBook(book) {
    if (!book) return [];

    return entries.filter(
      (entry) =>
        String(entry.bookId || "") === String(book.id) &&
        !entry.sourceChainEntryId
    );
  }

  function enterSourceBook(book = selectedSourceBook) {
    if (!book) return;

    const items = levelOneForBook(book);

    setSelectedBookId(String(book.id));
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
  }

  function selectLevelItem(index) {
    setLevels((current) => {
      if (!current.length) return current;
      const next = [...current];
      next[next.length - 1] = {
        ...next[next.length - 1],
        selectedIndex: index
      };
      return next;
    });
  }

  async function followSelectedIdea() {
    if (!currentSelectedItem || currentSelectedItem.nodeType === "group") {
      return;
    }

    try {
      setLevelLoading(true);
      setStatus("");

      const branches = await getChainBranches(currentSelectedItem);
      const nextItems = [
        ...(branches?.notes || []).map((item) => ({
          ...item,
          nodeType: "note"
        })),
        ...(branches?.groupDiscussions || []).map((item) => ({
          ...item,
          nodeType: "group"
        }))
      ];

      setLevels((current) => [
        ...current,
        {
          parent: currentSelectedItem,
          items: nextItems,
          selectedIndex: 0
        }
      ]);
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

    if (elapsed > 900 || Math.abs(deltaX) < 58) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

    // Lit Chain deliberately uses the user's spatial model:
    // swipe RIGHT = move deeper; swipe LEFT = move back.
    if (deltaX > 0) {
      if (currentDepth === 0) {
        enterSourceBook();
      } else {
        followSelectedIdea();
      }
    } else {
      goBackOneLevel();
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

        <div className="chain-level-selection">
          {selected ? (
            <span>Selected · swipe right to follow</span>
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

        {replyOpen && (
          <div className="margin-reply-box" onClick={(event) => event.stopPropagation()}>
            <div className="margin-reply-heading">
              <strong>Reply</strong>
              <button
                type="button"
                className="margin-close-button"
                onClick={() => {
                  setOpenReplyId(null);
                  setReplyText("");
                }}
                aria-label="Close reply"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              rows={4}
              maxLength={3000}
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              placeholder="Add to the conversation…"
            />

            <button
              type="button"
              className="button primary"
              disabled={replying || !replyText.trim()}
              onClick={() => handleReply(entry)}
            >
              <Send size={16} />
              {replying ? "Posting..." : "Post Reply"}
            </button>

            {repliesLoading[entry.id] && <p className="muted">Loading replies…</p>}

            {replies.length > 0 && (
              <div className="margin-replies">
                {replies.map((reply) => (
                  <div key={reply.id} className="margin-reply">
                    <div>
                      <strong>{reply.reader?.displayName || "Reader"}</strong>
                      <small>{formatDate(reply.createdAtISO || reply.createdAt)}</small>
                    </div>
                    <p>{reply.note}</p>
                    {reply.userId === user?.uid && (
                      <button
                        type="button"
                        className="margin-action report"
                        onClick={() => handleDeleteReply(entry, reply)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
      className="page-wrap chain-browser-page"
      onTouchStart={handleChainTouchStart}
      onTouchEnd={handleChainTouchEnd}
    >
      <SEO
        title="Lit Chain"
        description="Follow ideas outward from literature through connected reader notes and discussions."
        path="/read"
      />

      <div className="stack-lg">
        <section className="hero-card small margins-hero">
          <p className="eyebrow">Reader Community</p>
          <h1>Lit Chain</h1>
          <p className="muted">
            Start with the literature. Swipe right to follow a thought deeper.
            Scroll vertically to explore other links at the same level.
          </p>
        </section>

        <section className="margins-filter-bar">
          {["all", "friends", "groups"].map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "margins-filter active" : "margins-filter"}
              onClick={() => {
                setFilter(value);
                setLevels([]);
              }}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </section>

        <nav className="chain-depth-bar" aria-label="Chain depth">
          <button
            type="button"
            className="chain-depth-back"
            disabled={currentDepth === 0}
            onClick={goBackOneLevel}
          >
            <ChevronLeft size={18} />
            Back
          </button>

          <div className="chain-depth-path">
            <span className={currentDepth === 0 ? "active" : ""}>Source</span>
            {levels.map((level, index) => (
              <span
                key={`${index}_${level.parent?.id || level.parent?.bookId || "level"}`}
                className={index === levels.length - 1 ? "active" : ""}
              >
                <ChevronRight size={13} />
                Level {index + 1}
              </span>
            ))}
          </div>

          <button
            type="button"
            className="chain-depth-forward"
            disabled={
              levelLoading ||
              (currentDepth === 0
                ? !selectedSourceBook
                : !currentSelectedItem || currentSelectedItem.nodeType === "group")
            }
            onClick={() =>
              currentDepth === 0 ? enterSourceBook() : followSelectedIdea()
            }
          >
            Follow
            <ChevronRight size={18} />
          </button>
        </nav>

        {status && <p className="status">{status}</p>}

        {loading && (
          <section className="panel margins-loading">
            <p className="muted">Loading Lit Chain...</p>
          </section>
        )}

        {!loading && currentDepth === 0 && (
          <section className="chain-source-level">
            <div className="chain-level-heading">
              <div>
                <p className="eyebrow">Level 0</p>
                <h2>Lit Chain Source</h2>
              </div>
              <span>{sourceBooks.length} books</span>
            </div>

            {sourceBooks.length === 0 ? (
              <div className="panel margins-empty">
                <p className="muted">
                  No source-linked notes are available in this view yet.
                </p>
              </div>
            ) : (
              <div className="chain-source-list">
                {sourceBooks.map((book) => {
                  const selected =
                    String(book.id) === String(selectedSourceBook?.id);

                  return (
                    <button
                      key={book.id}
                      type="button"
                      className={selected ? "chain-source-book selected" : "chain-source-book"}
                      onClick={() => setSelectedBookId(String(book.id))}
                      onDoubleClick={() => enterSourceBook(book)}
                    >
                      <div>
                        <strong>{book.title}</strong>
                        {book.author && <span>{book.author}</span>}
                      </div>
                      <small>
                        {book.linkCount} {book.linkCount === 1 ? "link" : "links"}
                      </small>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="chain-swipe-cue">
              <ArrowRight size={18} />
              <span>Swipe right to enter the selected book's Chain</span>
            </div>
          </section>
        )}

        {!loading && currentDepth > 0 && (
          <section className="chain-link-level">
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
              <span>
                {currentItems.length} {currentItems.length === 1 ? "link" : "links"}
              </span>
            </div>

            {levelLoading && (
              <div className="panel">
                <p className="muted">Following the Chain…</p>
              </div>
            )}

            {!levelLoading && currentItems.length === 0 && (
              <div className="panel margins-empty">
                <p className="muted">
                  This thought does not have another visible link yet.
                </p>
                <p className="muted">
                  Swipe left or use Back to return to the previous level.
                </p>
              </div>
            )}

            {!levelLoading && currentItems.length > 0 && (
              <div className="margins-feed chain-level-list">
                {currentItems.map((item, index) =>
                  item.nodeType === "group"
                    ? renderGroupDiscussionCard(item, index)
                    : renderNoteCard(item, index)
                )}
              </div>
            )}

            <div className="chain-swipe-cue chain-swipe-cue-split">
              <span><ArrowLeft size={17} /> Swipe left: back</span>
              <span>Swipe right: follow <ArrowRight size={17} /></span>
            </div>
          </section>
        )}
      </div>

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
