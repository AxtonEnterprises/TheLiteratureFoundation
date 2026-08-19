import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import App from "./App.jsx";
import "./styles/global.css";


window.addEventListener(
  "vite:preloadError",
  (event) => {
    event.preventDefault();

    window.location.reload();
  }
);


registerSW({
  immediate: true,

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
