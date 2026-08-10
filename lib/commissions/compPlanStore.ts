import { Redis } from '@upstash/redis'
import type { CompPlanSettings, StoredCompPlan } from './types'
import { DEFAULT_SETTINGS_QUARTERS, DEFAULT_SETTINGS_REPS } from './settingsConfig'

const SETTINGS_HASH_KEY = 'commissions:comp-plans'
const REPS_KEY = 'commissions:settings-reps'
const QUARTERS_KEY = 'commissions:settings-quarters'

let _redis: Redis | null = null

function getRedis(): Redis {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('Redis is not configured — set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN')
  }
  _redis = new Redis({ url, token })
  return _redis
}

export async function fetchCompPlanSettings(): Promise<CompPlanSettings> {
  const redis = getRedis()
  const raw = await redis.hgetall<Record<string, StoredCompPlan>>(SETTINGS_HASH_KEY)
  return raw ?? {}
}

export async function saveCompPlanCell(cellId: string, value: StoredCompPlan): Promise<void> {
  const redis = getRedis()
  await redis.hset(SETTINGS_HASH_KEY, { [cellId]: value })
}

export async function fetchSettingsConfig(): Promise<{ reps: string[]; quarters: string[] }> {
  const redis = getRedis()
  const [reps, quarters] = await Promise.all([
    redis.get<string[]>(REPS_KEY),
    redis.get<string[]>(QUARTERS_KEY),
  ])
  return {
    reps: reps ?? DEFAULT_SETTINGS_REPS,
    quarters: quarters ?? DEFAULT_SETTINGS_QUARTERS,
  }
}

export async function saveSettingsReps(reps: string[]): Promise<void> {
  const redis = getRedis()
  await redis.set(REPS_KEY, reps)
}

export async function saveSettingsQuarters(quarters: string[]): Promise<void> {
  const redis = getRedis()
  await redis.set(QUARTERS_KEY, quarters)
}
