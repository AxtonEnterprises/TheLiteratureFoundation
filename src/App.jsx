import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import FoundationHome from "./pages/FoundationHome";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import NotFound from "./pages/NotFound.jsx";

const LIT_CHAIN_URL = "https://litchain.org";

export default function App() {
  return (
    <main className="foundation-app">
      <Routes>
        <Route path="/" element={<FoundationHome />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />

        {/* Legacy Lit Chain routes now live on litchain.org. */}
        <Route path="/read/*" element={<LitChainRedirect />} />

        {/* Legacy standalone app routes. */}
        <Route path="/search" element={<ExternalRedirect to={`${LIT_CHAIN_URL}/read/search`} />} />
        <Route path="/reader/:id" element={<LegacyReaderRedirect />} />
        <Route path="/journal" element={<ExternalRedirect to={`${LIT_CHAIN_URL}/read/journal`} />} />
        <Route path="/login" element={<ExternalRedirect to={LIT_CHAIN_URL} />} />
        <Route path="/about" element={<Navigate to="/#about-foundation" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
  );
}

function LitChainRedirect() {
  const location = useLocation();
  const destination = `${LIT_CHAIN_URL}${location.pathname}${location.search}${location.hash}`;
  window.location.replace(destination);
  return null;
}

function LegacyReaderRedirect() {
  const location = useLocation();
  const id = location.pathname.split("/").filter(Boolean).pop();
  window.location.replace(`${LIT_CHAIN_URL}/read/reader/${id}`);
  return null;
}

function ExternalRedirect({ to }) {
  window.location.replace(to);
  return null;
}
