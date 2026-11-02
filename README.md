# LUCKY VPN CARDS

Turkmen-language starter website with a shared 250-card board, six unique prizes, one-use entry codes, and an admin panel.

## Prize setup
- 1 x 6 aý mugt VPN
- 1 x 3 aý mugt VPN
- 1 x 1 aý mugt VPN
- 1 x 1 hepde 5 adamlyk maşgala
- 1 x 1 hepde 3 adamlyk maşgala
- 1 x 1 hepde 1 adamlyk
- 244 x boş kart

Cards are seeded once into SQLite and shuffled. All visitors share the same board. A card can only be picked once. Each entry code can only be redeemed once.

## Run locally
Requires Node.js 20+.

```bash
npm install
```

Set environment variables before starting:

```bash
# Linux/macOS
export ADMIN_PASSWORD='choose-a-long-private-admin-password'
export SESSION_SECRET='replace-with-a-random-secret-at-least-32-characters-long'
export NODE_ENV='development'
npm start
```

On Windows PowerShell:

```powershell
$env:ADMIN_PASSWORD="choose-a-long-private-admin-password"
$env:SESSION_SECRET="replace-with-a-random-secret-at-least-32-characters-long"
$env:NODE_ENV="development"
npm start
```

Open http://localhost:3000. Admin panel: http://localhost:3000/admin.html

## Important deployment notes
- Deploy as a persistent Node.js web service, not a static-only host.
- Attach persistent disk/storage and set `DB_FILE` to a path on it, otherwise the card board and codes may reset on redeploy.
- Set `NODE_ENV=production`, a strong unique `SESSION_SECRET` (32+ characters), and a strong `ADMIN_PASSWORD`.
- Use HTTPS. Keep environment variables private. Never put admin credentials in frontend files.
- Use one server instance unless you configure shared persistent storage and coordinate SQLite access.
- Back up the SQLite database regularly.
- Test the entire flow with test codes before giving the public link to customers.

## Current limitations / suggested next steps
- Codes are created manually in the admin panel after each sale.
- The customer page does not ask for names or phone numbers.
- The six prize cards are randomly assigned to six of the 250 card positions on first database initialization.
- There is no automatic VPN subscription activation; the seller verifies and delivers the prize.
- For a production launch, configure hosting, domain, backups, monitoring, and privacy/terms information.
