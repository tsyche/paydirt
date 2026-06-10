// Shared fixtures for the live integration suites.

/** 1x1 px JPEG. */
export const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAAAAAAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

/** Multipart body that marks an assignment completed with photo proof —
 *  the same shape the mobile app sends. */
export function completionFormWithPhoto(): FormData {
  const formData = new FormData();
  formData.append("status", "completed");
  formData.append("completed_at", new Date().toISOString());
  formData.append("photo", new Blob([TINY_JPEG], { type: "image/jpeg" }), "proof.jpg");
  return formData;
}
