import {
  Bookmark,
  ExternalLink,
  Trash2
} from "lucide-react";

import {
  Link
} from "react-router-dom";

import ReadersHere from "./ReadersHere.jsx";


export default function BookCard({
  book,
  onSave,
  onRemove,
  compact = false
}) {
  if (!book) {
    return null;
  }

  return (
    <article
      className={
        compact
          ? "book-card compact"
          : "book-card"
      }
    >
      <div className="cover-wrap">
        {book.cover ? (
          <img
            src={
              book.cover
            }
            alt={`${book.title} cover`}
          />
        ) : (
          <div className="cover-placeholder">
            RR
          </div>
        )}
      </div>

      <div className="book-info">
        <p className="eyebrow">
          Public domain classic
        </p>

        <h3>
          {book.title}
        </h3>

        <p className="muted">
          {book.author}
        </p>


        <ReadersHere
          bookId={
            book.id
          }
        />


        {!compact &&
          book.subjects?.length >
            0 && (
          <div className="chip-row">
            {book.subjects
              .slice(
                0,
                3
              )
              .map(
                (
                  subject
                ) => (
                  <span
                    key={
                      subject
                    }
                    className="chip"
                  >
                    {subject}
                  </span>
                )
              )}
          </div>
        )}


        <div className="button-row">
          <Link
            to={`/read/reader/${book.id}`}
            state={{
              book
            }}
            className="button primary"
          >
            Read
          </Link>

          {onSave && (
            <button
              type="button"
              className="button secondary"
              onClick={() =>
                onSave(
                  book
                )
              }
            >
              <Bookmark
                size={16}
              />

              Save
            </button>
          )}

          {onRemove && (
            <button
              type="button"
              className="button danger"
              onClick={() =>
                onRemove(
                  book.id
                )
              }
            >
              <Trash2
                size={16}
              />

              Remove
            </button>
          )}

          {book.htmlUrl && (
            <a
              className="icon-link"
              href={
                book.htmlUrl
              }
              target="_blank"
              rel="noreferrer"
              aria-label="Open source text"
            >
              <ExternalLink
                size={18}
              />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
