import {
  Search
} from "lucide-react";

import {
  useState
} from "react";

export default function SearchBar({
  onSearch,
  onQueryChange,
  initialValue = ""
}) {
  const [
    query,
    setQuery
  ] = useState(
    initialValue
  );

  function handleChange(
    event
  ) {
    const nextQuery =
      event.target.value;

    setQuery(
      nextQuery
    );

    onQueryChange?.(
      nextQuery
    );
  }

  function handleSubmit(
    event
  ) {
    event.preventDefault();

    onSearch(
      query
    );
  }

  return (
    <form
      className="search-bar"
      onSubmit={
        handleSubmit
      }
    >
      <Search size={20} />

      <input
        type="search"
        placeholder="Search title, author, or subject"
        value={query}
        onChange={
          handleChange
        }
      />

      <button type="submit">
        Search
      </button>
    </form>
  );
}
