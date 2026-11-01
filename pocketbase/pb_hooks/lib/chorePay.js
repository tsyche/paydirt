// Per-chore pay mode helpers. NOT auto-loaded (filename isn't *.pb.js); require()
// from inside hook handlers. Mirrors packages/shared/src/chorePay.ts, which is
// the tested source of truth (Goja can't import it). Keep the two in sync.

const MINUTES_STEP = 5;
const MAX_REWARD_MINUTES = 120;

function payMode(record) {
  const m = record.getString("pay_mode");
  return m === "time" || m === "both" ? m : "bucks";
}

// What approval actually pays: bucks only in bucks/both, minutes only in time/both.
function normalizePay(record) {
  const mode = payMode(record);
  const bucks = mode === "time" ? 0 : Math.max(0, record.getFloat("reward") || 0);
  const minutes = mode === "bucks" ? 0 : Math.max(0, record.getFloat("reward_minutes") || 0);
  return { mode: mode, bucks: bucks, minutes: minutes };
}

// Error text for an invalid pay setup, or "" when fine.
function validatePay(record) {
  const p = normalizePay(record);
  if (p.mode !== "time" && !(p.bucks > 0)) return "Set a reward above 0.";
  if (p.mode !== "bucks") {
    if (!(p.minutes > 0)) return "Set the bonus minutes above 0.";
    if (Math.floor(p.minutes) !== p.minutes || p.minutes % MINUTES_STEP !== 0) {
      return "Minutes come in steps of " + MINUTES_STEP + ".";
    }
    if (p.minutes > MAX_REWARD_MINUTES) return "Bonus time is capped at " + MAX_REWARD_MINUTES + " minutes.";
  }
  return "";
}

// Validate, then store only what the mode pays (a stale reward_minutes on a
// bucks chore, or a leftover reward on a time chore, is zeroed).
function enforce(record) {
  const error = validatePay(record);
  if (error) throw new BadRequestError(error);
  const p = normalizePay(record);
  record.set("reward", p.bucks);
  record.set("reward_minutes", p.minutes);
  if (!record.getString("pay_mode")) record.set("pay_mode", "bucks");
}

module.exports = { normalizePay, validatePay, enforce };
