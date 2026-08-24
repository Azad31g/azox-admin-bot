# AZOX Admin Bot — Setup Guide

## STEP 1 — Supabase SQL
Run in SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform    TEXT NOT NULL CHECK (platform IN ('telegram','instagram','tiktok','x','youtube','discord')),
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  points      INTEGER NOT NULL DEFAULT 100,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  sort_order  INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Mini App (anon): read active tasks ONLY
CREATE POLICY "anon_read_active"
ON tasks FOR SELECT
TO anon
USING (status = 'active');

-- Bot uses service_role key which bypasses RLS entirely
-- No additional policy needed for service_role

-- Insert current tasks
INSERT INTO tasks (platform, title, url, points, sort_order) VALUES
('telegram',  'Join AZOX Community',   'https://t.me/AZOX_Coin',                500, 1),
('telegram',  'Join AZOX Coin',         'https://t.me/AZOX_Community',           500, 2),
('instagram', 'Follow Azad Bashqali',   'https://www.instagram.com/azad__x_?igsi=MXgzdnZnMGo2NmZncA==', 100, 1),
('instagram', 'Follow AZOX Coin',       'https://www.instagram.com/azox_coin?igsh=cm5teW91Mjc5aW15',    100, 2),
('instagram', 'Follow Robinhood',       'https://www.instagram.com/robinhoodapp?igsh=cWh0ZjF4MXcwanUy', 100, 3),
('instagram', 'Follow OKX',             'https://www.instagram.com/okx_official?igsh=MXVvZmRlZHAxcjgweg==', 100, 4),
('instagram', 'Follow MetaMask',        'https://www.instagram.com/metamask.io?igsh=MXRub210Z2dpMTZqdw==',  100, 5),
('instagram', 'Follow Trust Wallet',    'https://www.instagram.com/trustwallet?igsh=MW15bnQ3dnZ4cXp1cw==',  100, 6),
('instagram', 'Follow Phantom',         'https://www.instagram.com/phantom?igsh=OWVlbThnc3ZscTIz',         100, 7),
('tiktok',    'Follow Azad Bashqali',   'https://www.tiktok.com/@azad_x__?_r=1&_t=ZS-98qeAKjkxBU', 100, 1),
('tiktok',    'Follow AZOX Coin',       'https://www.tiktok.com/@azox.coin?_r=1&_t=ZS-98qeCvz67Ma', 100, 2),
('tiktok',    'Follow Phantom',         'https://www.tiktok.com/@phantom?_r=1&_t=ZS-98qeIA1Kje0',   100, 3),
('x',         'Follow AZOX Coin',       'https://x.com/AzoxCoin',         150, 1),
('x',         'Follow Robinhood Crypto','https://x.com/RobinhoodCrypto',   150, 2),
('x',         'Follow Robinhood',       'https://x.com/RobinhoodApp',      150, 3),
('x',         'Follow USDG',            'https://x.com/global_dollar',     150, 4),
('x',         'Follow OKX',             'https://x.com/okx',               150, 5),
('x',         'Follow MetaMask',        'https://x.com/MetaMask',          150, 6),
('x',         'Follow Trust Wallet',    'https://x.com/TrustWallet',       150, 7),
('x',         'Follow Phantom',         'https://x.com/phantom',           150, 8),
('youtube',   'Subscribe AZOX Coin',    'https://youtube.com/@azox_coin?si=LUD9OYjsvBHT_WNU',   150, 1),
('youtube',   'Subscribe Phantom',      'https://youtube.com/@phantom-app?si=SZZFbQBE9ZQsUOa2', 150, 2),
('youtube',   'Subscribe MetaMask',     'https://youtube.com/@metamask?si=3NzhdW5pfFfN5sLl',    150, 3),
('youtube',   'Subscribe Trust Wallet', 'https://youtube.com/@trustwallet?si=NGjaW50khjR9Gypy', 150, 4),
('youtube',   'Subscribe OKX',          'https://youtube.com/@theokxglobal?si=RCE3Fr3SoVyQVBNj',150, 5),
('discord',   'Join AZOX Server',       'https://discord.gg/5zCgkJJ2P',    100, 1);
```

## STEP 2 — Environment Variables (.env)

```
ADMIN_BOT_TOKEN=your_new_admin_bot_token
ADMIN_TELEGRAM_ID=your_telegram_id
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...service_role_key...
```

⚠️ Use SERVICE ROLE key (not anon key) for the bot.
⚠️ Never put Service Role key in frontend/Lovable.

## STEP 3 — Install & Run

```bash
npm install
npm start
```

## STEP 4 — Deploy on Railway

1. Push code to GitHub
2. Railway → New Project → GitHub repo
3. Add Environment Variables in Railway settings
4. Deploy

## RLS Security Summary

| Actor        | Key Used      | Can Read | Can Write |
|---|---|---|---|
| Mini App     | anon          | active only | ❌ Never |
| Admin Bot    | service_role  | ✅ All | ✅ All |

## Bot Commands

| Command | Description |
|---|---|
| /start | Welcome message |
| /edit_task | Open task management menu |

## Security Features

- Every handler checks Admin ID
- URL validation (must be valid https://)
- Points validation (1–100000)
- Title length validation (2–80 chars)
- Duplicate detection
- Disable preferred over Delete
- Delete shows warning + option to Disable instead
