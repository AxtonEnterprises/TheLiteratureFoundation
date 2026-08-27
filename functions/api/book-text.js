async function tryBookUrl(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Random Reads Reader' }
  });

  if (!response.ok) throw new Error(`Book source returned ${response.status}`);

  const text = await response.text();
  if (!text || text.trim().length <= 100) throw new Error('Book source was empty');

  return text;
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const id = requestUrl.searchParams.get('id');

  if (!id || !/^\d+$/.test(id)) {
    return new Response('Missing or invalid book ID', { status: 400 });
  }

  const possibleUrls = [
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`
  ];

  try {
    const text = await Promise.any(possibleUrls.map(tryBookUrl));

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=2592000, stale-while-revalidate=604800'
      }
    });
  } catch {
    return new Response(`Could not find readable text for book ID ${id}`, {
      status: 404
    });
  }
}
