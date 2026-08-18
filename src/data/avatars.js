export const PROFILE_AVATARS = [
  {
    id: "austen",
    name: "Jane Austen",
    image: "/branding/avatars/austen.png"
  },
  {
    id: "shakespeare",
    name: "William Shakespeare",
    image: "/branding/avatars/shakespeare.png"
  },
  {
    id: "poe",
    name: "Edgar Allan Poe",
    image: "/branding/avatars/poe.png"
  },
  {
    id: "twain",
    name: "Mark Twain",
    image: "/branding/avatars/twain.png"
  },
  {
    id: "holmes",
    name: "Sherlock Holmes",
    image: "/branding/avatars/holmes.png"
  },
  {
    id: "ahab",
    name: "Captain Ahab",
    image: "/branding/avatars/ahab.png"
  },
  {
    id: "quixote",
    name: "Don Quixote",
    image: "/branding/avatars/quixote.png"
  },
  {
    id: "dracula",
    name: "Dracula",
    image: "/branding/avatars/dracula.png"
  },
  {
    id: "alice",
    name: "Alice",
    image: "/branding/avatars/alice.png"
  }
];

export function getProfileAvatar(
  avatarId
) {
  return (
    PROFILE_AVATARS.find(
      (avatar) =>
        avatar.id === avatarId
    ) ||
    null
  );
}
