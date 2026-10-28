/**
 * server/chatbot/nlu.js — Natural Language Understanding & Entity Extraction
 *
 * Implements:
 * 1. Intent classification across 15 shopping intents.
 * 2. Entity extraction: product name, brand, model, variant (storage/color/size),
 *    category, budget min/max, target store.
 * 3. Resolves conversation context from last 10 messages (pronouns, follow-ups like "and on Flipkart?",
 *    "what about the 256GB one?").
 * 4. Handles Hinglish, typos ("iph 15", "sam s24"), short forms, and slang.
 * 5. Primary: Ollama JSON-mode extraction. Fallback: comprehensive rule-based parser.
 */

// Common typo & short-form normalizations
const TYPO_MAP = {
  'iph': 'iphone',
  'iphn': 'iphone',
  'sam': 'samsung',
  'gal': 'galaxy',
  's24': 'galaxy s24',
  's23': 'galaxy s23',
  's25': 'galaxy s25',
  'mac': 'macbook',
  'mbp': 'macbook pro',
  'mba': 'macbook air',
  '1+': 'oneplus',
  'op': 'oneplus',
  'boat': 'boat',
  'airdopes': 'airdopes',
  'airpods': 'airpods',
  'tv': 'smart tv',
  'tvs': 'smart tv'
};

// Known brands across sectors
const BRAND_PATTERNS = [
  'apple', 'samsung', 'oneplus', 'xiaomi', 'redmi', 'poco', 'realme', 'oppo', 'vivo',
  'motorola', 'google', 'nothing', 'sony', 'lg', 'hp', 'dell', 'lenovo', 'acer', 'asus',
  'boat', 'noise', 'fire-boltt', 'zebronics', 'boult', 'philips', 'jbl', 'bose', 'sennheiser',
  'nike', 'adidas', 'puma', 'reebok', 'skechers', 'woodland', 'bata', 'campus', 'sparx',
  'whirlpool', 'godrej', 'haier', 'voltas', 'daikin', 'blue star', 'ifb', 'panasonic',
  'bajaj', 'havells', 'crompton', 'orient', 'usha', 'prestige', 'pigeon', 'hawkins', 'milton',
  'mamaearth', 'himalaya', 'nivea', 'dove', 'garnier', 'loreal', 'lakme', 'maybelline'
];

// Target stores
const STORE_PATTERNS = [
  'amazon', 'flipkart', 'meesho', 'myntra', 'nykaa', 'ajio', 'jiomart', 'shopsy',
  'croma', 'reliance digital', 'tata cliq', 'tatacliq', 'firstcry', 'snapdeal', 'lenskart'
];

/**
 * Normalizes input text and expands short forms
 */
export function normalizeText(text = '') {
  let clean = String(text || '').toLowerCase().trim();
  // Standardize Hinglish patterns
  clean = clean
    .replace(/\b(kya|kitne|kitna|ka|hai|h|batao|bataiye|dikhao|chahiye|wala|wali)\b/g, ' ')
    .replace(/\b(saste|sasta|mehenga|accha|badhiya|best|top)\b/g, 'best')
    .replace(/\s+/g, ' ')
    .trim();

  // Expand short forms
  const words = clean.split(/\s+/);
  const expanded = words.map(w => TYPO_MAP[w] || w);
  return expanded.join(' ');
}

/**
 * Rule-based fallback entity and intent extractor
 */
