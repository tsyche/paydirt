// Curated starter chores by age band. Static data: the web "Starter chores"
// picker and `just go-live` both create real chores from it. Rewards are
// parentBucks, priced for a household screen_rate of 3 bucks/minute: doing
// every recurring chore earns ~30/40/55/70 screen minutes a day by band (see
// the weekly-total test). Parents tweak them afterwards.
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
  /** Normal repeat limit per kid per cadence window (one-offs: per week); assigning past it warns. */
  max_per_period: number;
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
      { name: "Make your bed", description: "Pull up the covers and straighten the pillow", reward: 15, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Put toys away", description: "All toys back in their bins before bed", reward: 15, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Feed the pet", description: "Fill the food bowl; a grown-up checks the amount", reward: 15, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Set the table", description: "Plates, forks and napkins for everyone", reward: 25, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Clothes in the hamper", description: "Dirty clothes go in the hamper, not the floor", reward: 15, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Water the plants", description: "A little water for each plant", reward: 30, type: "recurring", cadence: "weekly", max_per_period: 1 },
      { name: "Wipe the table", description: "Wipe up after a meal", reward: 15, type: "oneoff", max_per_period: 3 },
      { name: "Match the socks", description: "Pair up clean socks from the laundry", reward: 25, type: "oneoff", max_per_period: 2 },
    ],
  },
  {
    id: "7-9",
    label: "Ages 7-9",
    chores: [
      { name: "Unload the dishwasher", description: "Put clean dishes where they belong", reward: 35, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Take out the trash", description: "Kitchen and bathroom bins to the outside can", reward: 45, type: "recurring", cadence: "weekly", max_per_period: 1 },
      { name: "Tidy your room", description: "Floor clear, bed made, things put away", reward: 45, type: "recurring", cadence: "weekly", photo_required: true, max_per_period: 1 },
      { name: "Feed and water the pet", description: "Food, fresh water, and check the bowl is clean", reward: 20, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Fold and put away towels", description: "Fold the clean towels and take them to the bathroom", reward: 30, type: "recurring", cadence: "weekly", max_per_period: 1 },
      { name: "Sweep the kitchen floor", description: "Sweep up crumbs after dinner", reward: 28, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Pack your school bag", description: "Homework, water bottle and lunch ready the night before", reward: 20, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Help carry in groceries", description: "Carry bags in and put away what you can reach", reward: 30, type: "oneoff", max_per_period: 3 },
    ],
  },
  {
    id: "10-12",
    label: "Ages 10-12",
    chores: [
      { name: "Load and run the dishwasher", description: "Rinse, load, add soap and start it", reward: 45, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Pack your lunch", description: "Make and pack your own school lunch", reward: 30, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Do your own laundry", description: "Wash, dry, fold and put away one load", reward: 105, type: "recurring", cadence: "weekly", photo_required: true, max_per_period: 1 },
      { name: "Vacuum the living areas", description: "Living room, hallway and stairs", reward: 90, type: "recurring", cadence: "weekly", max_per_period: 1 },
      { name: "Clean the bathroom sink and mirror", description: "Wipe the sink, counter and mirror", reward: 75, type: "recurring", cadence: "weekly", photo_required: true, max_per_period: 1 },
      { name: "Walk the dog", description: "A 20-minute walk around the block", reward: 45, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Help cook dinner", description: "Prep ingredients or make one dish with a grown-up", reward: 60, type: "oneoff", max_per_period: 3 },
      { name: "Take bins to the curb", description: "Trash and recycling out on collection day", reward: 45, type: "recurring", cadence: "weekly", max_per_period: 1 },
      { name: "Rake leaves or pull weeds", description: "Fill a yard bag", reward: 90, type: "oneoff", photo_required: true, max_per_period: 1 },
    ],
  },
  {
    id: "13+",
    label: "Ages 13+",
    chores: [
      { name: "Kitchen clean-up after dinner", description: "Clear, wipe counters, load the dishwasher and sweep", reward: 70, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Take care of the dog", description: "Feed, fresh water, and a walk", reward: 60, type: "recurring", cadence: "daily", max_per_period: 1 },
      { name: "Clean a bathroom", description: "Toilet, shower, sink and floor", reward: 130, type: "recurring", cadence: "weekly", photo_required: true, max_per_period: 1 },
      { name: "Mow the lawn", description: "Front and back, edges included", reward: 180, type: "recurring", cadence: "weekly", photo_required: true, max_per_period: 1 },
      { name: "Do the family laundry", description: "Wash, dry and fold a shared load", reward: 120, type: "recurring", cadence: "weekly", max_per_period: 1 },
      { name: "Vacuum and mop the floors", description: "All hard floors and carpets on one level", reward: 130, type: "recurring", cadence: "weekly", max_per_period: 1 },
      { name: "Cook a family dinner", description: "Plan, cook and serve a meal for the family", reward: 150, type: "oneoff", max_per_period: 2 },
      { name: "Wash the car", description: "Inside vacuumed, outside washed and dried", reward: 120, type: "oneoff", photo_required: true, max_per_period: 1 },
      { name: "Grocery run helper", description: "Shop from a list, with a grown-up approving the cart", reward: 80, type: "oneoff", max_per_period: 1 },
      { name: "Babysit a sibling", description: "Look after a younger sibling for an hour", reward: 100, type: "oneoff", max_per_period: 2 },
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
    max_per_period: c.max_per_period,
    created_by: parentId,
    active: true,
  };
}
