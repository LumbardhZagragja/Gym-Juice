# Gym&Juice

Who goes to the gym the most? A tiny leaderboard for the crew.

- Pick your name, set a 4-digit PIN once per phone.
- Check in with a live photo. One check-in per day counts (days end at midnight, Central European Time).
- Weekly (Mon–Sun) and monthly leaderboards. Ties go to whoever got there first.
- Feed with 🤨 "sus" and ❤️ reactions (just for fun, they don't change scores).
- Photos are deleted after 90 days; the check-ins and scores stay.

Runs free on **Vercel** (website + server functions) and **Supabase** (database + photo storage).

## Setup (about 15 minutes, once)

### 1. Supabase: database and photo storage
1. Create a free account at supabase.com and click **New project**. Any name, pick a region close to you, save the database password somewhere.
2. When it's ready, open **SQL Editor → New query**, paste everything from [`supabase.sql`](supabase.sql), and click **Run**. This creates the tables, the private `photos` bucket and the six names.
3. Open **Project Settings → API** (or **Data API / API Keys**) and keep this tab open. You need:
   - the **Project URL**
   - the **service_role** key (the secret one, *not* the anon/public key)

### 2. Vercel: the website
1. Put this folder in a GitHub repository.
2. Create a free account at vercel.com, click **Add New → Project**, and import that repository. Leave the framework as **Other** and don't change any build settings.
3. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Supabase |
| `AUTH_SECRET` | a long random string (32+ characters) |
| `CRON_SECRET` | another long random string |
| `ADMIN_KEY` | a password only you know, for the admin page |

   For the random strings, any password generator works, or run `openssl rand -hex 32` on a Mac/Linux terminal.
4. Click **Deploy**. You get a link like `gym-and-juice.vercel.app`. Pin it in the Instagram group chat.

The daily photo cleanup is set up automatically by `vercel.json` (runs at 03:00 UTC).

## Admin
Open `/admin.html` on your site and enter your `ADMIN_KEY` to:
- add a friend, rename someone, or remove someone (removing also deletes their check-ins)
- **Reset PIN** if someone forgets it: they pick a new one next time they open the app

## Good to know
- The first person to tap a name sets its PIN. Tell everyone to open the link and set theirs soon. If someone grabs the wrong name, reset that PIN in admin.
- Changing the timezone: set an `APP_TIMEZONE` environment variable on Vercel (default `Europe/Berlin`, i.e. Central European Time with summer time).
- Free-tier limits are far above what 6 people need. Supabase pauses free projects after a week with no activity; daily check-ins keep it awake. If the group takes a long break, open the Supabase dashboard and click **Restore**.

## Developing
```bash
npm install
npm test
```
