import { File, Paths } from "expo-file-system";

// Returns true if FamilyLinkAccessibilityService is currently connected.
// The service writes this flag on connect and deletes it on destroy.
export function isAccessibilityServiceEnabled(): boolean {
  return new File(Paths.document, "a11y_enabled.flag").exists;
}
