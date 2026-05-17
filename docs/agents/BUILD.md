# Build & run

From the repo root:

```bash
npm install
# postinstall runs prisma generate; migrations need DATABASE_URL
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run build
npm run start:prod
```

**Development (TypeScript directly):**

```bash
npm run dev
```

**Quality:**

```bash
npm run lint
npm run test
```

After `prisma generate`, `src/generated/` exists locally. `npm run build` runs `tsc` then `scripts/copy-prisma.js` so `build/` can load Prisma at runtime.

## Panel / production entry

- **Compiled (recommended):** `npm run build` then `npm run start:prod` → `node build/main.js`.
- **TypeScript on panel:** `npm run start:ts-node` → `ts-node --esm src/main.ts` (see `ts-node` block in `package.json`).

Pterodactyl / egg details (bash `MAIN_FILE` glob, install scripts) are in the [README](../../README.md).

## Related docs

- [Environment](ENVIRONMENT.md)
- [Architecture](ARCHITECTURE.md)
