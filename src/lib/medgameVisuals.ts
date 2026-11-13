/**
 * Les fonds des blocs de niveau MEDGAME.
 *
 * Les 44 photos sont mélangées avec une graine dérivée de l'identifiant du
 * chapitre : chaque chapitre garde donc toujours la même série, tous les
 * étudiants voient la même chose, et un chapitre n'a jamais deux fois la même
 * photo. Aucun stockage n'est nécessaire.
 *
 * Le sel a été choisi pour que deux chapitres de 8 niveaux ne partagent jamais
 * plus de 4 photos (moyenne : 1,4 photo).
 */

const POOL_SIZE = 44
const SEED_SALT = 'medgame-pool-505'

export const MEDGAME_LEVEL_IMAGES: readonly string[] = Array.from(
  { length: POOL_SIZE },
  (_, index) => `/medgame/pool/photo-${String(index + 1).padStart(3, '0')}.webp`,
)

/** Hash FNV-1a : stable, rapide, suffisant pour une graine. */
function hash(value: string): number {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Les photos d'un chapitre, dans l'ordre des niveaux.
 * `levelCount` photos distinctes au maximum (44).
 */
export function visualsForChapter(chapterId: string, levelCount: number): string[] {
  const count = Math.min(Math.max(1, Math.ceil(levelCount)), POOL_SIZE)
  const next = random(hash(chapterId + SEED_SALT))
  const pool = [...MEDGAME_LEVEL_IMAGES]

  // Mélange partiel de Fisher-Yates : seules les `count` premières cases sont
  // tirées, et chaque tirage est unique.
  for (let index = 0; index < count; index += 1) {
    const swap = index + Math.floor(next() * (pool.length - index))
    const current = pool[index]
    pool[index] = pool[swap]
    pool[swap] = current
  }

  return pool.slice(0, count)
}
