export const GROUP_AVATARS = [
  { id: "austen", name: "Austen", image: "/branding/avatars/austen.png" },
  { id: "shakespeare", name: "Shakespeare", image: "/branding/avatars/shakespeare.png" },
  { id: "poe", name: "Poe", image: "/branding/avatars/poe.png" },
  { id: "twain", name: "Twain", image: "/branding/avatars/twain.png" },
  { id: "holmes", name: "Holmes", image: "/branding/avatars/holmes.png" },
  { id: "ahab", name: "Ahab", image: "/branding/avatars/ahab.png" },
  { id: "quixote", name: "Quixote", image: "/branding/avatars/quixote.png" },
  { id: "dracula", name: "Dracula", image: "/branding/avatars/dracula.png" },
  { id: "alice", name: "Alice", image: "/branding/avatars/alice.png" }
];

export function getGroupAvatar(value) {
  if (!value) return null;
  return (
    GROUP_AVATARS.find(
      (avatar) => avatar.id === value || avatar.image === value
    ) || null
  );
}
