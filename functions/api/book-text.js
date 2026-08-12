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

  for (const bookUrl of possibleUrls) {
    const response = await fetch(bookUrl, {
      headers: {
        'User-Agent': 'Random Reads Reader'
      }
    });

    if (response.ok) {
      const text = await response.text();

      if (text && text.trim().length > 100) {
        return new Response(text, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }
    }
  }

  return new Response(`Could not find readable text for book ID ${id}`, {
    status: 404
  });
}
