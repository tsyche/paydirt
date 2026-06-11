# PayDirt

> *Do. The. Thing.*

A private family chore tracking app. Kids do chores, earn **parentBucks**, and spend them on screen time, savings goals, or real-world treats — with parent approval at every step.

## Setup

```bash
just setup        # install dependencies
just dev-web      # parent dashboard (Next.js)
just dev-mobile   # mobile app (Expo)
just dev-pb       # local PocketBase backend
```

See `just --list` for all recipes.

## Stack

- **Web**: Next.js (parent dashboard)
- **Mobile**: Expo / React Native + react-native-paper (parent + kid, role-gated)
- **Backend**: PocketBase (auth, DB, real-time, file storage, JS hooks)
- **Notifications**: ntfy (no FCM / no Google Play Services)

Detailed dev docs: [CLAUDE.md](./CLAUDE.md) · Scope: [FEATURES.md](./FEATURES.md) · [ROADMAP.md](./ROADMAP.md)
