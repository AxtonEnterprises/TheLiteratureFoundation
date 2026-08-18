const MAX_CHUNK_LENGTH = 750;

export function paginateParagraphs({
  paragraphs,
  containerWidth,
  containerHeight,
  fontSize,
  className = ""
}) {
  if (
    !paragraphs?.length ||
    !containerWidth ||
    !containerHeight
  ) {
    return [];
  }

  const readableBlocks =
    splitLongParagraphs(paragraphs);

  const measurer =
    document.createElement("article");

  measurer.className = className;
  measurer.style.position = "absolute";
  measurer.style.visibility = "hidden";
  measurer.style.pointerEvents = "none";
  measurer.style.left = "-9999px";
  measurer.style.top = "0";
  measurer.style.width =
    `${containerWidth}px`;
  measurer.style.height =
    `${containerHeight}px`;
  measurer.style.fontSize =
    `${fontSize}px`;
  measurer.style.overflow = "hidden";

  document.body.appendChild(
    measurer
  );

  const pages = [];

  let currentPage = [];
  let currentStartIndex = 0;

  for (
    let index = 0;
    index < readableBlocks.length;
    index += 1
  ) {
    const block =
      readableBlocks[index];

    const testPage = [
      ...currentPage,
      block
    ];

    measurer.innerHTML =
      testPage
        .map(
          (item) =>
            `<p>${escapeHtml(
              item.text
            )}</p>`
        )
        .join("");

    const fits =
      measurer.scrollHeight <=
      measurer.clientHeight;

    if (
      !fits &&
      currentPage.length
    ) {
      pages.push({
        startIndex:
          currentStartIndex,

        startParagraphIndex:
          currentPage[0]
            .paragraphIndex,

        blocks:
          currentPage
      });

      currentPage = [
        block
      ];

      currentStartIndex =
        index;
    } else {
      currentPage =
        testPage;
    }
  }

  if (
    currentPage.length
  ) {
    pages.push({
      startIndex:
        currentStartIndex,

      startParagraphIndex:
        currentPage[0]
          .paragraphIndex,

      blocks:
        currentPage
    });
  }

  document.body.removeChild(
    measurer
  );

  return pages;
}


function splitLongParagraphs(
  paragraphs
) {
  const blocks = [];

  paragraphs.forEach(
    (
      paragraph,
      paragraphIndex
    ) => {
      if (
        paragraph.length <=
        MAX_CHUNK_LENGTH
      ) {
        blocks.push({
          text: paragraph,
          paragraphIndex,
          isContinuation: false
        });

        return;
      }

      const sentences =
        paragraph.match(
          /[^.!?]+[.!?]+["”']?|.+$/g
        ) || [paragraph];

      let chunk = "";
      let chunkNumber = 0;

      for (
        const sentence
        of sentences
      ) {
        const nextChunk =
          `${chunk} ${sentence}`
            .trim();

        if (
          nextChunk.length >
            MAX_CHUNK_LENGTH &&
          chunk
        ) {
          blocks.push({
            text: chunk,

            paragraphIndex,

            isContinuation:
              chunkNumber > 0
          });

          chunk =
            sentence.trim();

          chunkNumber += 1;
        } else {
          chunk =
            nextChunk;
        }
      }

      if (chunk) {
        blocks.push({
          text: chunk,

          paragraphIndex,

          isContinuation:
            chunkNumber > 0
        });
      }
    }
  );

  return blocks;
}


function escapeHtml(text) {
  return String(text)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}
