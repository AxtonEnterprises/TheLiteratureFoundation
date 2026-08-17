import { useEffect } from "react";

const SITE_URL = "https://theliteraturefoundation.org";
const DEFAULT_IMAGE =
  `${SITE_URL}/branding/tlf-logo-stacked-web.png`;

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement("meta");

    const [key, name] = attribute;

    element.setAttribute(key, name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", value);
}

export default function SEO({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  type = "website",
  noindex = false
}) {
  useEffect(() => {
    const canonicalUrl = `${SITE_URL}${path}`;

    document.title = title;

    setMeta(
      'meta[name="description"]',
      ["name", "description"],
      description
    );

    setMeta(
      'meta[property="og:title"]',
      ["property", "og:title"],
      title
    );

    setMeta(
      'meta[property="og:description"]',
      ["property", "og:description"],
      description
    );

    setMeta(
      'meta[property="og:type"]',
      ["property", "og:type"],
      type
    );

    setMeta(
      'meta[property="og:url"]',
      ["property", "og:url"],
      canonicalUrl
    );

    setMeta(
      'meta[property="og:image"]',
      ["property", "og:image"],
      image
    );

    setMeta(
      'meta[name="twitter:card"]',
      ["name", "twitter:card"],
      "summary_large_image"
    );

    setMeta(
      'meta[name="twitter:title"]',
      ["name", "twitter:title"],
      title
    );

    setMeta(
      'meta[name="twitter:description"]',
      ["name", "twitter:description"],
      description
    );

    setMeta(
      'meta[name="twitter:image"]',
      ["name", "twitter:image"],
      image
    );

    setMeta(
  'meta[name="robots"]',
  ["name", "robots"],
  noindex ? "noindex, nofollow" : "index, follow"
);

    let canonical =
      document.head.querySelector('link[rel="canonical"]');

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    canonical.setAttribute("href", canonicalUrl);
  }, [title, description, path, image, type, noindex]);

  return null;
}
