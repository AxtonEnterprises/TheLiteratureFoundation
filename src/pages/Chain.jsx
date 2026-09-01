import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ChevronDown,
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
  getChainProvenance,
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
  const [provenanceByEntry, setProvenanceByEntry] = useState({});
  const [provenanceLoading, setProvenanceLoading] = useState({});
  const [openChainId, setOpenChainId] = useState(null);

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

  function openReply(entry) {
    if (!requireLogin()) return;
    setStatus("");

    if (openReplyId === entry.id) {
      setOpenReplyId(null);
      setReplyText("");
    } else {
      setOpenReplyId(entry.id);
      setReplyText("");
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

  async function toggleIdeaChain(entry) {
    const key = savedChainKey(entry);
    if (openChainId === key) {
      setOpenChainId(null);
      return;
    }
    setOpenChainId(key);
    if (provenanceByEntry[key]) return;
    try {
      setProvenanceLoading((current) => ({ ...current, [key]: true }));
      const provenance = await getChainProvenance(entry);
      setProvenanceByEntry((current) => ({ ...current, [key]: provenance }));
    } catch (error) {
      console.error("Could not load idea chain:", error);
      setStatus("We couldn't load this idea chain.");
    } finally {
      setProvenanceLoading((current) => ({ ...current, [key]: false }));
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

  return (
    <main className="page-wrap">
      <SEO
        title="Lit Chain"
        description="Notes, questions, observations, and discoveries from readers across the library."
        path="/read"
      />

      <div className="stack-lg">
        <section className="hero-card small margins-hero">
          <p className="eyebrow">Reader Community</p>
          <h1>Lit Chain</h1>
          <p className="muted">
            Notes, questions, observations, and discoveries from readers
            across the library.
          </p>
        </section>

        <section className="margins-filter-bar">
          {["all", "friends", "groups"].map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "margins-filter active" : "margins-filter"}
              onClick={() => setFilter(value)}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </section>

        {status && <p className="status">{status}</p>}

        {loading && (
          <section className="panel margins-loading">
            <p className="muted">Loading Lit Chain...</p>
          </section>
        )}

        {!loading && entries.length === 0 && (
          <section className="panel margins-empty">
            <p className="muted">Nothing has been posted to Lit Chain yet.</p>
          </section>
        )}

        {!loading && entries.length > 0 && (
          <div className="margins-feed">
            {entries.map((entry) => {
              const reader = entry.reader;
              const avatar = getProfileAvatar(reader?.avatar);
              const groupAvatar = getGroupAvatar(entry.group?.avatar);
              const isSaved = savedKeys.has(savedChainKey(entry));
              const replyOpen = openReplyId === entry.id;
              const replies = repliesByEntry[entry.id] || [];
              const link = readingLink(entry);
              const provenanceKey = savedChainKey(entry);
              const provenance = provenanceByEntry[provenanceKey] || null;
              const chainOpen = openChainId === provenanceKey;
              const branchCount =
                (provenance?.branches?.noteCount || 0) +
                (provenance?.branches?.groupDiscussionCount || 0);

              return (
                <article
                  key={entry.id}
                  id={`chain-${entry.id}`}
                  className="margins-entry"
                >
                  <div className="margins-reader-row">
                    <Link
                      to={`/read/public/${entry.userId}`}
                      className="margins-reader-link"
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
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.55rem",
                        marginBottom: "0.9rem",
                        padding: "0.4rem 0.65rem",
                        borderRadius: 999,
                        background: "#eef4f3",
                        textDecoration: "none",
                        color: "inherit"
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          overflow: "hidden",
                          background: "#fff",
                          display: "grid",
                          placeItems: "center"
                        }}
                      >
                        {groupAvatar ? (
                          <img
                            src={groupAvatar.image}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <Users size={16} />
                        )}
                      </div>
                      <strong>{entry.group.name}</strong>
                    </Link>
                  )}

                  <div className="public-entry-heading">
                    <div>
                      <p className="eyebrow">Reading</p>
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
                      >
                        {entry.title || "Untitled"}
                      </Link>
                      {entry.author && (
                        <p className="public-entry-author">{entry.author}</p>
                      )}
                    </div>

                    <div className="chain-share-menu-wrap chain-share-menu-top">
                      <button
                        type="button"
                        className="public-entry-book-icon"
                        aria-label="Share this Chain post"
                        title="Share"
                        aria-expanded={shareMenuId === entry.id}
                        onClick={() =>
                          setShareMenuId((current) =>
                            current === entry.id ? null : entry.id
                          )
                        }
                      >
                        <Share2 size={20} />
                      </button>

                      {shareMenuId === entry.id && (
                        <div className="chain-share-menu">
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
                              event.stopPropagation();
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
                              event.stopPropagation();
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
                    {entry.paragraphNumber && (
                      <span>Paragraph {entry.paragraphNumber}</span>
                    )}
                    {entry.updatedAtISO && <span>Edited</span>}
                  </div>

                  {entry.paragraphPreview && (
                    <div className="public-entry-quote">
                      <p>“{entry.paragraphPreview}”</p>
                    </div>
                  )}

                  <p className="public-journal-note">{entry.note}</p>

                  {entry.sourceChainEntryId && (
                    <button type="button" className="chain-provenance-source" onClick={() => toggleIdeaChain(entry)}>
                      <span>Inspired by a Chain note</span>
                      <strong>
                        {entry.sourceTitle || entry.title || "Reading note"}
                        {entry.sourceParagraphIndex !== undefined && entry.sourceParagraphIndex !== null
                          ? ` · Paragraph ${Number(entry.sourceParagraphIndex) + 1}` : ""}
                      </strong>
                    </button>
                  )}

                  <button type="button" className="chain-continue-button" onClick={() => toggleIdeaChain(entry)} aria-expanded={chainOpen}>
                    <span>{branchCount > 0 ? `${branchCount} continuation${branchCount === 1 ? "" : "s"}` : "Continue Chain"}</span>
                    <ChevronDown size={16} className={chainOpen ? "chain-chevron-open" : ""} />
                  </button>

                  {chainOpen && (
                    <div className="chain-provenance-panel">
                      {provenanceLoading[provenanceKey] && <p className="muted">Following the chain…</p>}
                      {!provenanceLoading[provenanceKey] && provenance && (
                        <>
                          {provenance.source && (
                            <section className="chain-provenance-section">
                              <small>Inspired by</small>
                              <Link
                                to={`${readingLink(provenance.source)}&note=${encodeURIComponent(provenance.source.id)}`}
                                state={{ book: { id: provenance.source.bookId, bookId: provenance.source.bookId, title: provenance.source.title, author: provenance.source.author } }}
                                className="chain-provenance-card"
                              >
                                <strong>{provenance.source.reader?.displayName || "Reader"}</strong>
                                <span>{provenance.source.title || "Untitled"}{provenance.source.paragraphNumber ? ` · Paragraph ${provenance.source.paragraphNumber}` : ""}</span>
                                {provenance.source.note && <p>“{String(provenance.source.note).slice(0, 220)}”</p>}
                              </Link>
                            </section>
                          )}

                          {provenance.branches?.notes?.length > 0 && (
                            <section className="chain-provenance-section">
                              <small>Continued by {provenance.branches.noteCount} reader{provenance.branches.noteCount === 1 ? "" : "s"}</small>
                              {provenance.branches.notes.map((branch) => (
                                <Link
                                  key={`${branch.userId}-${branch.id}`}
                                  to={`${readingLink(branch)}&note=${encodeURIComponent(branch.id)}`}
                                  state={{ book: { id: branch.bookId, bookId: branch.bookId, title: branch.title, author: branch.author } }}
                                  className="chain-provenance-card"
                                >
                                  <strong>{branch.reader?.displayName || "Reader"}</strong>
                                  <span>{branch.title || "Untitled"}{branch.paragraphNumber ? ` · Paragraph ${branch.paragraphNumber}` : ""}</span>
                                  {branch.note && <p>“{String(branch.note).slice(0, 220)}”</p>}
                                </Link>
                              ))}
                            </section>
                          )}

                          {provenance.branches?.groupDiscussions?.length > 0 && (
                            <section className="chain-provenance-section">
                              <small>{provenance.branches.groupDiscussionCount} group discussion{provenance.branches.groupDiscussionCount === 1 ? "" : "s"}</small>
                              {provenance.branches.groupDiscussions.map((discussion) => (
                                <Link key={`${discussion.groupId}-${discussion.id}`} to={`/read/groups/${discussion.groupId}`} className="chain-provenance-card">
                                  <strong>{discussion.title || "Group discussion"}</strong>
                                  {discussion.body && <p>{String(discussion.body).slice(0, 220)}</p>}
                                </Link>
                              ))}
                            </section>
                          )}

                          {!provenance.source && !provenance.branches?.noteCount && !provenance.branches?.groupDiscussionCount && (
                            <p className="muted">No one has continued this idea yet.</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  <div className="margins-actions">
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
                          onChange={(event) =>
                            setDiscussionGroupId(event.target.value)
                          }
                          disabled={groupsLoading}
                        >
                          <option value="">
                            {groupsLoading
                              ? "Loading groups..."
                              : "Choose a group..."}
                          </option>
                          {myGroups.map((item) => (
                            <option
                              key={item.id || item.groupId}
                              value={item.id || item.groupId}
                            >
                              {item.name || "Reading Group"}
                            </option>
                          ))}
                        </select>
                      </label>

                      {!groupsLoading && myGroups.length === 0 && (
                        <p className="muted">
                          Join or create a group before starting a group discussion.
                        </p>
                      )}

                      <label>
                        Discussion title
                        <input
                          value={discussionTitle}
                          onChange={(event) =>
                            setDiscussionTitle(event.target.value)
                          }
                          maxLength={200}
                        />
                      </label>

                      <label>
                        Your comment
                        <textarea
                          rows={4}
                          value={discussionBody}
                          onChange={(event) =>
                            setDiscussionBody(event.target.value)
                          }
                          maxLength={2000}
                          placeholder="What would you like the group to discuss?"
                        />
                      </label>

                      <button
                        className="button primary"
                        disabled={
                          discussionPosting ||
                          groupsLoading ||
                          !myGroups.length
                        }
                      >
                        {discussionPosting ? "Posting..." : "Start Discussion"}
                      </button>
                    </form>
                  )}

                  {replyOpen && (
                    <div className="margin-reply-box">
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
                        value={replyText}
                        onChange={(event) => setReplyText(event.target.value)}
                        rows={4}
                        maxLength={1000}
                        placeholder={`Reply to ${reader?.displayName || "this reader"}...`}
                      />

                      <div className="button-row">
                        <button
                          type="button"
                          className="button primary"
                          disabled={replying}
                          onClick={() => handleReply(entry)}
                        >
                          <Send size={16} />
                          {replying ? "Posting..." : "Post Reply"}
                        </button>
                      </div>
                    </div>
                  )}

                  {replyOpen && repliesLoading[entry.id] && (
                    <div className="margin-replies">
                      <p className="muted">Loading replies...</p>
                    </div>
                  )}

                  {replyOpen && !repliesLoading[entry.id] && replies.length > 0 && (
                    <div className="margin-replies">
                      {replies.map((reply) => (
                        <div key={reply.id} className="margin-reply">
                          <div>
                            <strong>
                              {reply.reader?.displayName ||
                                reply.profile?.displayName ||
                                "Reader"}
                            </strong>
                            <small>{formatDate(reply.createdAtISO || reply.createdAt)}</small>
                          </div>
                          <p>{reply.note}</p>

                          {reply.canDelete && (
                            <button
                              type="button"
                              className="margin-action report"
                              onClick={() => handleDeleteReply(entry, reply)}
                            >
                              <Trash2 size={15} />
                              Delete
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {reportEntry && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-card" onSubmit={handleReport}>
            <div className="margin-reply-heading">
              <strong>Report Chain post</strong>
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
                <option value="spam">Spam</option>
                <option value="hate">Hate or abusive content</option>
                <option value="sexual">Sexual content</option>
                <option value="copyright">Copyright concern</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label>
              Details
              <textarea
                rows={4}
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                maxLength={1000}
              />
            </label>

            <button className="button primary" disabled={reporting}>
              {reporting ? "Submitting..." : "Submit Report"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
