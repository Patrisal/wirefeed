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

  // === NBFI / FINANCIAL STABILITY ===
  { url: 'https://www.sec.gov/rss/news/press-releases.rss', source: 'SEC', sourceClass: 'source-fed', categories: ['nbfi','finance'] },
  { url: 'https://www.fca.org.uk/news/rss.xml', source: 'FCA', sourceClass: 'source-ecb', categories: ['nbfi','finance'] },
  { url: 'https://www.fsb.org/feed/', source: 'FSB', sourceClass: 'source-imf', categories: ['nbfi','macro'] },
  { url: 'https://www.bis.org/rss/', source: 'BIS', sourceClass: 'source-ecb', categories: ['nbfi','rates','macro'] },
  { url: 'https://www.hedgeweek.com/feed/', source: 'HW', sourceClass: 'source-bbn', categories: ['nbfi','finance'] },
  { url: 'https://www.insurancejournal.com/feeds/rss/news/', source: 'INS', sourceClass: 'source-rtrs', categories: ['nbfi','finance'] },
  { url: 'https://www.pionline.com/arc/outboundfeeds/rss/', source: 'P&I', sourceClass: 'source-dj', categories: ['nbfi','finance'] },
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
  nbfi: ['hedge fund','hedge funds','asset manager','asset management','money market fund','mmf','broker-dealer','prime broker','prime brokerage','clearing house','central counterparty','ccp','private equity','insurance company','pension fund','pension scheme','shadow banking','investment fund','fund manager','mutual fund','structured finance','securitization','securitisation','nbfi','non-bank financial','family office','sovereign wealth fund','endowment fund'],
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

// ===== NBFI EARLY WARNING ENGINE =====

// ── COUNTERPARTY WATCHLIST ─────────────────────────────────────────────────
// Add the names of your specific counterparties here (lowercase, partial match).
// Any article mentioning a watchlisted name gets a hard score boost and a
// CP MATCH flag, ensuring it always surfaces regardless of other signals.
const COUNTERPARTIES = [
  // examples — replace / extend with your actual book:
  // 'pimco', 'bridgewater', 'blackrock', 'vanguard', 'axa im', 'amundi',
  // 'man group', 'millennium', 'citadel', 'apollo', 'carlyle', 'kkr',
  // 'allianz', 'zurich insurance', 'aviva', 'prudential', 'metlife',
];

const NBFI_ENTITIES = [
  'hedge fund','hedge funds','asset manager','asset management','money market fund','mmf',
  'broker-dealer','prime broker','prime brokerage','clearing house','central counterparty','ccp',
  'private equity','insurance company','pension fund','pension scheme','shadow banking',
  'investment fund','fund manager','mutual fund','structured finance','spv',
  'special purpose vehicle','securitization','securitisation','credit fund','leveraged fund',
  'family office','sovereign wealth fund','endowment fund','nbfi','non-bank financial',
  'asset-backed','collateralised loan','clo','cdo','abs','reinsurer','reinsurance',
];

const NBFI_STRESS = [
  // ── Acute events (25 pts) ─────────────────────────────────────────────────
  {kw:'redemption freeze',w:25},{kw:'suspended redemptions',w:25},{kw:'halted redemptions',w:25},
  {kw:'redemption gate',w:25},{kw:'gating',w:25},{kw:'fire sale',w:25},
  {kw:'forced selling',w:25},{kw:'fund collapse',w:25},{kw:'fund failure',w:25},
  {kw:'fund suspension',w:25},{kw:'assets frozen',w:25},{kw:'frozen assets',w:25},
  {kw:'run on fund',w:25},{kw:'winding down',w:25},{kw:'wind-down',w:25},
  {kw:'insolvency',w:25},{kw:'bankruptcy',w:25},{kw:'administration',w:20},
  {kw:'receivership',w:25},{kw:'chapter 11',w:25},{kw:'chapter 15',w:25},
  {kw:'bailout',w:20},{kw:'rescue package',w:20},{kw:'emergency capital',w:20},
  // ── Legal & regulatory (15 pts) ───────────────────────────────────────────
  {kw:'investigation',w:15},{kw:'under investigation',w:15},{kw:'probe',w:12},
  {kw:'regulatory probe',w:15},{kw:'enforcement action',w:15},{kw:'sec investigation',w:15},
  {kw:'fca investigation',w:15},{kw:'fca warning',w:15},{kw:'doj investigation',w:15},
  {kw:'fraud',w:15},{kw:'misconduct',w:15},{kw:'mis-selling',w:15},
  {kw:'misappropriation',w:15},{kw:'embezzlement',w:15},{kw:'ponzi',w:25},
  {kw:'lawsuit',w:12},{kw:'class action',w:15},{kw:'litigation',w:10},
  {kw:'subpoena',w:15},{kw:'indictment',w:20},{kw:'fine',w:10},{kw:'penalty',w:10},
  {kw:'censure',w:12},{kw:'sanction',w:10},{kw:'license revoked',w:20},
  // ── Credit deterioration (15 pts) ─────────────────────────────────────────
  {kw:'credit downgrade',w:15},{kw:'rating downgrade',w:15},{kw:'downgraded',w:12},
  {kw:'negative outlook',w:12},{kw:'creditwatch negative',w:15},{kw:'watch negative',w:12},
  {kw:'below investment grade',w:15},{kw:'junk status',w:15},{kw:'speculative grade',w:12},
  {kw:'profit warning',w:15},{kw:'earnings warning',w:12},{kw:'revenue miss',w:10},
  {kw:'write-down',w:15},{kw:'writedown',w:15},{kw:'write-off',w:15},{kw:'impairment',w:12},
  {kw:'reported losses',w:15},{kw:'quarterly loss',w:12},{kw:'annual loss',w:12},
  {kw:'covenant breach',w:15},{kw:'covenant waiver',w:12},{kw:'technical default',w:20},
  {kw:'debt restructuring',w:18},{kw:'restructuring',w:10},{kw:'creditor talks',w:15},
  // ── Funding & liquidity stress (12 pts) ───────────────────────────────────
  {kw:'margin call',w:15},{kw:'collateral call',w:12},{kw:'repo stress',w:12},
  {kw:'liquidity stress',w:12},{kw:'liquidity crunch',w:12},{kw:'liquidity mismatch',w:12},
  {kw:'funding stress',w:12},{kw:'funding gap',w:12},{kw:'capital shortfall',w:12},
  {kw:'deleveraging',w:10},{kw:'fire-sale',w:20},{kw:'asset disposal',w:8},
  {kw:'solvency concern',w:12},{kw:'capital raise',w:8},{kw:'seeking capital',w:12},
  // ── Market stress signals (8 pts) ─────────────────────────────────────────
  {kw:'short sellers',w:10},{kw:'short interest',w:8},{kw:'heavily shorted',w:12},
  {kw:'cds spread',w:10},{kw:'cds widening',w:10},{kw:'spread widening',w:8},
  {kw:'credit event',w:15},{kw:'default',w:12},{kw:'cross-default',w:15},
  {kw:'market dislocation',w:10},{kw:'mass redemption',w:12},{kw:'large outflows',w:10},
  {kw:'significant outflows',w:10},{kw:'net outflows',w:6},{kw:'outflows',w:4},
  {kw:'redemption',w:5},{kw:'withdrawals',w:4},
  // ── Governance / management signals (6 pts) ───────────────────────────────
  {kw:'ceo resigns',w:8},{kw:'ceo departure',w:8},{kw:'chief executive resigns',w:8},
  {kw:'management exodus',w:10},{kw:'key man risk',w:8},{kw:'sudden departure',w:8},
  {kw:'whistleblower',w:12},{kw:'internal investigation',w:12},
  // ── Systemic / macro signals (5 pts) ─────────────────────────────────────
  {kw:'contagion',w:6},{kw:'systemic risk',w:6},{kw:'counterparty risk',w:6},
  {kw:'financial stability',w:4},{kw:'concentration risk',w:5},
  {kw:'volatility spike',w:5},{kw:'leverage concerns',w:5},
];