export function parseQueryRuleBased(message, history = []) {
  const norm = normalizeText(message);
  const raw = String(message || '').toLowerCase();

  let intent = 'current_price';
  let budgetMin = null;
  let budgetMax = null;
  let targetStore = null;

  // 1. Detect target store
  for (const s of STORE_PATTERNS) {
    if (norm.includes(s)) {
      targetStore = s === 'tatacliq' ? 'Tata CLiQ' : s.charAt(0).toUpperCase() + s.slice(1);
      break;
    }
  }

  // 2. Budget extraction: "under 20000", "below 3k", "between 10000 and 15000", "< 25k"
  const underMatch = norm.match(/(?:under|below|less than|within|upto|sub)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d+)?)(?:\s*(k|thousand|lakh))?/i)
    || norm.match(/<=\s*(\d+(?:,\d+)?)(?:\s*(k|thousand))?/i);
  if (underMatch) {
    let num = Number(underMatch[1].replace(/,/g, ''));
    if (underMatch[2]?.toLowerCase() === 'k' || underMatch[2]?.toLowerCase() === 'thousand') num *= 1000;
    if (underMatch[2]?.toLowerCase() === 'lakh') num *= 100000;
    budgetMax = num;
  }

  const betweenMatch = norm.match(/(?:between|from)\s*(?:rs\.?|₹)?\s*(\d+k?)\s*(?:to|and|-)\s*(?:rs\.?|₹)?\s*(\d+k?)/i);
  if (betweenMatch) {
    const parseK = s => s.endsWith('k') ? Number(s.slice(0, -1)) * 1000 : Number(s);
    budgetMin = parseK(betweenMatch[1]);
    budgetMax = parseK(betweenMatch[2]);
  }

  // 3. Intent Detection
  if (/trend|popular|top search|what.*people.*buy/i.test(norm)) {
    intent = 'trending';
  } else if (/history|graph|chart|past price|timeline|historical|previous price/i.test(norm)) {
    intent = 'price_history';
  } else if (/drop|fall|decrease|will.*price.*drop|going to drop|down/i.test(norm)) {
    intent = 'price_drop_trend';
  } else if (/compare.*and|vs|difference between/i.test(norm) || (norm.includes('compare') && norm.includes('with'))) {
    intent = 'compare_products';
  } else if (/best deal|cheapest|lowest price|maximum discount|best discount/i.test(norm)) {
    intent = 'best_deal';
  } else if (/all site|all store|which site|which store|where is.*cheap|compare (price|platform|store)/i.test(norm)) {
    intent = 'compare_platforms';
  } else if (/should i buy|good time to buy|worth buying|right time|wait or buy/i.test(norm)) {
    intent = 'should_i_buy';
  } else if (/spec|specification|feature|ram|storage|processor|camera|battery|size|dimension/i.test(norm)) {
    intent = 'specifications';
  } else if (/review|rating|feedback|good or bad|customer say/i.test(norm)) {
    intent = 'reviews_ratings';
  } else if (/alternative|similar|competitor|like this|other option/i.test(norm)) {
    intent = 'alternatives';
  } else if (/discount|coupon|promo|bank offer|cashback/i.test(norm)) {
    intent = 'offers_discounts';
  } else if (/warranty|guarantee|delivery|return policy|cod/i.test(norm)) {
    intent = 'warranty_delivery';
  } else if (/in stock|available|out of stock/i.test(norm)) {
    intent = 'availability';
  } else if (/(best|top|good|cheap).*(phone|laptop|shoe|tv|fridge|watch|earphone|headphone|ac|tablet|cycle|bag|saree|tshirt)/i.test(norm) && budgetMax) {
    intent = 'category_browsing';
  } else if (/how to|help|what can you do|who are you/i.test(norm)) {
    intent = 'general_help';
  }

  // 4. Resolve Follow-Ups from History
  let productName = extractProductName(norm);

  // If user asked a follow-up ("what about the 256GB one?", "and on Flipkart?", "is it in stock?")
  const isFollowUp = !productName || /^(and|what about|how about|in|on|is it|does it)\b/i.test(raw);
  if (isFollowUp && Array.isArray(history) && history.length > 0) {
    const prevProduct = findLastProductInHistory(history);
    if (prevProduct) {
      if (!productName) {
        productName = prevProduct;
      } else if (norm.includes('gb') || norm.includes('pro') || norm.includes('plus') || norm.includes('max')) {
        // Appending variant
        const baseName = prevProduct.replace(/\b\d+\s*(gb|tb)\b/gi, '').trim();
        productName = `${baseName} ${productName}`.trim();
      }
    }
  }

  // 5. Detect comparison entities ("Compare iPhone 15 and Galaxy S24")
  let secondProduct = null;
  if (intent === 'compare_products') {
    const compMatch = norm.match(/(?:compare|between)\s+(.+?)\s+(?:and|vs|with)\s+(.+?)(?:\?|$)/i);
    if (compMatch) {
      productName = cleanProductName(compMatch[1]);
      secondProduct = cleanProductName(compMatch[2]);
    }
  }

  return {
    intent,
    entity: {
      productName: productName ? cleanProductName(productName) : null,
      secondProduct: secondProduct ? cleanProductName(secondProduct) : null,
      budgetMin,
      budgetMax,
      targetStore
    },
    rawQuery: message,
    resolvedQuery: productName || norm
  };
}

