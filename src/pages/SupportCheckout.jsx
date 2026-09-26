import { useEffect, useRef, useState } from "react";
import "./SupportCheckout.css";

const TIERS = [
  {
    key: "founding_reader",
    name: "Founding Reader",
    amount: 25,
    blurb: "Help put another brick in the foundation."
  },
  {
    key: "founding_supporter",
    name: "Founding Supporter",
    amount: 50,
    blurb: "Support free literature and educational tools."
  },
  {
    key: "founding_50",
    name: "Founding 50",
    amount: 100,
    blurb: "Become one of the first 50 people to help officially launch the Foundation."
  },
  {
    key: "founding_patron",
    name: "Founding Patron",
    amount: 250,
    blurb: "Provide substantial support toward our launch and technology."
  },
  {
    key: "founding_sponsor",
    name: "Founding Sponsor",
    amount: 500,
    blurb: "For individuals, families, and businesses making a major early contribution."
  }
];

function loadStripeJs() {
  if (window.Stripe) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://js.stripe.com/v3/"]'
    );

    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function readApiResponse(response) {
  const text = await response.text();

  if (!text) {
    throw new Error(
      `Payment service returned an empty response (HTTP ${response.status}).`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Payment service returned an invalid response (HTTP ${response.status}).`
    );
  }
}

export default function SupportCheckout() {
  const [selected, setSelected] = useState("founding_50");
  const [customAmount, setCustomAmount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const checkoutRef = useRef(null);

  const complete =
    new URLSearchParams(window.location.search).get("complete") === "1";

  useEffect(() => {
    return () => {
      checkoutRef.current?.destroy?.();
    };
  }, []);

  async function beginCheckout() {
    setError("");
    setLoading(true);

    try {
      const publishableKey =
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

      if (!publishableKey) {
        throw new Error(
          "Stripe publishable key is not configured for The Literature Foundation."
        );
      }

      await loadStripeJs();

      if (!window.Stripe) {
        throw new Error("Stripe could not be loaded.");
      }

      const stripe = window.Stripe(publishableKey);

      const body =
        selected === "custom"
          ? {
              tier: "custom",
              amount: Number(customAmount)
            }
          : { tier: selected };

      const response = await fetch("/api/create-support-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await readApiResponse(response);

      if (!response.ok || !data.clientSecret) {
        throw new Error(
          data?.error || "Unable to start secure checkout."
        );
      }

      checkoutRef.current?.destroy?.();

      checkoutRef.current =
        await stripe.initEmbeddedCheckout({
          clientSecret: data.clientSecret
        });

      setCheckoutOpen(true);

      requestAnimationFrame(() => {
        checkoutRef.current?.mount?.(
          "#foundation-support-checkout"
        );

        document
          .getElementById("foundation-support-checkout")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
      });
    } catch (err) {
      setError(
        err?.message || "Unable to start secure checkout."
      );
    } finally {
      setLoading(false);
    }
  }

  if (complete) {
    return (
      <section
        id="contribute"
        className="foundation-checkout-section foundation-checkout-thanks"
      >
        <p className="foundation-eyebrow">Thank you</p>
        <h2>Your support helps carry literature forward.</h2>
        <p>
          Your payment was submitted through Stripe. Thank you for
          supporting The Literature Foundation and its work in access,
          preservation, reading, education, and Lit Chain.
        </p>
        <a className="foundation-button primary" href="/">
          Return to The Literature Foundation
        </a>
      </section>
    );
  }

  return (
    <section
      id="contribute"
      className="foundation-checkout-section"
      aria-labelledby="foundation-checkout-heading"
    >
      <div className="foundation-checkout-heading">
        <p className="foundation-eyebrow">
          Make your contribution
        </p>
        <h2 id="foundation-checkout-heading">
          Choose your founding level.
        </h2>
        <p>
          Select a level or enter your own amount. Payment is securely
          processed by Stripe without leaving The Literature Foundation.
        </p>
      </div>

      <div
        className="foundation-checkout-tier-grid"
        aria-label="Contribution levels"
      >
        {TIERS.map((tier) => (
          <button
            key={tier.key}
            type="button"
            className={`foundation-checkout-tier ${
              selected === tier.key ? "selected" : ""
            } ${tier.key === "founding_50" ? "featured" : ""}`}
            onClick={() => setSelected(tier.key)}
            aria-pressed={selected === tier.key}
          >
            {tier.key === "founding_50" && (
              <span className="foundation-checkout-badge">
                Founding 50
              </span>
            )}
            <span className="foundation-checkout-tier-name">
              {tier.name}
            </span>
            <strong>${tier.amount}</strong>
            <span className="foundation-checkout-tier-copy">
              {tier.blurb}
            </span>
          </button>
        ))}

        <button
          type="button"
          className={`foundation-checkout-tier ${
            selected === "custom" ? "selected" : ""
          }`}
          onClick={() => setSelected("custom")}
          aria-pressed={selected === "custom"}
        >
          <span className="foundation-checkout-tier-name">
            Custom Contribution
          </span>
          <strong>Your amount</strong>
          <span className="foundation-checkout-tier-copy">
            Choose an amount that works for you.
          </span>
        </button>
      </div>

      {selected === "custom" && (
        <label className="foundation-checkout-amount">
          <span>Amount (USD)</span>
          <input
            type="number"
            min="5"
            max="10000"
            step="1"
            inputMode="decimal"
            value={customAmount}
            onChange={(event) =>
              setCustomAmount(event.target.value)
            }
          />
        </label>
      )}

      <div className="foundation-checkout-action-row">
        <button
          className="foundation-button gold foundation-checkout-button"
          type="button"
          disabled={loading}
          onClick={beginCheckout}
        >
          {loading
            ? "Opening secure payment…"
            : "Continue to secure payment"}
        </button>
      </div>

      {error && (
        <p className="foundation-checkout-error" role="alert">
          {error}
        </p>
      )}

      <p className="foundation-checkout-note">
        The Literature Foundation does not store your card information.
        Stripe handles payment details securely. Contributions are not
        currently represented as tax-deductible.
      </p>

      <div
        id="foundation-support-checkout"
        className={`foundation-checkout-embed ${
          checkoutOpen ? "open" : ""
        }`}
      />
    </section>
  );
}
