import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import App from "./App.jsx";
import "./styles/global.css";


/*
 * Recover from stale Vite chunks after a deployment.
 *
 * If an old cached page references a JS chunk that no
 * longer exists, reload so the browser gets the current
 * index.html and current asset filenames.
 */
window.addEventListener(
  "vite:preloadError",
  (event) => {
    event.preventDefault();

    window.location.reload();
  }
);


const updateSW =
  registerSW({
    immediate: true,

    onNeedRefresh() {
      updateSW(true);
    },

    onOfflineReady() {
      console.log(
        "Random Reads is ready for offline use."
      );
    },

    onRegisterError(error) {
      console.error(
        "Service worker registration failed:",
        error
      );
    }
  });


ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
