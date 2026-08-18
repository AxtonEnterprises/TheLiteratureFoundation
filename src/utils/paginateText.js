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

  const measurer =
    document.createElement("article");

  measurer.className = className;

  measurer.style.position =
    "absolute";

  measurer.style.visibility =
    "hidden";

  measurer.style.pointerEvents =
    "none";

  measurer.style.left =
    "-9999px";

  measurer.style.top = "0";

  measurer.style.width =
    `${containerWidth}px`;

  measurer.style.height =
    `${containerHeight}px`;

  measurer.style.fontSize =
    `${fontSize}px`;

  measurer.style.overflow =
    "hidden";

  document.body.appendChild(
    measurer
  );

  /*
   * First preserve the original paragraph index.
   */
  const initialBlocks =
    splitLongParagraphs(
      paragraphs
    );

  /*
   * Then dynamically split any individual block
   * that is still too tall for the actual reader.
   */
  const readableBlocks = [];

  for (
    const block
    of initialBlocks
  ) {
    const fitted =
      splitBlockToFit(
        block,
        measurer
      );

    readableBlocks.push(
      ...fitted
    );
  }

  const pages = [];

  let currentPage = [];

  let currentStartIndex = 0;

  for (
    let index = 0;
    index <
      readableBlocks.length;
    index += 1
  ) {
    const block =
      readableBlocks[index];

    const testPage = [
      ...currentPage,
      block
    ];

    renderMeasuredPage(
      measurer,
      testPage
    );

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


function renderMeasuredPage(
  measurer,
  blocks
) {
  measurer.innerHTML =
    blocks
      .map(
        (block) => `
          <div class="reader-paragraph-row">
            <span class="paragraph-number">
              ${
                block.isContinuation
                  ? ""
                  : block.paragraphIndex +
                    1
              }
            </span>

            <p>
              ${escapeHtml(
                block.text
              )}
            </p>
          </div>
        `
      )
      .join("");
}


function blockFits(
  block,
  measurer
) {
  renderMeasuredPage(
    measurer,
    [block]
  );

  return (
    measurer.scrollHeight <=
    measurer.clientHeight
  );
}


function splitBlockToFit(
  block,
  measurer
) {
  if (
    blockFits(
      block,
      measurer
    )
  ) {
    return [block];
  }

  const words =
    block.text
      .split(/\s+/)
      .filter(Boolean);

  if (
    words.length <= 1
  ) {
    return [block];
  }

  const pieces = [];

  let currentText = "";

  for (
    const word
    of words
  ) {
    const candidate =
      currentText
        ? `${currentText} ${word}`
        : word;

    const candidateBlock = {
      ...block,
      text: candidate
    };

    if (
      blockFits(
        candidateBlock,
        measurer
      )
    ) {
      currentText =
        candidate;

      continue;
    }

    if (
      currentText
    ) {
      pieces.push({
        ...block,

        text:
          currentText,

        isContinuation:
          block.isContinuation ||
          pieces.length > 0
      });
    }

    currentText =
      word;
  }

  if (
    currentText
  ) {
    pieces.push({
      ...block,

      text:
        currentText,

      isContinuation:
        block.isContinuation ||
        pieces.length > 0
    });
  }

  return pieces;
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
          text:
            paragraph,

          paragraphIndex,

          isContinuation:
            false
        });

        return;
      }

      const sentences =
        paragraph.match(
          /[^.!?]+[.!?]+["”']?|.+$/g
        ) ||
        [paragraph];

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
            text:
              chunk,

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

      if (
        chunk
      ) {
        blocks.push({
          text:
            chunk,

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
