import { useEffect, useId, useRef, useState } from "react";
import { errorMessage } from "@paydirt/shared";

export function ApprovalFeedback({ choreName, rewardLabel, onApprove }: {
  choreName: string; rewardLabel: string; onApprove: (comment: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const submitting = useRef(false);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
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
    <button className="sm" type="button" onClick={() => { setError(""); setOpen(true); }}>💬 Approve with feedback</button>
    <dialog ref={dialog} className="approval-feedback-dialog" aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); if (!busy) setOpen(false); }}>
      <form onSubmit={(e) => { e.preventDefault(); void approve(); }}>
        <h2 id={titleId}>Approve with feedback</h2>
        <p><strong>{choreName}</strong></p>
        <p>{rewardLabel}</p>
        <label className="stack">
          Feedback for your child (optional)
          <textarea autoFocus rows={4} maxLength={500} value={comment} disabled={busy}
            onChange={(e) => setComment(e.target.value)} />
        </label>
        <p className="muted">{comment.length}/500 · Included in their approval alert and history.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="inline" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          <button className="primary" type="submit" disabled={busy}>{busy ? "Approving…" : "Approve"}</button>
        </div>
      </form>
    </dialog>
  </>;
}
