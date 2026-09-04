import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowRight, LogIn, Users } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { auth } from "../firebase";
import SEO from "../components/SEO.jsx";
import {
  acceptGroupShareInvite,
  getGroupShareInvite
} from "../services/storage.js";

export default function JoinInvite() {
  const { token } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState(auth.currentUser);
  const [authLoading, setAuthLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      sessionStorage.setItem(
        "litChain.pendingInvitePath",
        location.pathname
      );
      setInvite(null);
      return;
    }

    let active = true;

    async function loadInvite() {
      try {
        setLoading(true);
        setStatus("");
        const loaded = await getGroupShareInvite(token);

        if (!active) return;

        setInvite(loaded);

        if (!loaded) {
          setStatus("This invitation link is invalid or no longer active.");
        }
      } catch (error) {
        if (!active) return;
        console.error("Could not load invitation:", error);
        setStatus(error?.message || "We couldn't load this invitation.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInvite();

    return () => {
      active = false;
    };
  }, [authLoading, user?.uid, token, location.pathname]);

  async function join() {
    try {
      setJoining(true);
      setStatus("");

      const result = await acceptGroupShareInvite(token);

      sessionStorage.removeItem("litChain.pendingInvitePath");

      navigate(`/read/groups/${result.groupId}`, {
        replace: true
      });
    } catch (error) {
      console.error("Could not accept invitation:", error);
      setStatus(error?.message || "We couldn't join this group.");
    } finally {
      setJoining(false);
    }
  }

  const entityLabel =
    invite?.group?.type === "class" ? "class" : "group";

  if (authLoading) {
    return (
      <main className="page-wrap">
        <section className="hero-card small">
          <h1>Opening invitation...</h1>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-wrap">
        <SEO
          title="Join | Lit Chain"
          description="Open a Lit Chain invitation."
          path={location.pathname}
          noindex
        />

        <section className="hero-card small">
          <p className="eyebrow">Lit Chain Invitation</p>
          <h1>Log in to continue</h1>
          <p>
            Your invitation will be waiting after you log in or create an account.
          </p>

          <Link to="/read/login" className="button primary large">
            <LogIn size={18} />
            Log In or Sign Up
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-wrap">
      <SEO
        title="Join | Lit Chain"
        description="Join a Lit Chain group or class."
        path={location.pathname}
        noindex
      />

      <section className="hero-card small">
        <p className="eyebrow">Lit Chain Invitation</p>

        {loading ? (
          <h1>Opening invitation...</h1>
        ) : invite ? (
          <>
            <Users size={34} />
            <h1>{invite.group?.name || `Join this ${entityLabel}`}</h1>

            {invite.group?.description && (
              <p>{invite.group.description}</p>
            )}

            {invite.membership &&
            !["removed", "suspended"].includes(invite.membership.status) ? (
              <button
                type="button"
                className="button primary large"
                onClick={() =>
                  navigate(`/read/groups/${invite.groupId}`)
                }
              >
                Open {entityLabel}
                <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="button primary large"
                onClick={join}
                disabled={joining}
              >
                {joining
                  ? "Joining..."
                  : `Join ${entityLabel === "class" ? "Class" : "Group"}`}
                {!joining && <ArrowRight size={18} />}
              </button>
            )}
          </>
        ) : (
          <h1>Invitation unavailable</h1>
        )}

        {status && <p className="status">{status}</p>}
      </section>
    </main>
  );
}
