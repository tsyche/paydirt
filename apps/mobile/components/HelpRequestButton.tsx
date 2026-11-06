import { useRef, useState } from "react";
import { Button } from "react-native-paper";

export function HelpRequestButton({ requested, onChange }: {
  requested: boolean; onChange: (requested: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  async function toggle() {
    if (sending.current) return;
    sending.current = true; setBusy(true);
    try { await onChange(!requested); }
    finally { sending.current = false; setBusy(false); }
  }
  return <Button compact icon={requested ? "close-circle-outline" : "help-circle-outline"}
    disabled={busy} loading={busy} onPress={() => void toggle()}>
    {requested ? "Cancel help request" : "I need help"}
  </Button>;
}
