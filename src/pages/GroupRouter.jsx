import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import Group from "./Group.jsx";
import Classroom from "./Classroom.jsx";
import { getGroup } from "../services/storage.js";

export default function GroupRouter() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await getGroup(groupId);
        if (active) setGroup(result);
      } catch (err) {
        console.error("Could not determine group type:", err);
        if (active) setError(err?.message || "We couldn't load this group.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [groupId]);

  if (loading) {
    return (
      <main className="page-wrap">
        <section className="panel">
          <p className="muted">Loading...</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-wrap">
        <section className="panel">
          <p className="status">{error}</p>
        </section>
      </main>
    );
  }

  if (group?.type === "class") {
    return <Classroom initialGroup={group} />;
  }

  return <Group />;
}
