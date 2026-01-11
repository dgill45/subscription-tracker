// web/lib/importUtils.ts

// Shape we expect each CSV row to become
export interface Transaction {
  date: string;        // ISO yyyy-mm-dd
  merchantRaw: string; // Original merchant text from CSV
  merchant: string;    // Normalized merchant
  amount: number;      // Positive number for charge (we'll assume positive = money out)
  description?: string;
}

// Shape of a suggested recurring subscription
export interface SubscriptionSuggestion {
  merchant: string;            // normalized
  displayName: string;         // best human-friendly merchant string
  averageAmount: number;       // avg charge
  cadence: 'weekly' | 'monthly' | 'annual' | 'unknown';
  lastChargeDate: string;      // ISO yyyy-mm-dd
  sampleTransactions: Transaction[];
  confidence: number;          // 0-100, likelihood this is a real subscription
  confidenceReasons: string[]; // Why this score was assigned
}

// ---------------------------
// 1. parseCsv
// ---------------------------
// Assumptions (you can tweak later):
// CSV headers: Date,Description,Amount
// Example:
// 2025-09-14,SPOTIFY *12345,-9.99
// 2025-10-14,SPOTIFY *12345,-9.99
//
// We'll treat negative numbers as charges, flip to positive.

export function parseCsv(csvText: string): Transaction[] {
  // very lightweight CSV handling (no quoted commas for v1)
  const lines = csvText
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return [];

  // header row
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());

  const dateIdx = header.findIndex((h) => h.includes('date'));
  const descIdx = header.findIndex((h) => h.includes('desc'));
  const amtIdx = header.findIndex((h) => h.includes('amount'));

  if (dateIdx === -1 || descIdx === -1 || amtIdx === -1) {
    // In a real app, you'd throw and handle upstream.
    return [];
  }

  const out: Transaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);

    const rawDate = cols[dateIdx]?.trim();
    const rawDesc = cols[descIdx]?.trim() || '';
    const rawAmt = cols[amtIdx]?.trim();

    if (!rawDate || !rawAmt) continue;

    const parsedAmt = Number(rawAmt.replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(parsedAmt)) continue;

    // normalize sign: store charges as positive numbers
    const charge = parsedAmt < 0 ? Math.abs(parsedAmt) : parsedAmt;

    const merchNorm = normalizeMerchant(rawDesc);

    out.push({
      date: toISO(rawDate),
      merchantRaw: rawDesc,
      merchant: merchNorm,
      amount: charge,
      description: rawDesc,
    });
  }

  return out;
}

// handles commas in quotes, e.g. "ACME, INC."
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // toggle
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

// try to coerce date -> yyyy-mm-dd
function toISO(raw: string): string {
  // handles: mm/dd/yyyy or yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = '20' + yyyy;
    return `${yyyy}-${mm}-${dd}`;
  }
  // fallback: just return what we got
  return raw;
}

// ---------------------------
// 2. normalizeMerchant
// ---------------------------

