import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  cancelGroupJoinRequest,
  getDiscoverableGroups,
  getMyGroups,
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
  const navigate = useNavigate();
  const [myGroups, setMyGroups] = useState([]);
  const [discoverGroups, setDiscoverGroups] = useState([]);
  const [view, setView] = useState("mine");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [status, setStatus] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [groupSwipeStart, setGroupSwipeStart] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setStatus("");

      const [mine, discoverable] = await Promise.all([
        getMyGroups(),
        getDiscoverableGroups()
      ]);

      setMyGroups(mine);
      setDiscoverGroups(discoverable);
    } catch (error) {
      console.error("Could not load groups:", error);
      setStatus(error?.message || "We couldn't load groups.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const source =
      view === "mine"
        ? myGroups.filter((group) => group.type !== "class")
        : view === "classes"
          ? myGroups.filter((group) => group.type === "class")
          : discoverGroups;
    const term = search.trim().toLowerCase();

    if (!term) return source;

    return source.filter((group) =>
      [group.name, group.description, group.type]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(term)
        )
    );
  }, [view, myGroups, discoverGroups, search]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [view, search]);

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
      setStatus(error?.message || "We couldn't join that group.");
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
      setStatus(error?.message || "We couldn't cancel that request.");
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
      Math.max(0, Math.min(groups.length - 1, next))
    );
  }

  function handleGroupSwipeStart(event, group) {
    if (!group?.membership) return;

    const touch = event.touches?.[0];
    if (!touch) return;

    setGroupSwipeStart({
      groupId: group.id,
      x: touch.clientX,
      y: touch.clientY
    });
  }

  function handleGroupSwipeEnd(event, group) {
    if (
      !group?.membership ||
      !groupSwipeStart ||
      groupSwipeStart.groupId !== group.id
    ) {
      setGroupSwipeStart(null);
      return;
    }

    const touch = event.changedTouches?.[0];
    if (!touch) {
      setGroupSwipeStart(null);
      return;
    }

    const deltaX = touch.clientX - groupSwipeStart.x;
    const deltaY = touch.clientY - groupSwipeStart.y;
    setGroupSwipeStart(null);

    // Do not interfere with the vertical group reel.
    if (Math.abs(deltaX) < 70 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    // Same spatial grammar as The Chain: left = deeper/open.
    if (deltaX < 0) {
      navigate(`/read/groups/${group.id}`);
    }
  }

  return (
    <main className="groups-home-page">
      <SEO
        title="Groups | Lit Chain"
        description="Explore your Lit Chain groups and discover new reading communities."
        path="/read/groups"
        noindex
      />

      <div className="groups-home-filter-wrap">
        <div className="groups-home-filter" role="tablist" aria-label="Groups view">
          <button
            type="button"
            className={view === "mine" ? "active" : ""}
            onClick={() => setView("mine")}
          >
            My Groups
          </button>
          <button
            type="button"
            className={view === "classes" ? "active" : ""}
            onClick={() => setView("classes")}
          >
            My Classes
          </button>
          <button
            type="button"
            className={view === "discover" ? "active" : ""}
            onClick={() => setView("discover")}
          >
            Discover
          </button>
        </div>

        <button
          type="button"
          className={searchOpen ? "groups-home-search-toggle active" : "groups-home-search-toggle"}
          onClick={() => setSearchOpen((current) => !current)}
          aria-label="Search groups"
          title="Search groups"
        >
          <Search size={17} />
        </button>
      </div>

      {searchOpen && (
        <div className="groups-home-search">
          <Search size={16} />
          <input
            autoFocus
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              view === "mine"
                ? "Search my groups..."
                : view === "classes"
                  ? "Search my classes..."
                  : "Search groups..."
            }
          />
        </div>
      )}

      {status && <p className="status groups-home-status">{status}</p>}

      {loading ? (
        <section className="groups-home-empty">
          <p className="muted">Loading groups...</p>
        </section>
      ) : groups.length === 0 ? (
        <section className="groups-home-empty">
          <Users size={36} />
          <h2>
            {view === "mine"
              ? "No groups yet"
              : view === "classes"
                ? "No classes yet"
                : "No groups found"}
          </h2>
          <p className="muted">
            {view === "mine"
              ? "Switch to Discover to find a reading group."
              : view === "classes"
                ? "Classes you join or teach will appear here."
                : "No discoverable groups match your search."}
          </p>
          {view === "mine" && (
            <button
              type="button"
              className="button primary"
              onClick={() => setView("discover")}
            >
              Discover Groups
            </button>
          )}
        </section>
      ) : (
        <>
          <div className="groups-home-reels" onScroll={handleScroll}>
            {groups.map((group) => {
              const avatar = getGroupAvatar(group.avatar);
              const isMember = Boolean(group.membership);
              const pending = group.joinRequest?.status === "pending";

              return (
                <article
                  key={group.id}
                  className="groups-home-reel"
                  onTouchStart={(event) => handleGroupSwipeStart(event, group)}
                  onTouchEnd={(event) => handleGroupSwipeEnd(event, group)}
                >
                  <div className="groups-home-card">
                    <div className="groups-home-avatar">
                      {avatar ? (
                        <img src={avatar.image} alt="" />
                      ) : (
                        <Users size={46} />
                      )}
                    </div>

                    <p className="eyebrow">
                      {group.type === "class" ? "Class" : "Reading Group"}
                    </p>

                    <h1>{group.name}</h1>

                    <p className="groups-home-meta">
                      {isMember
                        ? group.membership?.role || "Member"
                        : joinPolicyLabel(group)}
                    </p>

                    {group.description && (
                      <p className="groups-home-description">
                        {group.description}
                      </p>
                    )}

                    {isMember && (
                      <p className="groups-home-swipe-hint">
                        Swipe left to open
                      </p>
                    )}

                    <div className="groups-home-actions">
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
                    </div>

                    <p className="groups-home-swipe-hint">
                      Swipe vertically for another group
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="groups-home-dots" aria-hidden="true">
            {groups
              .slice(
                Math.max(0, selectedIndex - 3),
                Math.min(groups.length, selectedIndex + 4)
              )
              .map((group, localIndex) => {
                const start = Math.max(0, selectedIndex - 3);
                const index = start + localIndex;
                return (
                  <span
                    key={group.id}
                    className={index === selectedIndex ? "active" : ""}
                  />
                );
              })}
          </div>
        </>
      )}
    </main>
  );
}
