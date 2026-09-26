const SUPPORT_PRICE_IDS = {
  founding_reader: "price_1UJhv4ANO1qaeMa4Jmi8dHHZ",
  founding_supporter: "price_1UJhvCANO1qaeMa4xHbPCDzf",
  founding_50: "price_1UJhvDANO1qaeMa4XG5LcTzz",
  founding_patron: "price_1UJhvFANO1qaeMa47zbumeA4",
  founding_sponsor: "price_1UJhvGANO1qaeMa4KRwZtTNc"
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    return json(
      {
        error:
          "Stripe is not configured for The Literature Foundation."
      },
      500
    );
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const tier = String(payload?.tier || "");
  const origin = new URL(request.url).origin;
  const form = new URLSearchParams();

  form.set("mode", "payment");
  form.set("ui_mode", "embedded_page");
  form.set("submit_type", "donate");
  form.set(
    "return_url",
    `${origin}/support?complete=1&session_id={CHECKOUT_SESSION_ID}`
  );
  form.set("billing_address_collection", "auto");
  form.set(
    "payment_intent_data[metadata][purpose]",
    "foundation_support"
  );
  form.set(
    "payment_intent_data[metadata][support_tier]",
    tier || "custom"
  );

  if (tier === "custom") {
    const cents = Math.round(Number(payload?.amount) * 100);

    if (
      !Number.isFinite(cents) ||
      cents < 500 ||
      cents > 1000000
    ) {
      return json(
        {
          error:
            "Enter a contribution between $5 and $10,000."
        },
        400
      );
    }

    form.set(
      "line_items[0][price_data][currency]",
      "usd"
    );
    form.set(
      "line_items[0][price_data][product_data][name]",
      "Custom Contribution"
    );
    form.set(
      "line_items[0][price_data][product_data][metadata][support_tier]",
      "custom"
    );
    form.set(
      "line_items[0][price_data][unit_amount]",
      String(cents)
    );
    form.set("line_items[0][quantity]", "1");
  } else {
    const priceId = SUPPORT_PRICE_IDS[tier];

    if (!priceId) {
      return json({ error: "Unknown support tier." }, 400);
    }

    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
  }

  try {
    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type":
            "application/x-www-form-urlencoded"
        },
        body: form.toString()
      }
    );

    const stripeText = await stripeResponse.text();
    let stripeData = {};

    try {
      stripeData = stripeText
        ? JSON.parse(stripeText)
        : {};
    } catch {
      return json(
        { error: "Stripe returned an invalid response." },
        502
      );
    }

    if (!stripeResponse.ok) {
      return json(
        {
          error:
            stripeData?.error?.message ||
            "Stripe checkout could not be created."
        },
        502
      );
    }

    if (!stripeData.client_secret) {
      return json(
        {
          error:
            "Stripe did not return a Checkout client secret."
        },
        502
      );
    }

    return json({
      clientSecret: stripeData.client_secret
    });
  } catch (error) {
    return json(
      {
        error:
          error?.message || "Unable to contact Stripe."
      },
      502
    );
  }
}

export function onRequest() {
  return json({ error: "Method not allowed." }, 405);
}
