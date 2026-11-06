import { Text } from "react-native-paper";
import { localDateLabel, type Assignment, type Chore } from "@paydirt/shared";

/** Creation identifies the occurrence even when approval happens on another day. */
export function OccurrenceLabel({ assignment }: { assignment: Pick<Assignment, "created"> & { expand?: { chore?: Pick<Chore, "type"> } } }) {
  if (assignment.expand?.chore?.type !== "recurring") return null;
  return <Text>For {localDateLabel(assignment.created)}</Text>;
}
