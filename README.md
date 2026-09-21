# PayDirt

> *Do. The. Thing.*

A self-hosted chore and allowance tracker for households. Kids do chores, earn **parentBucks**, and spend them on screen time, savings goals, or real-world treats, with parent approval at every step. Built with Expo, Next.js, and PocketBase.

## Setup

```bash
just setup        # install dependencies
```

Then run `just` with no arguments — it prints a cheat sheet of common
scenarios ("I want to do X → run Y"): first-time setup, day-to-day dev with
Expo + an emulator, testing on a real phone, and shipping a release build.
`just --list` shows every recipe.

## Stack

- **Web**: Next.js (parent dashboard)
- **Mobile**: Expo / React Native + react-native-paper (parent + kid, role-gated)
- **Backend**: PocketBase (auth, DB, real-time, file storage, JS hooks)
- **Notifications**: ntfy (no FCM / no Google Play Services)

Detailed dev docs: [CLAUDE.md](./CLAUDE.md) · Scope: [FEATURES.md](./FEATURES.md) · [ROADMAP.md](./ROADMAP.md) · [CONTRIBUTING.md](./CONTRIBUTING.md) · [CHANGELOG.md](./CHANGELOG.md)
