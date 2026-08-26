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

export default function DiscoverGroups() {
  const [groups, setGroups] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [status, setStatus] = useState("");

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

  return (
    <main className="page-wrap">
      <SEO
        title="Discover Groups | Random Reads"
        description="Find public and discoverable reading groups."
        path="/read/groups"
        noindex
      />

      <div className="stack-lg">
        <section className="hero-card small">
          <p className="eyebrow">Reading Communities</p>
          <h1>Discover Groups</h1>
          <p className="muted">
            Find reading groups and classes that are open to new readers.
          </p>
        </section>

        <section className="panel profile-panel">
          <div className="group-discovery-search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search groups..."
            />
          </div>
        </section>

        {status && <p className="status">{status}</p>}

        {loading ? (
          <section className="panel profile-panel">
            <p className="muted">Loading groups...</p>
          </section>
        ) : filtered.length === 0 ? (
          <section className="panel profile-panel">
            <p className="muted">
              No groups match your search yet.
            </p>
          </section>
        ) : (
          <div className="group-discovery-grid">
            {filtered.map((group) => {
              const avatar = getGroupAvatar(group.avatar);
              const isMember = Boolean(group.membership);
              const pending =
                group.joinRequest?.status === "pending";

              return (
                <article
                  key={group.id}
                  className="panel group-discovery-card"
                >
                  <div className="group-discovery-heading">
                    <div className="group-discovery-avatar">
                      {avatar ? (
                        <img src={avatar.image} alt="" />
                      ) : (
                        <Users size={28} />
                      )}
                    </div>

                    <div>
                      <Link
                        to={`/read/groups/${group.id}`}
                        className="public-entry-book-title"
                      >
                        {group.name}
                      </Link>

                      <p className="muted group-discovery-meta">
                        {group.type === "class" ? "Class" : "Reading Group"}
                        {" · "}
                        {group.joinPolicy === "open"
                          ? "Open"
                          : group.joinPolicy === "request_to_join"
                            ? "Request to join"
                            : "Invite only"}
                      </p>
                    </div>
                  </div>

                  {group.description && (
                    <p>{group.description}</p>
                  )}

                  <div className="button-row">
                    {isMember ? (
                      <Link
                        to={`/read/groups/${group.id}`}
                        className="button primary"
                      >
                        Open Group
                      </Link>
                    ) : pending ? (
                      <>
                        <span className="button secondary">
                          Request Pending
                        </span>

                        <button
                          type="button"
                          className="button secondary"
                          disabled={busyId === group.id}
                          onClick={() => cancel(group)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : group.joinPolicy === "invite_only" ? (
                      <span className="button secondary">
                        Invite Only
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="button primary"
                        disabled={busyId === group.id}
                        onClick={() => join(group)}
                      >
                        {group.joinPolicy === "open"
                          ? "Join Group"
                          : "Request to Join"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
