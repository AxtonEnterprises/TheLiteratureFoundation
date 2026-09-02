import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Link } from "react-router-dom";

import {
  cancelGroupJoinRequest,
  getDiscoverableGroups,
  requestToJoinGroup
} from "../services/storage.js";

import { getGroupAvatar } from "../data/groupAvatars.js";
import SEO from "../components/SEO.jsx";

function joinPolicyLabel(group) {
  if (group.joinPolicy === "open") return "Open";
  if (group.joinPolicy === "request_to_join") return "Request to join";
  return "Invite only";
}

export default function DiscoverGroups() {
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [status, setStatus] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  async function load() {
    try {
      setLoading(true);
      setStatus("");
      setGroups(await getDiscoverableGroups());
    } catch (error) {
      console.error("Could not load discoverable groups:", error);
      setStatus(error?.message || "We couldn't load groups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return groups;

    return groups.filter((group) =>
      [
        group.name,
        group.description,
        group.type
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(term)
        )
    );
  }, [groups, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  async function join(group) {
    try {
      setBusyId(group.id);
      setStatus("");

      const result = await requestToJoinGroup(group.id);
      await load();

      setStatus(
        result?.status === "joined"
          ? `You joined ${group.name}.`
          : `Join request sent to ${group.name}.`
      );
    } catch (error) {
      setStatus(
        error?.message || "We couldn't join that group."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(group) {
    try {
      setBusyId(group.id);
      setStatus("");
      await cancelGroupJoinRequest(group.id);
      await load();
      setStatus("Join request canceled.");
    } catch (error) {
      setStatus(
        error?.message || "We couldn't cancel that request."
      );
    } finally {
      setBusyId(null);
    }
  }

  function handleScroll(event) {
    const viewport = event.currentTarget;
    const height = viewport.clientHeight;

    if (!height) return;

    const next = Math.round(viewport.scrollTop / height);

    setSelectedIndex(
      Math.max(0, Math.min(filtered.length - 1, next))
    );
  }

  return (
    <main className="groups-reel-page">
      <SEO
        title="Groups | Lit Chain"
        description="Explore Lit Chain reading groups and classes."
        path="/read/groups"
        noindex
      />

      <div className="groups-reel-toolbar">
        <div>
          <p className="eyebrow">Communities</p>
          <strong>Groups & Classes</strong>
        </div>

        <button
          type="button"
          className={
            searchOpen
              ? "groups-search-toggle active"
              : "groups-search-toggle"
          }
          onClick={() => setSearchOpen((current) => !current)}
          aria-label="Search groups"
        >
          <Search size={18} />
        </button>
      </div>

      {searchOpen && (
        <div className="groups-reel-search">
          <Search size={16} />
          <input
            autoFocus
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search groups and classes..."
          />
        </div>
      )}

      {status && (
        <p className="status groups-reel-status">
          {status}
        </p>
      )}

      {loading ? (
        <section className="groups-reel-state">
          <p className="muted">Loading groups...</p>
        </section>
      ) : filtered.length === 0 ? (
        <section className="groups-reel-state">
          <p className="muted">
            No groups match your search yet.
          </p>
        </section>
      ) : (
        <>
          <div
            className="groups-reel-viewport"
            onScroll={handleScroll}
          >
            {filtered.map((group) => {
              const avatar = getGroupAvatar(group.avatar);
              const isMember = Boolean(group.membership);
              const pending =
                group.joinRequest?.status === "pending";

              return (
                <article
                  key={group.id}
                  className="groups-reel-card"
                >
                  <div className="groups-reel-card-inner">
                    <div className="groups-reel-avatar">
                      {avatar ? (
                        <img src={avatar.image} alt="" />
                      ) : (
                        <Users size={44} />
                      )}
                    </div>

                    <p className="eyebrow">
                      {group.type === "class"
                        ? "Class"
                        : "Reading Group"}
                    </p>

                    <h1>{group.name}</h1>

                    <p className="groups-reel-meta">
                      {joinPolicyLabel(group)}
                    </p>

                    {group.description && (
                      <p className="groups-reel-description">
                        {group.description}
                      </p>
                    )}

                    <div className="groups-reel-actions">
                      <Link
                        to={`/read/groups/${group.id}`}
                        className="button primary"
                      >
                        {isMember ? "Open" : "View"}
                      </Link>

                      {!isMember && pending && (
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busyId === group.id}
                          onClick={() => cancel(group)}
                        >
                          Cancel Request
                        </button>
                      )}

                      {!isMember &&
                        !pending &&
                        group.joinPolicy !== "invite_only" && (
                          <button
                            type="button"
                            className="button secondary"
                            disabled={busyId === group.id}
                            onClick={() => join(group)}
                          >
                            {group.joinPolicy === "open"
                              ? "Join"
                              : "Request to Join"}
                          </button>
                        )}

                      {!isMember &&
                        group.joinPolicy === "invite_only" && (
                          <span className="groups-invite-only">
                            Invite Only
                          </span>
                        )}
                    </div>

                    <p className="groups-reel-hint">
                      Swipe vertically to explore
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div
            className="groups-reel-dots"
            aria-label={`Group ${selectedIndex + 1} of ${filtered.length}`}
          >
            {filtered
              .slice(
                Math.max(0, selectedIndex - 3),
                Math.min(filtered.length, selectedIndex + 4)
              )
              .map((group, localIndex) => {
                const start = Math.max(0, selectedIndex - 3);
                const index = start + localIndex;

                return (
                  <span
                    key={group.id}
                    className={
                      index === selectedIndex
                        ? "groups-reel-dot active"
                        : "groups-reel-dot"
                    }
                  />
                );
              })}
          </div>
        </>
      )}
    </main>
  );
}