export function normalizeMerchant(raw: string): string {
  // Lowercase
  let out = raw.toLowerCase();

  // Drop common noise tokens / ids / store numbers / trailing digits
  out = out.replace(/\*\d+/g, ''); // remove things like "*12345"
  out = out.replace(/[#:_-]\d+/g, ''); // -1234, :9876, etc.
  out = out.replace(/\d{4,}/g, ''); // long digit runs
  out = out.replace(/\binc\b\.?/g, '');
  out = out.replace(/\bcorp\b\.?/g, '');
  out = out.replace(/\bllc\b\.?/g, '');
  out = out.replace(/\busa\b\.?/g, '');
  out = out.replace(/[^a-z\s]/g, ' '); // strip punctuation to spaces

  // Collapse spaces
  out = out.replace(/\s+/g, ' ').trim();

  return out;
}

// ---------------------------
// 3. detectRecurring
// ---------------------------
//
// Heuristic v1:
// - group transactions by normalized merchant
// - look for >=2 charges in different months with roughly same amount (+/- $1)
// - infer cadence:
//    * if ~30 days apart => 'monthly'
//    * if ~7 days apart  => 'weekly'
//    * else 'unknown'

export function detectRecurring(transactions: Transaction[]): SubscriptionSuggestion[] {
  // group by merchant
  const groups: Record<string, Transaction[]> = {};
  for (const tx of transactions) {
    if (!groups[tx.merchant]) groups[tx.merchant] = [];
    groups[tx.merchant].push(tx);
  }

  const suggestions: SubscriptionSuggestion[] = [];

  for (const merchant of Object.keys(groups)) {
    const txs = groups[merchant]
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    if (txs.length < 2) continue;

    // cluster by similar amount
    const amountClusters = clusterByAmount(txs);

    for (const cluster of amountClusters) {
      if (cluster.length < 2) continue;

      // Estimate cadence from date gaps
      const cadence = estimateCadence(cluster);

      // We only care if cadence is weekly/monthly OR we have at least 3 similar hits
      if (cadence === 'unknown' && cluster.length < 3) {
        continue;
      }

      const avgAmount =
        cluster.reduce((sum, t) => sum + t.amount, 0) / cluster.length;

      const lastChargeDate = cluster[cluster.length - 1]?.date ?? '';

      const displayName = bestDisplayName(cluster);

      // Calculate confidence score
      const confidenceResult = calculateConfidence(
        merchant,
        displayName,
        cluster,
        cadence,
        avgAmount
      );

      // Only include suggestions with confidence >= 30%
      if (confidenceResult.score < 30) {
        continue;
      }

      suggestions.push({
        merchant,
        displayName,
        averageAmount: Number(avgAmount.toFixed(2)),
        cadence,
        lastChargeDate,
        sampleTransactions: cluster,
        confidence: confidenceResult.score,
        confidenceReasons: confidenceResult.reasons,
      });
    }
  }

  // Sort by confidence (highest first)
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

// clusterByAmount: groups txs whose amounts are within $1 of each other
function clusterByAmount(txs: Transaction[]): Transaction[][] {
  const clusters: Transaction[][] = [];
  for (const tx of txs) {
    let placed = false;
    for (const c of clusters) {
      const ref = c[0].amount;
      if (Math.abs(ref - tx.amount) <= 1) {
        c.push(tx);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([tx]);
    }
  }
  return clusters;
}

function estimateCadence(
  txs: Transaction[]
): 'weekly' | 'monthly' | 'annual' | 'unknown' {
  if (txs.length < 2) return 'unknown';

  const gaps: number[] = [];
  for (let i = 1; i < txs.length; i++) {
    const prev = new Date(txs[i - 1].date).getTime();
    const curr = new Date(txs[i].date).getTime();
    const diffDays = Math.abs(curr - prev) / (1000 * 60 * 60 * 24);
    gaps.push(diffDays);
  }

  // Average distance between charges in days
  const avgGap = gaps.reduce((sum, d) => sum + d, 0) / gaps.length;

  // Heuristics:
  // ~7 days     => weekly
  // ~30 days    => monthly
  // ~365 days   => annual
  //
  // We'll allow some fuzz because billing dates slide around on weekends/holidays.

  if (avgGap > 330 && avgGap < 400) {
    return 'annual';
  }

  if (avgGap > 20 && avgGap < 40) {
    return 'monthly';
  }

  if (avgGap > 5 && avgGap < 10) {
    return 'weekly';
  }

  return 'unknown';
}


// bestDisplayName: pick the most common raw description (capitalized nicely)
function bestDisplayName(txs: Transaction[]): string {
  const counts: Record<string, number> = {};
  for (const t of txs) {
    counts[t.merchantRaw] = (counts[t.merchantRaw] || 0) + 1;
  }
  const winner = Object.keys(counts).sort(
    (a, b) => counts[b] - counts[a]
  )[0];

  return titleCase(winner || txs[0]?.merchantRaw || 'Unknown');
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------
// 4. calculateConfidence
// ---------------------------
// Returns 0-100 score and reasons for the score

interface ConfidenceResult {
  score: number;
  reasons: string[];
}

function calculateConfidence(
  merchant: string,
  displayName: string,
  transactions: Transaction[],
  cadence: 'weekly' | 'monthly' | 'annual' | 'unknown',
  averageAmount: number
): ConfidenceResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Cadence Pattern (0-30 points)
  if (cadence === 'monthly') {
    score += 30;
    reasons.push('Monthly billing pattern');
  } else if (cadence === 'annual') {
    score += 25;
    reasons.push('Annual billing pattern');
  } else if (cadence === 'weekly') {
    score += 20;
    reasons.push('Weekly billing pattern');
  } else {
    score += 5;
    reasons.push('Irregular billing pattern');
  }

  // 2. Amount Consistency (0-25 points)
  const amounts = transactions.map((t) => t.amount);
  const avgAmt = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmt, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 0.10) {
    score += 25;
    reasons.push('Exact same amount every time');
  } else if (stdDev < 0.50) {
    score += 20;
    reasons.push('Very consistent amounts');
  } else if (stdDev < 2.00) {
    score += 10;
    reasons.push('Similar amounts');
  } else {
    score += 0;
    reasons.push('Variable amounts (may not be subscription)');
  }

  // 3. Merchant Name Patterns (0-20 points)
  const subscriptionKeywords = [
    'subscription', 'streaming', 'netflix', 'spotify', 'hulu', 'disney',
    'prime', 'amazon prime', 'apple', 'icloud', 'adobe', 'microsoft',
    'office', 'dropbox', 'github', 'zoom', 'slack', 'notion',
    'membership', 'premium', 'pro', 'plus', 'software', 'cloud',
    'hosting', 'domain', 'vpn', 'antivirus', 'gym', 'fitness'
  ];

  const merchantLower = merchant.toLowerCase();
  const displayLower = displayName.toLowerCase();

  const hasKeyword = subscriptionKeywords.some(
    (keyword) => merchantLower.includes(keyword) || displayLower.includes(keyword)
  );

  if (hasKeyword) {
    score += 20;
    reasons.push('Known subscription service');
  }

  // 4. Amount Precision (0-15 points)
  // Subscriptions often end in .99, .95, .00, or are whole numbers
  const cents = Math.round((averageAmount % 1) * 100);
  if (cents === 99 || cents === 95 || cents === 0) {
    score += 15;
    reasons.push('Subscription-style pricing');
  } else if (cents % 5 === 0) {
    score += 8;
    reasons.push('Round pricing');
  }

  // 5. Typical Subscription Price Range (0-10 points)
  if (averageAmount >= 5 && averageAmount <= 100) {
    score += 10;
    reasons.push('Typical subscription price range');
  } else if (averageAmount >= 100 && averageAmount <= 500) {
    score += 5;
    reasons.push('Higher-tier subscription range');
  } else if (averageAmount < 5) {
    score -= 5;
    reasons.push('Very low amount (may be fees)');
  } else {
    score -= 5;
    reasons.push('Very high amount (unusual for subscription)');
  }

  // 6. Number of occurrences (bonus points)
  if (transactions.length >= 6) {
    score += 10;
    reasons.push(`${transactions.length} charges found`);
  } else if (transactions.length >= 4) {
    score += 5;
    reasons.push(`${transactions.length} charges found`);
  } else if (transactions.length >= 3) {
    score += 2;
    reasons.push(`${transactions.length} charges found`);
  }

  // Ensure score is 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}
