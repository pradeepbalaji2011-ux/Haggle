/**
 * server/chatbot/intent-matcher.js
 * Rule-based fallback chatbot for when Ollama is unavailable.
 * Uses keyword/regex matching to handle common user intents.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchHaggleCatalog, formatProductReply } from './catalog-lookup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trendingPath = path.join(__dirname, '../../data/trending.json');

function getTrending() {
  try {
    return JSON.parse(fs.readFileSync(trendingPath, 'utf8'));
  } catch {
    return { trending: [], biggestDrops: [], recentSearches: ['iPhone 16', 'Samsung S25', 'Sony headphones'] };
  }
}

const INTENTS = [
  {
    name: 'greeting',
    patterns: [/^(hi|hello|hey|namaste|vanakkam|hola|good morning|good evening)/i],
    respond: () => `Namaste! 👋 I'm Haggle Assistant, your personal shopping guide for India's best deals.\n\nI can help you:\n• Find the best prices across Amazon, Flipkart, Meesho and 12 more stores\n• Check price history and trends\n• Spot today's biggest price drops\n• Manage your wishlist\n\nWhat are you shopping for today?`
  },
  {
    name: 'trending',
    patterns: [/trend|popular|top product|best seller|what.*(people|everyone).*(buy|buying)|hot (deal|product)/i],
    respond: () => {
      const data = getTrending();
      const searches = data.recentSearches?.slice(0, 5) || ['iPhone 16', 'Samsung S25', 'Sony headphones'];
      return `Here are today's trending searches on Haggle:\n\n${searches.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nTap any product name to compare prices across all 15 platforms instantly!`;
    }
  },
  {
    name: 'best_deals',
    patterns: [/best deal|biggest drop|price drop|discount|sale|offer|cheap|lowest price today/i],
    respond: () => {
      const data = getTrending();
      if (data.biggestDrops?.length > 0) {
        const drops = data.biggestDrops.slice(0, 3);
        return `Today's biggest price drops on Haggle:\n\n${drops.map(d => `• ${d.name}: dropped ₹${d.drop?.toLocaleString('en-IN') || '—'} (now ₹${d.price?.toLocaleString('en-IN') || '—'})`).join('\n')}\n\nSearch for any product above to see live prices!`;
      }
      return `I'm tracking prices 24/7 across Amazon, Flipkart, Meesho and 12 more stores.\n\nSearch for any product on Haggle to see:\n• Real-time lowest price\n• Price history graph\n• Which store is cheapest today\n\nWhat product are you interested in?`;
    }
  },
  {
    name: 'price_query',
    patterns: [/price of|how much (is|does|cost)|cost of|what is the price|rate of|tell me.*price|check.*price/i],
    respond: (msg) => {
      const matches = searchHaggleCatalog(msg);
      if (matches.length > 0) {
        return formatProductReply(matches[0]);
      }
      const match = msg.match(/(?:price of|how much (?:is|does)|cost of|rate of)\s+(.+?)(?:\?|$)/i);
      const product = match?.[1]?.trim() || 'that product';
      return `To get the current best price for "${product}", search on Haggle and I'll compare it across all 15 Indian stores in real-time!\n\nJust type the product name in the search bar above. I'll show you:\n• Lowest price available today\n• Price history for the past 30/90/180 days\n• Direct buy links to verified stores only`;
    }
  },
  {
    name: 'buy_recommendation',
    patterns: [/should i buy|good time to buy|right time|wait or buy|buy now or wait/i],
    respond: () => `Great question! Here's my advice:\n\n**Buy now if:**\n• The current price matches or beats the 90-day low\n• There's a festive sale ending soon (Diwali, Big Billion Day)\n• You need it urgently\n\n**Wait if:**\n• The price is at a 90-day high\n• A new model launch is expected\n• Price history shows frequent drops\n\nSearch the product on Haggle to see its full price history chart — it'll make your decision much easier! 📈`
  },
  {
    name: 'wishlist',
    patterns: [/wishlist|saved item|tracked product|my list|price alert/i],
    respond: () => `Your Haggle wishlist lets you:\n\n• **Save products** — tap the heart icon on any product\n• **Set price alerts** — get notified when the price drops to your target\n• **Track history** — see price trends for saved items\n\nTo access your wishlist, tap the profile icon in the top bar and sign in. It syncs across all your devices!`
  },
  {
    name: 'how_to_search',
    patterns: [/how (to|do i|can i) (search|find|compare|use|look)/i],
    respond: () => `Haggle is super easy to use!\n\n1. **Search** — type any product name in the search bar (e.g. "iPhone 16 Pro")\n2. **Compare** — see prices from all 15 Indian stores side by side\n3. **History** — tap any product to see its 30/90/180-day price graph\n4. **Buy** — click "Buy at [Store]" to go directly to the official product page\n\nNo ads, no fake prices — only direct links to verified Indian retailers. 🛡️`
  },
  {
    name: 'platforms',
    patterns: [/which store|what store|platform|amazon|flipkart|meesho|myntra|nykaa|tata/i],
    respond: () => `Haggle compares prices across **15 authorized Indian retailers**:\n\n🟠 Amazon India | 🔵 Flipkart | 🟣 Meesho\n🔴 Myntra | 🌸 Nykaa | 🟦 AJIO\n🔵 JioMart | 🟣 Shopsy | 🟠 FirstCry\n⚫ Tata CLiQ | 🟣 Tata Neu | 🟡 ShopClues\n🔵 Lenskart | 🟢 IndiaMART | 🔴 Snapdeal\n\nAll links go directly to the official store — no third-party sellers or fakes!`
  },
  {
    name: 'fallback',
    patterns: [/.*/],
    respond: (msg) => `I heard you! For the most accurate price information, let me suggest searching on Haggle directly.\n\nYou asked: "${msg.slice(0, 80)}${msg.length > 80 ? '...' : ''}"\n\nTry searching for the product in the search bar above — I'll compare prices across all 15 platforms instantly. Or ask me about:\n• "What's trending today?"\n• "Best deals right now"\n• "Should I buy now or wait?"\n• "How do I use Haggle?"`
  }
];

/**
 * Match a message to an intent and return a response
 * @param {string} message
 * @returns {string}
 */
export function matchIntent(message) {
  const msg = (message || '').trim();
  for (const intent of INTENTS) {
    if (intent.patterns.some(p => p.test(msg))) {
      return intent.respond(msg);
    }
  }
  return INTENTS[INTENTS.length - 1].respond(msg);
}
