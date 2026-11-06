import { useRef, useState } from "react";
import { Button, Dialog, HelperText, Portal, Text, TextInput } from "react-native-paper";
import { errorMessage } from "@paydirt/shared";

export function ApprovalFeedback({ choreName, rewardLabel, onApprove }: {
  choreName: string; rewardLabel: string; onApprove: (comment: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  async function approve() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await onApprove(comment.trim());
      setOpen(false);
      setComment("");
    } catch (e) { setError(errorMessage(e)); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <>
    <Button icon="comment-text-outline" onPress={() => { setError(""); setOpen(true); }}>
      Approve with feedback
    </Button>
    <Portal><Dialog visible={open} onDismiss={() => { if (!busy) setOpen(false); }}>
      <Dialog.Title>Approve with feedback</Dialog.Title>
      <Dialog.Content style={{ gap: 12 }}>
        <Text variant="titleMedium">{choreName}</Text>
        <Text>{rewardLabel}</Text>
        <TextInput
          label="Feedback for your child (optional)" multiline maxLength={500}
          value={comment} onChangeText={setComment} disabled={busy}
          style={{ minHeight: 112 }} autoFocus
        />
        <Text variant="bodySmall">{comment.length}/500 · Included in their approval alert and history.</Text>
        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button disabled={busy} onPress={() => setOpen(false)}>Cancel</Button>
        <Button mode="contained" loading={busy} disabled={busy} onPress={() => void approve()}>Approve</Button>
      </Dialog.Actions>
    </Dialog></Portal>
  </>;
}
