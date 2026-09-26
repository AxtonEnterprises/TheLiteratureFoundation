import { useEffect, useMemo, useRef, useState } from "react";
import "./SupportCheckout.css";

const TIER_DETAILS = {
  founding_reader: {
    name: "Founding Reader",
    amount: 25
  },
  founding_supporter: {
    name: "Founding Supporter",
    amount: 50
  },
  founding_50: {
    name: "Founding 50",
    amount: 100
  },
  founding_patron: {
    name: "Founding Patron",
    amount: 250
  },
  founding_sponsor: {
    name: "Founding Sponsor",
    amount: 500
  }
};

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

export default function SupportCheckout({
  selectedTier,
  onSelectTier
}) {
  const [customAmount, setCustomAmount] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const checkoutRef = useRef(null);

  const complete =
    new URLSearchParams(window.location.search).get("complete") === "1";

  const selectedDetail = useMemo(
    () => TIER_DETAILS[selectedTier] || null,
    [selectedTier]
  );

  useEffect(() => {
    return () => {
      checkoutRef.current?.destroy?.();
    };
  }, []);

  useEffect(() => {
    setError("");

    if (checkoutRef.current) {
      checkoutRef.current.destroy?.();
      checkoutRef.current = null;
    }

    setCheckoutOpen(false);
  }, [selectedTier]);

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

      if (
        selectedTier === "custom" &&
        (!Number.isFinite(Number(customAmount)) ||
          Number(customAmount) < 5 ||
          Number(customAmount) > 10000)
      ) {
        throw new Error(
          "Enter a contribution between $5 and $10,000."
        );
      }

      await loadStripeJs();

      if (!window.Stripe) {
        throw new Error("Stripe could not be loaded.");
      }

      const stripe = window.Stripe(publishableKey);

      const body =
        selectedTier === "custom"
          ? {
              tier: "custom",
              amount: Number(customAmount)
            }
          : { tier: selectedTier };

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
      <div
        id="contribute"
        className="foundation-checkout-inline foundation-checkout-thanks"
      >
        <p className="foundation-eyebrow">Thank you</p>
        <h3>Your support helps carry literature forward.</h3>
        <p>
          Your payment was submitted through Stripe. Thank you for
          supporting The Literature Foundation and its work in access,
          preservation, reading, education, and Lit Chain.
        </p>
        <a className="foundation-button primary" href="/">
          Return to The Literature Foundation
        </a>
      </div>
    );
  }

  return (
    <div
      id="contribute"
      className="foundation-checkout-inline"
      aria-label="Secure contribution payment"
    >
      <div className="foundation-checkout-inline-top">
        <div>
          <p className="foundation-eyebrow">Secure contribution</p>

          {selectedTier === "custom" ? (
            <>
              <h3>Custom contribution</h3>
              <p>
                Enter the amount you would like to contribute.
              </p>
            </>
          ) : (
            <>
              <h3>
                {selectedDetail?.name || "Choose a contribution level"}
              </h3>
              {selectedDetail && (
                <p>
                  Your selected contribution is{" "}
                  <strong>${selectedDetail.amount}</strong>.
                </p>
              )}
            </>
          )}
        </div>

        <button
          className="foundation-checkout-custom-toggle"
          type="button"
          onClick={() =>
            onSelectTier(
              selectedTier === "custom"
                ? "founding_50"
                : "custom"
            )
          }
        >
          {selectedTier === "custom"
            ? "Use a founding level"
            : "Choose a custom amount"}
        </button>
      </div>

      {selectedTier === "custom" && (
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
            : selectedTier === "custom"
              ? `Continue with $${Number(customAmount) || 0}`
              : `Continue with $${selectedDetail?.amount || ""}`}
        </button>
      </div>

      {error && (
        <p className="foundation-checkout-error" role="alert">
          {error}
        </p>
      )}

      <p className="foundation-checkout-note">
        Payment is securely processed by Stripe without leaving this
        page. The Literature Foundation does not store your card
        information. Contributions are not currently represented as
        tax-deductible.
      </p>

      <div
        id="foundation-support-checkout"
        className={`foundation-checkout-embed ${
          checkoutOpen ? "open" : ""
        }`}
      />
    </div>
  );
}
