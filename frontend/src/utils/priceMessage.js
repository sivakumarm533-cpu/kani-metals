/*
 * Reads a pasted price message ("Copper 780, Brass 520 / kg ...") into item + price rows
 * and matches each name to the items already in the price list. Nothing is saved here.
 */

// Short names people type in rate messages, mapped to words found in item names.
const ALIASES = {
  cu: 'copper', copp: 'copper', cooper: 'copper',
  al: 'aluminium', alu: 'aluminium', allu: 'aluminium', aluminum: 'aluminium', aluminiyam: 'aluminium',
  br: 'brass', bras: 'brass', pital: 'brass',
  ss: 'stainless', steel: 'steel',
  ms: 'iron', irn: 'iron',
  pb: 'lead', zn: 'zinc',
}

const UNIT_WORDS = {
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg',
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g',
  ton: 'ton', tons: 'ton', tonne: 'ton', t: 'ton',
  pc: 'piece', pcs: 'piece', piece: 'piece', pieces: 'piece', nos: 'piece', no: 'piece', each: 'piece',
  l: 'litre', ltr: 'litre', litre: 'litre', liter: 'litre',
}

const NUMBER = /(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g

export const normalize = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9஀-௿]+/g, ' ').trim()
const words = (text) => normalize(text).split(' ').filter(Boolean).map((word) => ALIASES[word] || word)

function levenshtein(a, b) {
  if (a === b) return 0
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

const wordLike = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a) || levenshtein(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1)))

/** 0–1: how well a typed name fits an item name. */
export function nameScore(typed, itemName) {
  const a = words(typed)
  const b = words(itemName)
  if (!a.length || !b.length) return 0
  if (a.join(' ') === b.join(' ')) return 1
  // An exact word counts fully, a near spelling ("cooper", "batery") a little less, so it is shown for checking.
  const fit = (word, list) => (list.includes(word) ? 1 : list.some((other) => wordLike(word, other)) ? 0.85 : 0)
  const hits = a.reduce((sum, word) => sum + fit(word, b), 0)
  if (!hits) return 0
  const covered = b.reduce((sum, word) => sum + fit(word, a), 0)
  // Mostly how much of the typed name matched, a little for how much of the item name is covered.
  return Math.min(0.97, (hits / a.length) * 0.7 + (covered / b.length) * 0.3)
}

function cleanSegment(text) {
  return text
    // Bullets and list numbers such as "-", "•", "1." or "2)".
    .replace(/^\s*(?:[-–•*>#]+|\d{1,2}[.)](?!\d))\s*/u, '')
    // Dates such as 19/11 or 19-11-2026 are not prices.
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')
    .replace(/₹|\brs\.?|\binr\b|\/-/gi, ' ')
    .replace(/[=:@]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** One "name price [unit]" or "price name" piece, or null when it has no price. */
function parseSegment(raw) {
  const text = cleanSegment(raw)
  const numbers = [...text.matchAll(NUMBER)]
  if (!numbers.length) return null
  // The price is the last number; earlier numbers stay in the name (for example "No 1 copper 780").
  const last = numbers[numbers.length - 1]
  const price = Number(last[1].replace(/,/g, ''))
  if (!Number.isFinite(price) || price <= 0) return null
  let before = text.slice(0, last.index).trim()
  let after = text.slice(last.index + last[0].length).trim()

  let unit = ''
  const unitMatch = after.match(/^(?:\/|per\s+|a\s+)?\s*([a-z]+)\b/i)
  if (unitMatch && UNIT_WORDS[unitMatch[1].toLowerCase()]) {
    unit = UNIT_WORDS[unitMatch[1].toLowerCase()]
    after = after.slice(unitMatch[0].length).trim()
  }
  before = before.replace(/(?:\/|\bper)\s*$/i, '').trim()
  const name = (before || after).replace(/^[-–,\s]+|[-–,\s]+$/g, '')
  if (!name || !/[a-z஀-௿]/i.test(name)) return null
  return { raw: raw.trim(), name, price, unit }
}

/** Splits a message into pieces: one per line, and commas or semicolons between entries. */
export function splitMessage(text) {
  return String(text || '')
    .split(/\r?\n|;|,(?=\s*[a-z஀-௿])/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Rows for the preview: what was typed, the best matching item (or null) and how sure
 * the match is. `items` is the price list ({ key, name, unit, currentPaise }).
 */
export function readPriceMessage(text, items) {
  const rows = []
  const skipped = []
  for (const piece of splitMessage(text)) {
    const parsed = parseSegment(piece)
    if (!parsed) { if (/[a-z]/i.test(piece)) skipped.push(piece); continue }
    const ranked = items
      .map((item) => {
        let score = nameScore(parsed.name, item.name)
        // A unit in the message breaks ties between the same name in different units.
        if (score && parsed.unit && item.unit) score += normalize(item.unit) === parsed.unit ? 0.02 : -0.05
        return { item, score }
      })
      .filter((entry) => entry.score >= 0.45)
      .sort((a, b) => b.score - a.score)
    const best = ranked[0] || null
    rows.push({
      ...parsed,
      pricePaise: Math.round(parsed.price * 100),
      key: best?.item.key || '',
      confidence: !best ? 'none' : best.score >= 0.9 && (ranked[1]?.score ?? 0) < best.score - 0.1 ? 'high' : 'low',
    })
  }
  return { rows, skipped }
}
