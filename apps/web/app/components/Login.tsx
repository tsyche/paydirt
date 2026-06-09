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
    <main>
      <h1>PayDirt</h1>
      <p className="muted">Do. The. Thing.</p>
      <form className="card stack" onSubmit={submit} style={{ maxWidth: 360 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {notParent && !error && (
          <p className="error">This dashboard is for parents.</p>
        )}
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