const NBFI_SOURCE_BONUS = {
  SEC:15, FCA:15, FSB:15, BIS:15, IMF:12, ECB:10, FED:10,
  FT:10, RTRS:10, HW:8, 'P&I':8, INS:6, BBN:8, SA:4,
};

function scoreNBFI(title, desc, source) {
  const text = ((title || '') + ' ' + (desc || '')).toLowerCase();

  // Named counterparty check — always wins, regardless of entity match
  const cpHits = COUNTERPARTIES.filter(cp => text.includes(cp.toLowerCase()));
  const entityHits = NBFI_ENTITIES.filter(e => text.includes(e));

  if (entityHits.length === 0 && cpHits.length === 0) return null;

  let score = entityHits.length * 5 + cpHits.length * 30;
  const stressHits = [];
  for (const sig of NBFI_STRESS) {
    if (text.includes(sig.kw)) { score += sig.w; stressHits.push(sig.kw); }
  }
  score += (NBFI_SOURCE_BONUS[source] || 5);

  // Named counterparty + any stress signal → always at least HIGH
  let severity;
  if (cpHits.length > 0 && stressHits.length > 0) {
    severity = score >= 55 ? 'CRITICAL' : 'HIGH';
  } else {
    severity = score >= 55 ? 'CRITICAL' : score >= 28 ? 'HIGH' : score >= 14 ? 'MEDIUM' : 'LOW';
  }

  return {
    score,
    severity,
    entityHits: entityHits.slice(0, 3),
    stressHits: stressHits.slice(0, 4),
    cpHits,
  };
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
      const nbfi = scoreNBFI(item.title, item.description, feed.source);
      if (nbfi && !allCats.includes('nbfi')) allCats.push('nbfi');
      const mapped = {
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
      if (nbfi) {
        mapped.nbfiScore = nbfi.score;
        mapped.nbfiSeverity = nbfi.severity;
        mapped.nbfiStress = nbfi.stressHits;
        if (nbfi.cpHits && nbfi.cpHits.length > 0) mapped.cpMatch = nbfi.cpHits;
      }
      return mapped;
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

// ===== NBFI ALERTS ENDPOINT =====
app.get('/api/nbfi-alerts', async (req, res) => {
  try {
    const now = Date.now();
    if (cachedItems.length === 0 || (now - lastFetch) >= CACHE_TTL) {
      const items = await fetchAllFeeds();
      cachedItems = items;
      lastFetch = now;
    }
    const sevOrder = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const minSev = req.query.min || 'LOW';
    const minIdx = Math.max(0, sevOrder.indexOf(minSev));
    const alerts = cachedItems
      .filter(i => i.categories.includes('nbfi') && sevOrder.indexOf(i.nbfiSeverity || 'LOW') >= minIdx)
      .sort((a, b) => (b.nbfiScore || 0) - (a.nbfiScore || 0))
      .slice(0, 100);
    const dist = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    alerts.forEach(a => { dist[a.nbfiSeverity || 'LOW']++; });
    res.json({ alerts, count: alerts.length, distribution: dist, generatedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: 'NBFI alert fetch failed', message: e.message });
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
