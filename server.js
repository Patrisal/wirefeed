const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== RSS FEED CONFIGURATION =====
// Add, remove or edit feeds here. Each feed needs: url, source label, sourceClass, categories.
const FEEDS = [
  // === MACRO / ECONOMICS ===
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC', sourceClass: 'source-ft', categories: ['macro','finance'] },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', source: 'CNBC', sourceClass: 'source-dj', categories: ['macro'] },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Economy.xml', source: 'NYT', sourceClass: 'source-wsj', categories: ['macro'] },
  { url: 'https://www.ft.com/?format=rss', source: 'FT', sourceClass: 'source-ft', categories: ['macro','finance'] },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MW', sourceClass: 'source-bbn', categories: ['macro','finance'] },

  // === GEOPOLITICS ===
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC', sourceClass: 'source-ft', categories: ['geo'] },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', source: 'NYT', sourceClass: 'source-wsj', categories: ['geo'] },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', source: 'AJ', sourceClass: 'source-ecb', categories: ['geo'] },
  { url: 'https://www.reutersagency.com/feed/', source: 'RTRS', sourceClass: 'source-rtrs', categories: ['geo','macro'] },

  // === FINANCE / MARKETS ===
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC', sourceClass: 'source-dj', categories: ['finance'] },
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', source: 'CNBC', sourceClass: 'source-dj', categories: ['finance'] },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml', source: 'NYT', sourceClass: 'source-wsj', categories: ['finance'] },
  { url: 'https://seekingalpha.com/market_currents.xml', source: 'SA', sourceClass: 'source-bbn', categories: ['finance'] },
  { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&region=US&lang=en-US', source: 'YF', sourceClass: 'source-dj', categories: ['finance'] },

  // === RATES / CREDIT / FX ===
  { url: 'https://www.cnbc.com/id/10000760/device/rss/rss.html', source: 'CNBC', sourceClass: 'source-fed', categories: ['rates'] },
  { url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/', source: 'MW', sourceClass: 'source-ecb', categories: ['rates','finance'] },
  { url: 'https://www.ecb.europa.eu/rss/press.html', source: 'ECB', sourceClass: 'source-ecb', categories: ['rates','macro'] },
  { url: 'https://www.federalreserve.gov/feeds/press_all.xml', source: 'FED', sourceClass: 'source-fed', categories: ['rates','macro'] },

  // === COMMODITIES ===
  { url: 'https://oilprice.com/rss/main', source: 'OIL', sourceClass: 'source-bbn', categories: ['commodities'] },
  { url: 'https://www.mining.com/feed/', source: 'MINE', sourceClass: 'source-imf', categories: ['commodities'] },

  // === TECH ===
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', source: 'BBC', sourceClass: 'source-rtrs', categories: ['tech'] },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml', source: 'NYT', sourceClass: 'source-wsj', categories: ['tech'] },
  { url: 'https://www.theverge.com/rss/index.xml', source: 'VRGE', sourceClass: 'source-rtrs', categories: ['tech'] },
];

// ===== IN-MEMORY CACHE =====
let cachedItems = [];
let lastFetch = 0;
const CACHE_TTL = 60 * 1000; // 1 minute cache

// ===== XML PARSING (no dependencies!) =====
function parseXML(text) {
  const items = [];
  // Match both <item> (RSS 2.0) and <entry> (Atom)
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractLink(block);
    const desc = extractTag(block, 'description') || extractTag(block, 'summary') || extractTag(block, 'content:encoded') || extractTag(block, 'content');
    const pubDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated') || extractTag(block, 'dc:date');
    if (title) {
      items.push({
        title: cleanHTML(title).trim(),
        link: link || '',
        description: cleanHTML(desc || '').substring(0, 300).trim(),
        pubDate: pubDate || '',
      });
    }
  }
  return items;
}

function extractTag(block, tag) {
  // Try CDATA first
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i');
  const cdataMatch = block.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];
  // Try normal tag
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = block.match(regex);
  return m ? m[1] : '';
}

function extractLink(block) {
  // RSS: <link>url</link>
  const linkTag = block.match(/<link[^>]*>([^<]+)<\/link>/i);
  if (linkTag) return linkTag[1].trim();
  // Atom: <link href="url" />
  const atomLink = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atomLink) return atomLink[1].trim();
  return '';
}

function cleanHTML(str) {
  return (str || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}

// ===== CATEGORY DETECTION =====
const CATEGORY_KEYWORDS = {
  macro: ['gdp','inflation','unemployment','pmi','cpi','pce','economic growth','recession','fiscal','trade balance','manufacturing','consumer confidence','retail sales','housing','jobs report','nonfarm','payrolls','labor market','labour','imf','world bank','economic data'],
  geo: ['war','conflict','military','sanction','geopolit','nato','missile','strike','invasion','ceasefire','troops','nuclear','diplomacy','territory','iran','ukraine','russia','china','taiwan','israel','gaza','houthi','north korea','syria','lebanon','yemen'],
  finance: ['stock','equity','ipo','earnings','revenue','profit','merger','acquisition','buyback','dividend','market cap','s&p','nasdaq','dow jones','ftse','nikkei','dax','rally','crash','hedge fund','wall street','bank','index fund'],
  rates: ['interest rate','bond','yield','treasury','spread','credit','forex','currency','dollar','euro','yen','sterling','fed ','ecb ','boj','boe','central bank','monetary policy','rate hike','rate cut','basis points','swap','libor','sofr','gilt','bund'],
  commodities: ['oil','crude','brent','wti','gold','silver','copper','commodity','opec','natural gas','lng','iron ore','wheat','corn','metal','mining','energy price','lithium','uranium'],
  tech: ['ai ','artificial intelligence','semiconductor','chip','nvidia','apple','google','microsoft','amazon','meta','tesla','openai','tech stock','cloud computing','data center','quantum','cybersecurity'],
};

function detectCategories(title, desc) {
  const text = (title + ' ' + (desc || '')).toLowerCase();
  const cats = [];
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) { cats.push(cat); break; }
    }
  }
  return cats;
}

