"use client";

import { useState } from "react";
import type { User } from "@paydirt/shared";
import { client } from "../lib/client";

export function Login({
  onLogin,
  notParent,
}: {
  onLogin: (u: User) => void;
  notParent: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await client.login(email, password);
      if (user.role !== "parent") {
        client.logout();
        setError("This dashboard is for parents. Use the mobile app instead.");
        return;
      }
      onLogin(user);
    } catch {
      setError("Login failed — check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-logo">💰</div>
        <h1 className="login-title">PayDirt</h1>
        <p className="login-tagline">Do. The. Thing.</p>

        <form className="stack" onSubmit={submit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            style={{ width: "100%" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ width: "100%" }}
          />
          {(notParent && !error) && (
            <p className="error">This dashboard is for parents.</p>
          )}
          {error && <p className="error">{error}</p>}
          <button
            className="primary"
            type="submit"
            disabled={busy}
            style={{ width: "100%", justifyContent: "center", marginTop: 4, padding: "12px 20px" }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
