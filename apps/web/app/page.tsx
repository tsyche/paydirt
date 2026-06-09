"use client";

import { useEffect, useState } from "react";
import type { User } from "@paydirt/shared";
import { client } from "./lib/client";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Rehydrate from persisted auth, if any.
    setUser(client.currentUser);
    setReady(true);
  }, []);

  if (!ready) return <main>Loading…</main>;

  if (!user || !client.isParent) {
    return (
      <Login
        onLogin={(u) => setUser(u)}
        notParent={!!user && !client.isParent}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => {
        client.logout();
        setUser(null);
      }}
    />
  );
}
