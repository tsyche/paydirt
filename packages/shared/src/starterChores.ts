// Curated starter chores by age band. Static data: the web "Starter chores"
// picker and `just go-live` both create real chores from it. Rewards are
// parentBucks and sit on the same scale as the seed data (a daily chore is
// worth a few, a weekly deep clean a lot more); parents tweak them afterwards.
// No runtime imports on purpose: scripts load this file directly with Node's
// type stripping (see pocketbase/go-live.mjs).

export interface StarterChore {
  name: string;
  description: string;
  reward: number;
  type: "oneoff" | "recurring";
  /** Required when type is "recurring". */
  cadence?: "daily" | "weekly" | "monthly";
  photo_required?: boolean;
}

export interface StarterBand {
  id: string;
  label: string;
  chores: StarterChore[];
}

export const STARTER_BANDS: StarterBand[] = [
  {
    id: "4-6",
    label: "Ages 4-6",
    chores: [
      { name: "Make your bed", description: "Pull up the covers and straighten the pillow", reward: 5, type: "recurring", cadence: "daily" },
      { name: "Put toys away", description: "All toys back in their bins before bed", reward: 5, type: "recurring", cadence: "daily" },
      { name: "Feed the pet", description: "Fill the food bowl; a grown-up checks the amount", reward: 5, type: "recurring", cadence: "daily" },
      { name: "Set the table", description: "Plates, forks and napkins for everyone", reward: 8, type: "recurring", cadence: "daily" },
      { name: "Clothes in the hamper", description: "Dirty clothes go in the hamper, not the floor", reward: 5, type: "recurring", cadence: "daily" },
      { name: "Water the plants", description: "A little water for each plant", reward: 8, type: "recurring", cadence: "weekly" },
      { name: "Wipe the table", description: "Wipe up after a meal", reward: 5, type: "oneoff" },
      { name: "Match the socks", description: "Pair up clean socks from the laundry", reward: 8, type: "oneoff" },
    ],
  },
  {
    id: "7-9",
    label: "Ages 7-9",
    chores: [
      { name: "Unload the dishwasher", description: "Put clean dishes where they belong", reward: 12, type: "recurring", cadence: "daily" },
      { name: "Take out the trash", description: "Kitchen and bathroom bins to the outside can", reward: 15, type: "recurring", cadence: "weekly" },
      { name: "Tidy your room", description: "Floor clear, bed made, things put away", reward: 15, type: "recurring", cadence: "weekly", photo_required: true },
      { name: "Feed and water the pet", description: "Food, fresh water, and check the bowl is clean", reward: 8, type: "recurring", cadence: "daily" },
      { name: "Fold and put away towels", description: "Fold the clean towels and take them to the bathroom", reward: 10, type: "recurring", cadence: "weekly" },
      { name: "Sweep the kitchen floor", description: "Sweep up crumbs after dinner", reward: 10, type: "recurring", cadence: "daily" },
      { name: "Pack your school bag", description: "Homework, water bottle and lunch ready the night before", reward: 8, type: "recurring", cadence: "daily" },
      { name: "Help carry in groceries", description: "Carry bags in and put away what you can reach", reward: 10, type: "oneoff" },
    ],
  },
  {
    id: "10-12",
    label: "Ages 10-12",
    chores: [
      { name: "Load and run the dishwasher", description: "Rinse, load, add soap and start it", reward: 15, type: "recurring", cadence: "daily" },
      { name: "Do your own laundry", description: "Wash, dry, fold and put away one load", reward: 30, type: "recurring", cadence: "weekly", photo_required: true },
      { name: "Vacuum the living areas", description: "Living room, hallway and stairs", reward: 25, type: "recurring", cadence: "weekly" },
      { name: "Clean the bathroom sink and mirror", description: "Wipe the sink, counter and mirror", reward: 20, type: "recurring", cadence: "weekly", photo_required: true },
      { name: "Walk the dog", description: "A 20-minute walk around the block", reward: 15, type: "recurring", cadence: "daily" },
      { name: "Help cook dinner", description: "Prep ingredients or make one dish with a grown-up", reward: 20, type: "oneoff" },
      { name: "Take bins to the curb", description: "Trash and recycling out on collection day", reward: 15, type: "recurring", cadence: "weekly" },
      { name: "Rake leaves or pull weeds", description: "Fill a yard bag", reward: 30, type: "oneoff", photo_required: true },
    ],
  },
  {
    id: "13+",
    label: "Ages 13+",
    chores: [
      { name: "Cook a family dinner", description: "Plan, cook and serve a meal for the family", reward: 50, type: "oneoff" },
      { name: "Clean a bathroom", description: "Toilet, shower, sink and floor", reward: 40, type: "recurring", cadence: "weekly", photo_required: true },
      { name: "Mow the lawn", description: "Front and back, edges included", reward: 50, type: "recurring", cadence: "weekly", photo_required: true },
      { name: "Do the family laundry", description: "Wash, dry and fold a shared load", reward: 35, type: "recurring", cadence: "weekly" },
      { name: "Vacuum and mop the floors", description: "All hard floors and carpets on one level", reward: 40, type: "recurring", cadence: "weekly" },
      { name: "Wash the car", description: "Inside vacuumed, outside washed and dried", reward: 45, type: "oneoff", photo_required: true },
      { name: "Grocery run helper", description: "Shop from a list, with a grown-up approving the cart", reward: 30, type: "oneoff" },
      { name: "Babysit a sibling", description: "Look after a younger sibling for an hour", reward: 40, type: "oneoff" },
    ],
  },
];

/** Starter chores in a band that the household doesn't already have (matched by name, case-insensitive). */
export function addableStarterChores(band: StarterBand, existingNames: string[]): StarterChore[] {
  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  return band.chores.filter((c) => !have.has(c.name.toLowerCase()));
}

/** createChore payload for a starter chore. */
export function starterChoreInput(
  c: StarterChore,
  householdId: string,
  parentId: string,
) {
  return {
    household: householdId,
    name: c.name,
    description: c.description,
    reward: c.reward,
    type: c.type,
    ...(c.cadence ? { cadence: c.cadence } : {}),
    photo_required: c.photo_required ?? false,
    created_by: parentId,
    active: true,
  };
}
