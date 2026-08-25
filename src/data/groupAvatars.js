export const GROUP_AVATARS = [
  {
    id: "musketeers",
    name: "The Musketeers",
    image: "/branding/group-avatars/musketeers.png"
  },
  {
    id: "lost-boys",
    name: "Peter Pan & the Lost Boys",
    image: "/branding/group-avatars/lost-boys.png"
  },
  {
    id: "wonderland",
    name: "Wonderland Tea Party",
    image: "/branding/group-avatars/wonderland.png"
  },
  {
    id: "fellowship",
    name: "The Fellowship",
    image: "/branding/group-avatars/fellowship.png"
  },
  {
    id: "bennet-sisters",
    name: "The Bennet Sisters",
    image: "/branding/group-avatars/bennet-sisters.png"
  },
  {
    id: "argonauts",
    name: "The Argonauts",
    image: "/branding/group-avatars/argonauts.png"
  },
  {
    id: "round-table",
    name: "Knights of the Round Table",
    image: "/branding/group-avatars/round-table.png"
  },
  {
    id: "gothic-horror",
    name: "Gothic Horror",
    image: "/branding/group-avatars/gothic-horror.png"
  },
  {
    id: "time-travelers",
    name: "The Time Travelers",
    image: "/branding/group-avatars/time-travelers.png"
  }
];

export function getGroupAvatar(value) {
  if (!value) return null;

  return (
    GROUP_AVATARS.find(
      (avatar) => avatar.id === value || avatar.image === value
    ) || null
  );
}