function extractProductName(text) {
  // Strip common prompt lead-ins
  let p = text
    .replace(/^(?:is the|whats the|what is the|show the|check the|tell me the)\s+price of\s+/i, '')
    // Price-history lead-ins: "show price history of X", "price history for X", "history of X"
    .replace(/^(?:please\s+)?(?:show|display|plot|draw|give|get|tell|check|track|see|view)\s+(?:me\s+|us\s+)?(?:the\s+)?price\s+history\s+(?:of|for)\s+/i, '')
    .replace(/^(?:please\s+)?price\s+history\s+(?:of|for)\s+/i, '')
    .replace(/^(?:please\s+)?(?:show|display|plot|draw|give|get|tell|check|track|see|view)\s+(?:me\s+|us\s+)?(?:the\s+)?history\s+(?:of|for)\s+/i, '')
    .replace(/^(?:please\s+)?history\s+(?:of|for)\s+/i, '')
    // Alternatives lead-ins: "show similar cheaper alternatives to X", "alternatives for X", "similar products to X"
    .replace(/^(?:please\s+)?(?:(?:show|find|give|suggest|recommend|list|get)\s+(?:me\s+|us\s+)?(?:some\s+|the\s+)?)?(?:similar\s+|cheaper\s+){0,2}alternatives?\s+(?:to|for|of)\s+/i, '')
    .replace(/^(?:please\s+)?(?:similar|cheaper)\s+(?:products?|options?|items?)\s+(?:to|for)\s+/i, '')
    // Specs lead-ins: "tell me the specs of X", "specifications for X", "features of X"
    .replace(/^(?:please\s+)?(?:(?:tell me|show me|give me|whats|what are|list)\s+)?(?:the\s+)?(?:specs|specifications|features|details)\s+(?:of|for)\s+/i, '')
    .replace(/^(?:what is|whats|what's|tell me|show me|find|check|search|give me|how much is|how much does|price of|rate of|cost of)\s+/i, '')
    .replace(/\s+(?:going to drop|dropping|falling|dropping soon)\b.*$/i, '')
    // Trailing platform phrases: "on all sites", "across all stores", "in all platforms"
    .replace(/\s+(?:on|at|across|in)\s+all\s+(?:sites?|stores?|platforms?)\s*$/i, '')
    .replace(/(?:price|rate|cost|specs|review|deal|history|all sites?|right now|today|now|in india)\s*$/i, '')
    .trim();

  // If budget phrase attached, strip from product name
  p = p.replace(/(?:under|below|less than|sub)\s*\d+.*$/i, '').trim();
  p = p.replace(/\s+(?:on|at)\s+(amazon|flipkart|meesho|croma|myntra).*$/i, '').trim();

  // Demonstrative pronoun references (e.g. "this laptop", "that phone", "it") should resolve from history
  if (/^(?:this|that|the)\s+(?:laptop|phone|tv|smart tv|fridge|refrigerator|watch|earphone|headphone|item|product|device|one|model)$/i.test(p) || /^(?:it|this|that)$/i.test(p)) {
    return null;
  }

  // Avoid pure generic commands
  if (['trending', 'best deals', 'help', 'hi', 'hello', 'hey'].includes(p)) {
    return null;
  }
  return p.length >= 2 ? p : null;
}

function cleanProductName(name) {
  return name
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+(price|rate|specs|details|review)$/i, '')
    .trim();
}

function findLastProductInHistory(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'user' || msg.role === 'assistant') {
      const parsed = parseQueryRuleBased(msg.content);
      if (parsed.entity?.productName && parsed.entity.productName.length > 2) {
        return parsed.entity.productName;
      }
    }
  }
  return null;
}

/**
 * LLM-powered NLU with strict JSON mode + rule-based fallback
 */
export async function extractIntentAndEntities(message, history = [], ollamaUrl = 'http://localhost:11434', modelName = 'llama3.2:3b') {
  const fallback = parseQueryRuleBased(message, history);

  // Fast-path rule-based for simple queries to save latency
  if (['trending', 'general_help'].includes(fallback.intent) && !fallback.entity.productName) {
    return fallback;
  }

  // Prepare LLM JSON prompt
  const recentHistory = (history || []).slice(-6).map(m => `${m.role}: ${m.content}`).join('\n');
  const prompt = `You are a query parser for an Indian e-commerce price comparison engine.
Given the conversation context and latest user message, extract the intent and entities.
Respond in valid JSON ONLY with no explanations, using this schema:
{
  "intent": "current_price" | "price_history" | "price_drop_trend" | "compare_platforms" | "compare_products" | "best_deal" | "specifications" | "reviews_ratings" | "alternatives" | "should_i_buy" | "availability" | "offers_discounts" | "warranty_delivery" | "category_browsing" | "trending" | "general_help",
  "productName": "canonical product name or null",
  "secondProduct": "second product name if comparing or null",
  "budgetMax": number or null,
  "budgetMin": number or null,
  "targetStore": "Amazon" | "Flipkart" | null
}

Context:
${recentHistory || 'No previous context'}
User: "${message}"`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000); // 4s timeout for parsing

    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.1, num_predict: 120 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.response);
      return {
        intent: parsed.intent || fallback.intent,
        entity: {
          productName: parsed.productName ? cleanProductName(parsed.productName) : fallback.entity.productName,
          secondProduct: parsed.secondProduct ? cleanProductName(parsed.secondProduct) : fallback.entity.secondProduct,
          budgetMin: parsed.budgetMin ?? fallback.entity.budgetMin,
          budgetMax: parsed.budgetMax ?? fallback.entity.budgetMax,
          targetStore: parsed.targetStore || fallback.entity.targetStore
        },
        rawQuery: message,
        resolvedQuery: parsed.productName || fallback.entity.productName || message,
        parsedBy: 'ollama_json'
      };
    }
  } catch {
    // Graceful fallback to rule-based parser on timeout or error
  }

  return { ...fallback, parsedBy: 'rule_based' };
}
