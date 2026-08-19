import {
  useEffect,
  useState
} from "react";

import {
  Users
} from "lucide-react";

import {
  getReadersForBook
} from "../services/storage.js";

import {
  getProfileAvatar
} from "../data/avatars.js";


export default function ReadersHere({
  bookId
}) {
  const [
    readers,
    setReaders
  ] = useState([]);

  const [
    open,
    setOpen
  ] = useState(false);


  useEffect(() => {
    if (!bookId) {
      setReaders([]);
      return;
    }

    let active = true;

    async function loadReaders() {
      try {
        const loadedReaders =
          await getReadersForBook(
            bookId
          );

        if (active) {
          setReaders(
            loadedReaders
          );
        }
      } catch (error) {
        console.error(
          `Could not load readers for book ${bookId}:`,
          error
        );

        if (active) {
          setReaders([]);
        }
      }
    }

    loadReaders();

    /*
     * Refresh occasionally so cards update
     * without requiring a page reload.
     */
    const interval =
      window.setInterval(
        loadReaders,
        1000 * 60 * 2
      );

    return () => {
      active = false;

      window.clearInterval(
        interval
      );
    };
  }, [
    bookId
  ]);


  if (
    readers.length ===
    0
  ) {
    return null;
  }


  const visibleReaders =
    readers.slice(
      0,
      3
    );

  const extraCount =
    Math.max(
      readers.length -
        visibleReaders.length,
      0
    );


  return (
    <div className="readers-here">
      <button
        type="button"
        className="readers-here-trigger"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
        aria-expanded={
          open
        }
      >
        <div className="reader-avatar-stack">
          {visibleReaders.map(
            (
              reader,
              index
            ) => {
              const avatar =
                getProfileAvatar(
                  reader.avatar
                );

              return (
                <div
                  key={
                    reader.id ||
                    reader.userId
                  }
                  className="reader-avatar-bubble"
                  style={{
                    zIndex:
                      visibleReaders.length -
                      index
                  }}
                  title={
                    reader.displayName ||
                    "Reader"
                  }
                >
                  {avatar ? (
                    <img
                      src={
                        avatar.image
                      }
                      alt=""
                    />
                  ) : (
                    <Users
                      size={15}
                    />
                  )}
                </div>
              );
            }
          )}

          {extraCount >
            0 && (
            <div className="reader-avatar-bubble reader-avatar-more">
              +{extraCount}
            </div>
          )}
        </div>

        <span className="readers-here-label">
          {readers.length ===
          1
            ? "1 reader here"
            : `${readers.length} readers here`}
        </span>
      </button>


      {open && (
        <div className="readers-here-popover">
          <p className="eyebrow">
            Readers Here
          </p>

          <div className="readers-here-list">
            {readers.map(
              (reader) => {
                const avatar =
                  getProfileAvatar(
                    reader.avatar
                  );

                return (
                  <div
                    key={
                      reader.id ||
                      reader.userId
                    }
                    className="readers-here-person"
                  >
                    <div className="reader-avatar-bubble">
                      {avatar ? (
                        <img
                          src={
                            avatar.image
                          }
                          alt=""
                        />
                      ) : (
                        <Users
                          size={15}
                        />
                      )}
                    </div>

                    <div>
                      <strong>
                        {reader.displayName ||
                          "Reader"}
                      </strong>

                      <small>
                        {Math.min(
                          Math.max(
                            Number(
                              reader.percentComplete
                            ) ||
                            0,
                            0
                          ),
                          100
                        )}
                        % complete
                      </small>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}
    </div>
  );
}
