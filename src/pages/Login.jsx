import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup
} from "firebase/auth";

import { auth } from "../firebase";
import "./Login.css";
import SEO from "../components/SEO.jsx";

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

export default function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function getAuthErrorMessage(error) {
    console.error("Firebase authentication error:", error);

    switch (error?.code) {
      case "auth/invalid-email":
        return "Please enter a valid email address.";

      case "auth/missing-password":
        return "Please enter your password.";

      case "auth/weak-password":
        return "Your password must be at least 6 characters.";

      case "auth/email-already-in-use":
        return "An account already exists with this email address.";

      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Incorrect email or password.";

      case "auth/popup-closed-by-user":
        return "Google sign-in was closed before it finished.";

      case "auth/popup-blocked":
        return "Your browser blocked the Google sign-in window. Allow popups and try again.";

      case "auth/cancelled-popup-request":
        return "The Google sign-in request was cancelled. Please try again.";

      case "auth/unauthorized-domain":
        return "This website is not authorized for Google sign-in in Firebase.";

      case "auth/operation-not-allowed":
        return "This sign-in method is not enabled in Firebase.";

      case "auth/network-request-failed":
        return "A network error occurred. Check your connection and try again.";

      case "auth/too-many-requests":
        return "Too many sign-in attempts. Please wait and try again.";

      default:
        return error?.message || "Authentication failed. Please try again.";
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();

    if (loading) return;

    const cleanedEmail = email.trim();

    if (!cleanedEmail) {
      setStatus("Please enter your email address.");
      return;
    }

    if (!password) {
      setStatus("Please enter your password.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await setPersistence(auth, browserLocalPersistence);

      if (mode === "register") {
        await createUserWithEmailAndPassword(
          auth,
          cleanedEmail,
          password
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          cleanedEmail,
          password
        );
      }

      navigate("/read");
    } catch (error) {
      setStatus(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (loading) return;

    setLoading(true);
    setStatus("");

    try {
      await setPersistence(auth, browserLocalPersistence);

      await signInWithPopup(auth, googleProvider);

      navigate("/read");
    } catch (error) {
      setStatus(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function handleModeSwitch() {
    setMode((currentMode) =>
      currentMode === "login" ? "register" : "login"
    );

    setPassword("");
    setStatus("");
  }

  return (
    <main className="login-page">
      <SEO
  title="Log In | Random Reads"
  description="Log in to Random Reads to save books, reading progress, and journal entries."
  path="/read/login"
/>
      <section className="login-card">

        <p className="login-eyebrow">
          Random Reads
        </p>

        <h1>
          {mode === "login"
            ? "Welcome Back"
            : "Create an Account"}
        </h1>

        <p className="login-description">
          {mode === "login"
            ? "Log in to continue your reading journey."
            : "Create an account to save your books, reading progress, and journal entries."}
        </p>

        <form
          className="login-form"
          onSubmit={handleEmailSubmit}
        >
          <label htmlFor="email">
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            placeholder="you@example.com"
            autoComplete="email"
            disabled={loading}
            required
          />

          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder={
              mode === "register"
                ? "At least 6 characters"
                : "Enter your password"
            }
            autoComplete={
              mode === "register"
                ? "new-password"
                : "current-password"
            }
            minLength={
              mode === "register" ? 6 : undefined
            }
            disabled={loading}
            required
          />

          <button
            type="submit"
            className="login-primary-button"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log In"
                : "Create Account"}
          </button>
        </form>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="login-google-button"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          Continue with Google
        </button>

        {status && (
          <div
            className="login-status"
            role="alert"
          >
            {status}
          </div>
        )}

        <div className="login-switch">
          <span>
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>

          <button
            type="button"
            onClick={handleModeSwitch}
            disabled={loading}
          >
            {mode === "login"
              ? "Create Account"
              : "Log In"}
          </button>
        </div>

      </section>
    </main>
  );
}
