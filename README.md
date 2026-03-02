# WireFeed — Bloomberg-Style News Wire Monitor

Real-time financial news feed aggregator with a terminal-style dark UI, optimized for mobile.

Monitors 23 RSS feeds across 6 categories: Macro, Geopolitics, Finance, Rates/FX, Commodities, Tech.

## Sources

| Category     | Sources                                          |
|-------------|--------------------------------------------------|
| Macro       | BBC Business, CNBC, NYT Economy, FT, MarketWatch |
| Geopolitics | BBC World, NYT World, Al Jazeera, Reuters        |
| Finance     | CNBC, NYT Business, Seeking Alpha, Yahoo Finance |
| Rates/FX    | CNBC, MarketWatch, ECB Press, Fed Reserve        |
| Commodities | OilPrice, Mining.com                             |
| Tech        | BBC Tech, NYT Tech, The Verge                    |

## Quick Start (Local)

```bash
npm install
npm start
```

Open http://localhost:3000 on your phone (same WiFi network).

## Deploy to Render (Free — Recommended)

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your repo
4. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment:** Node
5. Deploy → get your URL like `https://wirefeed-xxxx.onrender.com`
6. Bookmark on your phone, or "Add to Home Screen" for app-like experience

## Deploy to Vercel (Free)

```bash
npm i -g vercel
vercel
```

Follow prompts. You'll get a URL like `https://wirefeed.vercel.app`.

## Deploy to Railway (Free tier)

1. Push to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. It auto-detects Node.js and deploys

## Install as Phone App (PWA)

After deploying, open the URL on your phone:
- **iPhone:** Safari → Share → "Add to Home Screen"
- **Android:** Chrome → Menu → "Add to Home Screen"

This gives you a full-screen app experience with no browser chrome.

## Configuration

### Add/Remove Feeds
Edit the `FEEDS` array in `server.js`. Each feed needs:
```js
{
  url: 'https://example.com/rss.xml',  // RSS/Atom feed URL
  source: 'SRC',                        // 3-4 letter source label
  sourceClass: 'source-dj',             // Color class (see below)
  categories: ['finance', 'macro']      // Category tags
}
```

### Source Color Classes
- `source-dj` — Amber (Dow Jones style)
- `source-rtrs` — Blue (Reuters style)
- `source-bbn` — Purple (Bloomberg style)
- `source-ft` — Orange (FT style)
- `source-wsj` — Gray (WSJ style)
- `source-ecb` — Green (ECB/central bank)
- `source-fed` — Cyan (Fed style)
- `source-imf` — Violet

### Refresh Rate
Default: auto-refresh every 60 seconds. Change `refreshInterval` in `public/index.html`.

### Cache
Server caches feed results for 60 seconds to avoid hammering RSS endpoints. Change `CACHE_TTL` in `server.js`.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Phone/     │────▶│  Express     │────▶│  23 RSS Feeds  │
│  Browser    │◀────│  Server      │◀────│  (BBC, CNBC,   │
│  (index.html│     │  (server.js) │     │   NYT, etc.)   │
└─────────────┘     └──────────────┘     └────────────────┘
     fetch            No CORS!            Direct HTTP
    /api/feed         Parses XML          No proxy needed
```

The Express server fetches RSS feeds directly (no CORS issues since it's server-side), parses XML with zero dependencies, and serves a JSON API to the frontend.

## Features

- ⚡ Auto-refresh every 60s
- 📱 Pull-to-refresh on mobile
- 🏷️ Auto-categorization via keyword detection
- 🔴 Breaking news detection & highlighting
- 📊 Category filtering
- 👆 Swipe-back gesture on article detail
- 🎯 Deduplication across sources
- 💾 Server-side caching
- 📲 PWA-installable as phone app
