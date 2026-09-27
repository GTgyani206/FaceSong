/** Deterministic randomness. Never use Math.random in engine/. */

/** FNV-1a, 32-bit. Stable string → seed. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: small, fast, fully specified 32-bit PRNG. */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n)
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('pick from empty list')
    return items[this.int(items.length)]
  }

  /** Picks by weight; weights need not sum to 1. */
  weighted<T>(options: readonly (readonly [T, number])[]): T {
    const total = options.reduce((s, [, w]) => s + w, 0)
    let r = this.next() * total
    for (const [value, w] of options) {
      r -= w
      if (r < 0) return value
    }
    return options[options.length - 1][0]
  }
}
