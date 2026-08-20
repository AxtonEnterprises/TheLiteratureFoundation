import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Bookmark,
  BookOpen,
  Flag,
  MessageCircle,
  Send,
  Share2,
  Users,
  X
} from "lucide-react";

import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "../firebase";

import {
  getMarginReplies,
  getMarginsFeed,
  getFriendsMarginsFeed,
  getSavedMargins,
  reportMarginEntry,
  replyToMargin,
  saveMarginEntry,
  unsaveMarginEntry
} from "../services/storage.js";

import { getProfileAvatar } from "../data/avatars.js";
import SEO from "../components/SEO.jsx";

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function savedMarginKey(entry) {
  return [entry?.userId || "", entry?.id || ""]
    .filter(Boolean)
    .join("_");
}


function buildReplyTree(replies) {
  const nodes = new Map();
  const roots = [];

  replies.forEach((reply) => {
    nodes.set(reply.id, {
      ...reply,
      children: []
    });
  });

  nodes.forEach((node) => {
    const parentId = node.parentReplyId;

    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId).children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
}

export default function Margins() {
  const [filter, setFilter] = useState("all");
  const [entries, setEntries] = useState([]);
  const [user, setUser] = useState(null);
  const [savedMargins, setSavedMargins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [expandedThreadId, setExpandedThreadId] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replyVisibility, setReplyVisibility] = useState("public");
  const [replying, setReplying] = useState(false);
  const [repliesByEntry, setRepliesByEntry] = useState({});
  const [repliesLoading, setRepliesLoading] = useState({});
  const [reportEntry, setReportEntry] = useState(null);
  const [reportReason, setReportReason] = useState("harassment");
  const [reportDetails, setReportDetails] = useState("");
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMargins() {
      if (
        filter ===
        "groups"
      ) {
        setEntries([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setStatus("");

        const feed =
          filter ===
          "friends"
            ? await getFriendsMarginsFeed()
            : await getMarginsFeed();

        if (active) {
          setEntries(
            feed
          );
        }
      } catch (error) {
        console.error(
          "Could not load The Margins:",
          error
        );

        if (active) {
          setStatus(
            "We couldn't load The Margins."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadMargins();

    return () => {
      active = false;
    };
  }, [
    filter
  ]);


  useEffect(() => {
    let active = true;

    async function loadSaved() {
      if (!user) {
        setSavedMargins([]);
        return;
      }

      try {
        const saved = await getSavedMargins();

        if (active) {
          setSavedMargins(saved);
        }
      } catch (error) {
        console.error("Could not load saved Margins:", error);
      }
    }

    loadSaved();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadReplies() {
      if (!entries.length) {
        if (active) {
          setRepliesByEntry({});
        }
        return;
      }

      const loadingState = Object.fromEntries(
        entries.map((entry) => [entry.id, true])
      );

      if (active) {
        setRepliesLoading(loadingState);
      }

      const replyPairs = await Promise.all(
        entries.map(async (entry) => {
          try {
            const replies = await getMarginReplies(entry);
            return [entry.id, replies];
          } catch (error) {
            console.error(
              `Could not load replies for Margin ${entry.id}:`,
              error
            );
            return [entry.id, []];
          }
        })
      );

      if (!active) {
        return;
      }

      setRepliesByEntry(Object.fromEntries(replyPairs));
      setRepliesLoading({});
    }

    loadReplies();

    return () => {
      active = false;
    };
  }, [entries, user]);

  const savedKeys = useMemo(
    () =>
      new Set(
        savedMargins.map((saved) =>
          [saved.sourceUserId, saved.sourceEntryId]
            .filter(Boolean)
            .join("_")
        )
      ),
    [savedMargins]
  );

  function requireLogin() {
    if (user) {
      return true;
    }

    setStatus("Log in to reply, save, or report Margins.");
    return false;
  }

  function toggleThread(entry) {
    setStatus("");

    if (expandedThreadId === entry.id) {
      setExpandedThreadId(null);
      setReplyTarget(null);
      setReplyText("");
      return;
    }

    setExpandedThreadId(entry.id);
    setReplyTarget(null);
    setReplyText("");
  }

  function openReplyComposer(entry, parentReply = null) {
    if (!requireLogin()) {
      return;
    }

    setStatus("");
    setExpandedThreadId(entry.id);

    setReplyTarget({
      entryId: entry.id,
      parentReplyId: parentReply?.id || null
    });

    setReplyText("");

    setReplyVisibility(
      parentReply?.visibility === "private"
        ? "private"
        : "public"
    );
  }

  function closeReplyComposer() {
    setReplyTarget(null);
    setReplyText("");
  }

  async function refreshReplies(entry) {
    try {
      setRepliesLoading((current) => ({
        ...current,
        [entry.id]: true
      }));

      const replies = await getMarginReplies(entry);

      setRepliesByEntry((current) => ({
        ...current,
        [entry.id]: replies
      }));
    } catch (error) {
      console.error(
        `Could not refresh replies for Margin ${entry.id}:`,
        error
      );
    } finally {
      setRepliesLoading((current) => ({
        ...current,
        [entry.id]: false
      }));
    }
  }

  async function handleReply(entry) {
    if (!requireLogin()) {
      return;
    }

    const cleanReply = replyText.trim();

    if (!cleanReply) {
      setStatus("Write a reply first.");
      return;
    }

    try {
      setReplying(true);
      setStatus("");

      await replyToMargin(entry, {
        note: cleanReply,
        visibility: replyVisibility,
        parentReplyId:
          replyTarget?.parentReplyId || null
      });

      setReplyText("");
      setReplyTarget(null);
      setExpandedThreadId(entry.id);

      await refreshReplies(entry);

      setStatus(
        replyVisibility === "private"
          ? "Private reply saved."
          : "Reply posted."
      );
    } catch (error) {
      console.error("Could not post reply:", error);
      setStatus("We couldn't post your reply.");
    } finally {
      setReplying(false);
    }
  }

  function renderReplyNode(entry, reply, depth = 0) {
    const replyingHere =
      replyTarget?.entryId === entry.id &&
      replyTarget?.parentReplyId === reply.id;

    return (
      <div
        key={reply.id}
        className="margin-reply"
        style={{
          marginLeft:
            depth > 0
              ? `${Math.min(depth, 4) * 1.1}rem`
              : 0,
          paddingLeft:
            depth > 0
              ? "0.8rem"
              : 0,
          borderLeft:
            depth > 0
              ? "2px solid var(--line)"
              : "none"
        }}
      >
        <div className="margin-reply-meta">
          <strong>
            {reply.userId === user?.uid
              ? "You"
              : "Reader"}
          </strong>

          <span>
            {formatDate(
              reply.createdAtISO ||
                reply.createdAt
            )}
          </span>

          {reply.visibility === "private" && (
            <span>Private</span>
          )}
        </div>

        <p>{reply.note}</p>

        <button
          type="button"
          className="margin-action"
          onClick={() =>
            openReplyComposer(entry, reply)
          }
        >
          <MessageCircle size={15} />
          Reply
        </button>

        {replyingHere && (
          <div className="margin-reply-box">
            <div className="margin-reply-heading">
              <strong>Reply to comment</strong>

              <button
                type="button"
                className="margin-close-button"
                onClick={closeReplyComposer}
                aria-label="Close reply"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={replyText}
              onChange={(event) =>
                setReplyText(event.target.value)
              }
              rows={3}
              maxLength={1000}
              placeholder="Write a reply..."
            />

            <div className="margin-reply-options">
              <label>
                Visibility

                <select
                  value={replyVisibility}
                  onChange={(event) =>
                    setReplyVisibility(
                      event.target.value
                    )
                  }
                >
                  <option value="public">
                    Public
                  </option>
                  <option value="private">
                    Private Journal
                  </option>
                </select>
              </label>
            </div>

            <div className="button-row">
              <button
                type="button"
                className="button primary"
                disabled={replying}
                onClick={() => handleReply(entry)}
              >
                <Send size={16} />
                {replying
                  ? "Posting..."
                  : "Post Reply"}
              </button>
            </div>
          </div>
        )}

        {reply.children?.map((child) =>
          renderReplyNode(
            entry,
            child,
            depth + 1
          )
        )}
      </div>
    );
  }

  async function handleSave(entry) {
    if (!requireLogin()) {
      return;
    }

    const key = savedMarginKey(entry);
    const alreadySaved = savedKeys.has(key);

    try {
      setStatus("");

      if (alreadySaved) {
        await unsaveMarginEntry(entry);

        setSavedMargins((current) =>
          current.filter(
            (saved) =>
              [saved.sourceUserId, saved.sourceEntryId]
                .filter(Boolean)
                .join("_") !== key
          )
        );

        setStatus("Removed from saved Margins.");
        return;
      }

      const saved = await saveMarginEntry(entry);

      setSavedMargins((current) => [saved, ...current]);
      setStatus("Margin saved.");
    } catch (error) {
      console.error("Could not save Margin:", error);
      setStatus("We couldn't update your saved Margins.");
    }
  }

  async function handleShare(entry) {
    const marginUrl =
      `${window.location.origin}/read/margins#margin-${entry.id}`;

    const shareData = {
      title: `${entry.title || "The Margins"} | Random Reads`,
      text: entry.note || "Read this Margin on Random Reads.",
      url: marginUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(marginUrl);
      setStatus("Margin link copied.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Could not share Margin:", error);
        setStatus("We couldn't share that Margin.");
      }
    }
  }

  function openReport(entry) {
    if (!requireLogin()) {
      return;
    }

    setReportEntry(entry);
    setReportReason("harassment");
    setReportDetails("");
    setStatus("");
  }

  function closeReport() {
    if (reporting) {
      return;
    }

    setReportEntry(null);
    setReportDetails("");
  }

  async function handleReport(event) {
    event.preventDefault();

    if (!reportEntry) {
      return;
    }

    try {
      setReporting(true);
      setStatus("");

      await reportMarginEntry(reportEntry, {
        reason: reportReason,
        details: reportDetails
      });

      setReportEntry(null);
      setReportDetails("");
      setStatus("Report submitted. Thank you.");
    } catch (error) {
      console.error("Could not report Margin:", error);
      setStatus("We couldn't submit your report.");
    } finally {
      setReporting(false);
    }
  }

  return (
    <main className="page-wrap">
      <SEO
        title="The Margins | Random Reads"
        description="See what readers are discovering, questioning, and discussing across classic literature."
        path="/read/margins"
      />

      <div className="stack-lg">
        <section className="hero-card small margins-hero">
          <p className="eyebrow">Reader Community</p>
          <h1>The Margins</h1>
          <p className="muted">
            Notes, questions, observations, and discoveries
            from readers across the library.
          </p>
        </section>

        <section className="margins-filter-bar">
          {["all", "friends", "groups"].map((value) => (
            <button
              key={value}
              type="button"
              className={
                filter === value
                  ? "margins-filter active"
                  : "margins-filter"
              }
              onClick={() => setFilter(value)}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </section>

        {status && <p className="status">{status}</p>}

        {filter === "groups" && (
          <section className="panel margins-coming-soon">
            <Users size={22} />
            <div>
              <strong>
                Groups feed
              </strong>
              <p className="muted">
                Groups will be added in the next social phase.
              </p>
            </div>
          </section>
        )}

        {filter !== "groups" && (
          <>
            {loading && (
              <section className="panel margins-loading">
                <p className="muted">Loading The Margins...</p>
              </section>
            )}

            {!loading && !status && entries.length === 0 && (
              <section className="panel margins-empty">
                <p className="muted">
                  Nothing has been written in The Margins yet.
                </p>
              </section>
            )}

            {!loading && entries.length > 0 && (
              <div className="margins-feed">
                {entries.map((entry) => {
                  const reader = entry.reader;
                  const avatar = getProfileAvatar(reader?.avatar);
                  const isSaved = savedKeys.has(savedMarginKey(entry));
                  const replies = repliesByEntry[entry.id] || [];
                  const replyTree = buildReplyTree(replies);
                  const threadExpanded =
                    expandedThreadId === entry.id;
                  const rootReplyOpen =
                    replyTarget?.entryId === entry.id &&
                    replyTarget?.parentReplyId === null;
                  const isLoadingReplies = Boolean(
                    repliesLoading[entry.id]
                  );

                  return (
                    <article
                      key={entry.id}
                      id={`margin-${entry.id}`}
                      className="margins-entry"
                    >
                      <div className="margins-reader-row">
                        <Link
                          to={`/read/public/${entry.userId}`}
                          className="margins-reader-link"
                        >
                          <div className="margins-reader-avatar">
                            {avatar ? (
                              <img src={avatar.image} alt="" />
                            ) : (
                              <Users size={20} />
                            )}
                          </div>

                          <div>
                            <strong>
                              {reader?.displayName || "Reader"}
                            </strong>
                            <small>
                              {formatDate(
                                entry.updatedAtISO || entry.createdAt
                              )}
                            </small>
                          </div>
                        </Link>
                      </div>

                      <div className="public-entry-heading">
                        <div>
                          <p className="eyebrow">Reading</p>

                          <Link
                            to={`/read/reader/${entry.bookId}`}
                            className="public-entry-book-title"
                          >
                            {entry.title || "Untitled"}
                          </Link>

                          {entry.author && (
                            <p className="public-entry-author">
                              {entry.author}
                            </p>
                          )}
                        </div>

                        <Link
                          to={`/read/reader/${entry.bookId}`}
                          className="public-entry-book-icon"
                          aria-label={`Open ${entry.title || "book"}`}
                        >
                          <BookOpen size={20} />
                        </Link>
                      </div>

                      <div className="public-entry-meta">
                        {entry.paragraphNumber && (
                          <span>
                            Paragraph {entry.paragraphNumber}
                          </span>
                        )}

                        {entry.updatedAtISO && <span>Edited</span>}
                      </div>

                      {entry.paragraphPreview && (
                        <div className="public-entry-quote">
                          <p>“{entry.paragraphPreview}”</p>
                        </div>
                      )}

                      <p className="public-journal-note">
                        {entry.note}
                      </p>

                      <div className="margins-actions">
                        <button
                          type="button"
                          className={
                            threadExpanded
                              ? "margin-action active"
                              : "margin-action"
                          }
                          onClick={() => toggleThread(entry)}
                        >
                          <MessageCircle size={17} />
                          {threadExpanded
                            ? "Hide Replies"
                            : replies.length > 0
                              ? `Replies (${replies.length})`
                              : "Replies"}
                        </button>

                        <button
                          type="button"
                          className={
                            isSaved
                              ? "margin-action active"
                              : "margin-action"
                          }
                          onClick={() => handleSave(entry)}
                        >
                          <Bookmark
                            size={17}
                            fill={isSaved ? "currentColor" : "none"}
                          />
                          {isSaved ? "Saved" : "Save"}
                        </button>

                        <button
                          type="button"
                          className="margin-action"
                          onClick={() => handleShare(entry)}
                        >
                          <Share2 size={17} />
                          Share
                        </button>

                        <button
                          type="button"
                          className="margin-action report"
                          onClick={() => openReport(entry)}
                        >
                          <Flag size={17} />
                          Report
                        </button>
                      </div>

                      {threadExpanded && (
                        <div className="margin-replies">
                          {isLoadingReplies && (
                            <p className="muted">
                              Loading replies...
                            </p>
                          )}

                          {!isLoadingReplies && (
                            <>
                              {!rootReplyOpen && (
                                <button
                                  type="button"
                                  className="margin-action"
                                  onClick={() =>
                                    openReplyComposer(
                                      entry,
                                      null
                                    )
                                  }
                                >
                                  <MessageCircle size={15} />
                                  Reply to Margin
                                </button>
                              )}

                              {rootReplyOpen && (
                                <div className="margin-reply-box">
                                  <div className="margin-reply-heading">
                                    <strong>
                                      Reply to Margin
                                    </strong>

                                    <button
                                      type="button"
                                      className="margin-close-button"
                                      onClick={closeReplyComposer}
                                      aria-label="Close reply"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>

                                  <textarea
                                    value={replyText}
                                    onChange={(event) =>
                                      setReplyText(
                                        event.target.value
                                      )
                                    }
                                    rows={3}
                                    maxLength={1000}
                                    placeholder="Write a reply..."
                                  />

                                  <div className="margin-reply-options">
                                    <label>
                                      Visibility

                                      <select
                                        value={replyVisibility}
                                        onChange={(event) =>
                                          setReplyVisibility(
                                            event.target.value
                                          )
                                        }
                                      >
                                        <option value="public">
                                          Public
                                        </option>
                                        <option value="private">
                                          Private Journal
                                        </option>
                                      </select>
                                    </label>
                                  </div>

                                  <div className="button-row">
                                    <button
                                      type="button"
                                      className="button primary"
                                      disabled={replying}
                                      onClick={() =>
                                        handleReply(entry)
                                      }
                                    >
                                      <Send size={16} />
                                      {replying
                                        ? "Posting..."
                                        : "Post Reply"}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {replies.length === 0 ? (
                                <p className="muted">
                                  No replies yet.
                                </p>
                              ) : (
                                replyTree.map((reply) =>
                                  renderReplyNode(
                                    entry,
                                    reply
                                  )
                                )
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {reportEntry && (
        <div
          className="margin-modal-backdrop"
          role="presentation"
          onClick={closeReport}
        >
          <section
            className="margin-report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="margin-report-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="margin-report-heading">
              <div>
                <p className="eyebrow">Community Safety</p>
                <h2 id="margin-report-title">Report Margin</h2>
              </div>

              <button
                type="button"
                className="margin-close-button"
                onClick={closeReport}
                aria-label="Close report"
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="margin-report-form"
              onSubmit={handleReport}
            >
              <label>
                Reason

                <select
                  value={reportReason}
                  onChange={(event) =>
                    setReportReason(event.target.value)
                  }
                >
                  <option value="harassment">
                    Harassment or bullying
                  </option>
                  <option value="hate">
                    Hate or discrimination
                  </option>
                  <option value="sexual">
                    Sexual content
                  </option>
                  <option value="violence">
                    Violence or threats
                  </option>
                  <option value="spam">
                    Spam
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>
              </label>

              <label>
                Additional details

                <textarea
                  value={reportDetails}
                  onChange={(event) =>
                    setReportDetails(event.target.value)
                  }
                  rows={4}
                  maxLength={1000}
                  placeholder="Optional"
                />
              </label>

              <div className="button-row">
                <button
                  type="submit"
                  className="button danger"
                  disabled={reporting}
                >
                  <Flag size={16} />
                  {reporting
                    ? "Submitting..."
                    : "Submit Report"}
                </button>

                <button
                  type="button"
                  className="button secondary"
                  onClick={closeReport}
                  disabled={reporting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
