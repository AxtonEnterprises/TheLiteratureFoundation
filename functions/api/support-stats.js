const CAMPAIGN_START_UNIX = 1790294400;
const MAX_PAGES = 100;

function json(payload, status = 200, cacheSeconds = 0) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8"
  };

  if (cacheSeconds > 0) {
    headers["Cache-Control"] =
      `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=60`;
  } else {
    headers["Cache-Control"] = "no-store";
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers
  });
}

async function fetchPaymentIntentPage(
  secretKey,
  startingAfter
) {
  const params = new URLSearchParams();

  params.set("limit", "100");
  params.set(
    "created[gte]",
    String(CAMPAIGN_START_UNIX)
  );
  params.append(
    "expand[]",
    "data.latest_charge"
  );

  if (startingAfter) {
    params.set(
      "starting_after",
      startingAfter
    );
  }

  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents?${params.toString()}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`
      }
    }
  );

  const bodyText = await response.text();

  let data = {};

  try {
    data = bodyText
      ? JSON.parse(bodyText)
      : {};
  } catch {
    throw new Error(
      "Stripe returned an invalid response."
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Stripe returned HTTP ${response.status}.`
    );
  }

  return data;
}

function netContributionCents(paymentIntent) {
  const latestCharge =
    paymentIntent?.latest_charge;

  if (
    latestCharge &&
    typeof latestCharge === "object" &&
    Number.isFinite(
      Number(latestCharge.amount)
    )
  ) {
    const amount =
      Number(latestCharge.amount) || 0;
    const refunded =
      Number(
        latestCharge.amount_refunded
      ) || 0;

    return Math.max(
      0,
      amount - refunded
    );
  }

  return Math.max(
    0,
    Number(
      paymentIntent?.amount_received
    ) || 0
  );
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.STRIPE_SECRET_KEY) {
    return json(
      {
        error:
          "Stripe is not configured for The Literature Foundation."
      },
      500
    );
  }

  try {
    let startingAfter = null;
    let raisedCents = 0;
    let founding50Filled = 0;
    let contributionCount = 0;

    for (
      let pageNumber = 0;
      pageNumber < MAX_PAGES;
      pageNumber += 1
    ) {
      const page =
        await fetchPaymentIntentPage(
          env.STRIPE_SECRET_KEY,
          startingAfter
        );

      const paymentIntents =
        Array.isArray(page?.data)
          ? page.data
          : [];

      for (
        const paymentIntent
        of paymentIntents
      ) {
        if (
          paymentIntent?.status !==
          "succeeded"
        ) {
          continue;
        }

        if (
          paymentIntent?.metadata?.purpose !==
          "foundation_support"
        ) {
          continue;
        }

        const netCents =
          netContributionCents(
            paymentIntent
          );

        if (netCents <= 0) {
          continue;
        }

        raisedCents += netCents;
        contributionCount += 1;

        if (
          paymentIntent?.metadata
            ?.support_tier ===
          "founding_50"
        ) {
          founding50Filled += 1;
        }
      }

      if (
        !page?.has_more ||
        paymentIntents.length === 0
      ) {
        break;
      }

      startingAfter =
        paymentIntents[
          paymentIntents.length - 1
        ]?.id || null;

      if (!startingAfter) {
        break;
      }
    }

    return json(
      {
        raisedCents,
        raised:
          raisedCents / 100,
        founding50Filled,
        founding50Remaining:
          Math.max(
            0,
            50 - founding50Filled
          ),
        contributionCount,
        goalCents: 500000,
        updatedAt:
          new Date().toISOString()
      },
      200,
      15
    );
  } catch (error) {
    return json(
      {
        error:
          error?.message ||
          "Unable to retrieve contribution totals."
      },
      502
    );
  }
}

export function onRequest() {
  return json(
    { error: "Method not allowed." },
    405
  );
}
