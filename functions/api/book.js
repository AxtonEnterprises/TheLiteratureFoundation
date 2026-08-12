function cleanGutenbergText(rawText) {
  if (!rawText) return '';

  let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const startPatterns = [
    /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i,
    /\*\*\*\s*START OF THE PROJECT GUTENBERG EBOOK.*?\*\*\*/i
  ];

  const endPatterns = [
    /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*/i,
    /\*\*\*\s*END OF THE PROJECT GUTENBERG EBOOK[\s\S]*/i
  ];

  for (const pattern of startPatterns) {
    text = text.replace(pattern, '');
  }

  for (const pattern of endPatterns) {
    text = text.replace(pattern, '');
  }

  text = text
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();

  return text;
}

function splitIntoParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0);
}

function detectChapters(paragraphs) {
  const chapterPattern =
    /^(chapter|book|part)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)/i;

  const chapters = [];

  paragraphs.forEach((paragraph, index) => {
    const shortLine = paragraph.length <= 80;
    const looksLikeChapter = chapterPattern.test(paragraph);

    if (shortLine && looksLikeChapter) {
      chapters.push({
        title: paragraph,
        paragraphIndex: index
      });
    }
  });

  return chapters;
}

async function fetchBookText(id) {
  const possibleUrls = [
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`
  ];

  for (const url of possibleUrls) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Random Reads Reader'
      }
    });

    if (response.ok) {
      const text = await response.text();

      if (text && text.trim().length > 100) {
        return {
          sourceUrl: url,
          rawText: text
        };
      }
    }
  }

  throw new Error(`Could not find readable text for book ID ${id}`);
}

export async function onRequestGet(context) {
  const requestUrl = new URL(context.request.url);
  const id = requestUrl.searchParams.get('id');

  if (!id || !/^\d+$/.test(id)) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid book ID' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  try {
    const { sourceUrl, rawText } = await fetchBookText(id);
    const cleanedText = cleanGutenbergText(rawText);
    const paragraphs = splitIntoParagraphs(cleanedText);
    const chapters = detectChapters(paragraphs);

    const payload = {
      id,
      sourceUrl,
      paragraphCount: paragraphs.length,
      characterCount: cleanedText.length,
      chapters,
      paragraphs
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
