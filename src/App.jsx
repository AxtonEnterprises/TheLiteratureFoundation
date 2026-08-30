import { useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";

import { db } from "./firebase";

import Header from "./components/Header";
import FoundationHome from "./pages/FoundationHome";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Reader from "./pages/Reader";
import Journal from "./pages/Journal";
import About from "./pages/About";
import Login from "./pages/Login";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Profile from "./pages/Profile";
import Chain from "./pages/Chain";
import NotFound from "./pages/NotFound.jsx";
import PublicProfile from "./pages/PublicProfile";
import GroupRouter from "./pages/GroupRouter";
import Notifications from "./pages/Notifications";
import DiscoverGroups from "./pages/DiscoverGroups";

export default function App() {
  const location = useLocation();

  const isLitChain =
    location.pathname === "/read" ||
    location.pathname.startsWith("/read/");

  useEffect(() => {
    async function testFirebase() {
      try {
        const snap = await getDoc(
          doc(db, "test", "welcome")
        );

        if (snap.exists()) {
          console.log(
            "Firebase connected:",
            snap.data()
          );
        }
      } catch (err) {
        console.error(
          "Firebase error:",
          err
        );
      }
    }

    testFirebase();
  }, []);

  return (
    <>
      {isLitChain && <Header />}

      <main
        className={
          isLitChain
            ? "app-main random-reads-app"
            : "foundation-app"
        }
      >
        <Routes>
          <Route
            path="/"
            element={<FoundationHome />}
          />

          {/* Lit Chain is now the app home. */}
          <Route
            path="/read"
            element={<Chain />}
          />

          {/* The former Home page is now Discover. */}
          <Route
            path="/read/discover"
            element={<Home />}
          />

          <Route
            path="/read/search"
            element={<Search />}
          />

          <Route
            path="/read/reader/:id"
            element={<Reader />}
          />

          <Route
            path="/read/journal"
            element={<Journal />}
          />

          <Route
            path="/read/profile"
            element={<Profile />}
          />

          <Route
            path="/read/notifications"
            element={<Notifications />}
          />

          <Route
            path="/read/public/:userId"
            element={<PublicProfile />}
          />

          <Route
            path="/read/about"
            element={<About />}
          />

          <Route
            path="/read/login"
            element={<Login />}
          />

          {/* Compatibility route for old Chain links. */}
          <Route
            path="/read/chain"
            element={
              <Navigate
                to="/read"
                replace
              />
            }
          />

          <Route
            path="/read/groups"
            element={<DiscoverGroups />}
          />

          <Route
            path="/read/groups/:groupId"
            element={<GroupRouter />}
          />

          {/* Compatibility redirects for former standalone routes. */}
          <Route
            path="/search"
            element={
              <Navigate
                to="/read/search"
                replace
              />
            }
          />

          <Route
            path="/reader/:id"
            element={<LegacyReaderRedirect />}
          />

          <Route
            path="/journal"
            element={
              <Navigate
                to="/read/journal"
                replace
              />
            }
          />

          <Route
            path="/login"
            element={
              <Navigate
                to="/read/login"
                replace
              />
            }
          />

          <Route
            path="/about"
            element={
              <Navigate
                to="/read/about"
                replace
              />
            }
          />

          <Route
            path="/privacy"
            element={<Privacy />}
          />

          <Route
            path="/terms"
            element={<Terms />}
          />

          <Route
            path="*"
            element={<NotFound />}
          />
        </Routes>
      </main>
    </>
  );
}

function LegacyReaderRedirect() {
  const id = window.location.pathname
    .split("/")
    .filter(Boolean)
    .pop();

  return (
    <Navigate
      to={`/read/reader/${id}`}
      replace
    />
  );
}
