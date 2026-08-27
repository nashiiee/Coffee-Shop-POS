# Platform-admin scripts

These are the tools for managing shops (client businesses) on this system — onboarding new clients, and cutting off / restoring access for billing reasons. There is no web UI for this; it's all run from the terminal.

All six commands need to be run from the `server/` directory (not the project root), since that's where the Prisma client and `tsx` are set up.

## 0. First, always `cd` into the server folder

```bash
cd /Users/chubby/Desktop/projects/coffee-shop-pos/server
```

Every command below assumes you're standing here.

## 1. See all your shops

```bash
npx tsx scripts/list-shops.ts
```

**What it does:** Reads every shop from the database and prints its name, its ID (the long string you'll need for the commands below), its status (ACTIVE or SUSPENDED + reason), and the email of its admin account. Read-only — makes no changes. Run this first whenever you need a shop's ID.

## 2. Onboard a new client

```bash
npx tsx scripts/create-shop.ts --name "Bean There Coffee" --admin-email owner@beanthere.com --admin-password "TempPassword123!" --logo ./bean-there-logo.png
```

**What it does:** Creates a new `Shop` record with that name, then creates one `ADMIN` login for it with the email/password you gave. That admin account is the client's very first login — they use it to sign into the app and set up their own menu, staff, etc. Prints the new shop's ID when done. Give that email/password to the client (or have them change the password after first login).

`--logo` is optional — point it at a local `.jpg`/`.png`/`.webp` file and it becomes that shop's logo (shown in the admin header/sidebar and on printed receipts once someone logs in). Skip it and the shop just uses the app's default icon until you set one with `update-shop-branding.ts`.

## 3. Change a client's name or logo later

```bash
npx tsx scripts/update-shop-branding.ts --shop-id cmtaabanx0000m7vsbrlqcax7 --name "Culture Cup" --logo ./culture-cup-logo.png
```

**What it does:** Updates that one shop's display name and/or logo. Both flags are optional — pass just `--name`, just `--logo`, or both. Takes effect the moment someone at that shop logs in (or refreshes their session); every *other* shop is untouched, since branding is per-shop, not global.

*(Replace `cmtaabanx0000m7vsbrlqcax7` with the real ID from `list-shops.ts`.)*

## 4. Cut off a client who hasn't paid

```bash
npx tsx scripts/suspend-shop.ts --shop-id cmtaabanx0000m7vsbrlqcax7 --reason "Payment overdue"
```

**What it does:** Flips that one shop's status to SUSPENDED and records your reason. Every user at that shop — admin or cashier — is locked out starting with their very next request. If someone's mid-session when you run this, they get kicked out immediately, not at their next login. Nothing about their data is touched or deleted.

*(Replace `cmtaabanx0000m7vsbrlqcax7` with the real ID from `list-shops.ts`.)*

## 5. Restore access once they've paid

```bash
npx tsx scripts/reactivate-shop.ts --shop-id cmtaabanx0000m7vsbrlqcax7
```

**What it does:** Flips that shop back to ACTIVE and clears the suspension reason. Access comes back immediately — no need for the client to do anything, they can just log in again (or if they still have a browser tab open, their next click works).

## Typical real-world flow

`list-shops.ts` to find who you're dealing with → `suspend-shop.ts` / `reactivate-shop.ts` as needed → `create-shop.ts` whenever a new client signs up → `update-shop-branding.ts` any time a client wants to change their name or logo. That's the entire admin toolkit.
