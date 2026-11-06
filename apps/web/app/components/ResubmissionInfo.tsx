export function ResubmissionInfo({ previousFeedback, childReply }: {
  previousFeedback?: string; childReply?: string;
}) {
  return <aside className="resubmission-info" aria-label="Resubmission details">
    <span className="resubmission-badge"><span aria-hidden="true">↩</span> Resubmitted</span>
    {previousFeedback && <div className="resubmission-message">
      <strong>Your previous feedback</strong><p>{previousFeedback}</p>
    </div>}
    {childReply && <div className="resubmission-message child-reply">
      <strong>Child’s reply</strong><p>{childReply}</p>
    </div>}
  </aside>;
}