// ===== FETCH A SINGLE FEED =====
async function fetchFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(feed.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WireFeed/1.0 (News Aggregator)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
      },
    });
    clearTimeout(timeout);

    if (!resp.ok) return [];
    const text = await resp.text();
    const rawItems = parseXML(text);

    return rawItems.map(item => {
      const detectedCats = detectCategories(item.title, item.description);
      const allCats = [...new Set([...detectedCats, ...feed.categories])];
      return {
        title: item.title,
        description: item.description,
        link: item.link,
        pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        pubDateMs: item.pubDate ? new Date(item.pubDate).getTime() : Date.now(),
        source: feed.source,
        sourceClass: feed.sourceClass,
        categories: allCats,
        breaking: /breaking|urgent|flash|just in|alert/i.test(item.title),
      };
    });
  } catch (e) {
    // Silently skip failed feeds
    return [];
  }
}

// ===== FETCH ALL FEEDS =====
async function fetchAllFeeds() {
  const results = await Promise.allSettled(FEEDS.map(f => fetchFeed(f)));
  const items = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);

  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = item.title.substring(0, 50).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  // Sort by date descending
  unique.sort((a, b) => b.pubDateMs - a.pubDateMs);
  return unique;
}

// ===== API ENDPOINT =====
app.get('/api/feed', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedItems.length > 0 && (now - lastFetch) < CACHE_TTL) {
      return res.json({ items: cachedItems, cached: true, count: cachedItems.length });
    }
    const items = await fetchAllFeeds();
    cachedItems = items;
    lastFetch = now;
    res.json({ items, cached: false, count: items.length });
  } catch (e) {
    res.status(500).json({ error: 'Feed fetch failed', message: e.message });
  }
});

app.get('/api/feeds-config', (req, res) => {
  res.json(FEEDS.map(f => ({ url: f.url, source: f.source, categories: f.categories })));
});

// ===== SERVE FRONTEND =====
// ===== MARKET DATA TICKER =====
async function fetchMarketData() {
  try {
    var symbols = TICKER_SYMBOLS.map(function(t){return t.symbol}).join(',');
    var url = 'https://query2.finance.yahoo.com/v6/finance/quote?symbols=' + encodeURIComponent(symbols);
    var resp = await fetch(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!resp.ok) {
      // Fallback: try individual fetches from Yahoo v8
      return await fetchMarketDataFallback();
    }
    var data = await resp.json();
    if (!data.quoteResponse || !data.quoteResponse.result) return await fetchMarketDataFallback();
    return data.quoteResponse.result.map(function(q) {
      var meta = TICKER_SYMBOLS.find(function(t){return t.symbol === q.symbol});
      return {
        symbol: q.symbol,
        name: meta ? meta.name : q.shortName || q.symbol,
        type: meta ? meta.type : 'other',
        price: q.regularMarketPrice || 0,
        change: q.regularMarketChange || 0,
        changePct: q.regularMarketChangePercent || 0,
        state: q.marketState || 'CLOSED',
      };
    });
  } catch (e) {
    console.error('Yahoo v6 failed:', e.message);
    return await fetchMarketDataFallback();
  }
}

async function fetchMarketDataFallback() {
  var results = [];
  // Fetch one by one from Yahoo v8 chart endpoint
  var promises = TICKER_SYMBOLS.map(async function(t) {
    try {
      var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(t.symbol) + '?interval=1d&range=2d';
      var resp = await fetch(url, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      });
      if (!resp.ok) return null;
      var data = await resp.json();
      var meta = data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
      if (!meta) return null;
      var price = meta.regularMarketPrice || 0;
      var prevClose = meta.chartPreviousClose || meta.previousClose || price;
      var change = price - prevClose;
      var changePct = prevClose ? (change / prevClose) * 100 : 0;
      return {
        symbol: t.symbol,
        name: t.name,
        type: t.type,
        price: price,
        change: change,
        changePct: changePct,
        state: meta.marketState || 'CLOSED',
      };
    } catch (e) { return null; }
  });
  var settled = await Promise.allSettled(promises);
  settled.forEach(function(r) {
    if (r.status === 'fulfilled' && r.value) results.push(r.value);
  });
  return results;
}

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n🟢 WireFeed running at http://localhost:${PORT}\n`);
  console.log(`   Monitoring ${FEEDS.length} RSS feeds`);
  console.log(`   API endpoint: http://localhost:${PORT}/api/feed`);
  console.log(`   Cache TTL: ${CACHE_TTL / 1000}s\n`);
});
