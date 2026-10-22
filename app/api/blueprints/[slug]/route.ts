import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { findBlueprint } from '@/lib/blueprints'
import { verifyJWT } from '@/lib/session'

// Serves a blueprint's standalone HTML to signed-in users only. The files live outside
// public/ so they can't be fetched without a session; the blueprint page embeds this
// route in an iframe, and only same-origin framing is allowed.
const HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
}

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/blueprints/[slug]'>) {
  const session = verifyJWT((await cookies()).get('session')?.value ?? '')
  if (!session) return new Response('Not authenticated', { status: 401 })

  const { slug } = await ctx.params
  const blueprint = findBlueprint(slug)
  if (!blueprint) return new Response('Blueprint not found', { status: 404 })

  try {
    const html = await readFile(path.join(process.cwd(), 'content', 'blueprints', blueprint.file), 'utf8')
    return new Response(html, { headers: HEADERS })
  } catch {
    const placeholder = `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui,sans-serif;color:#5b6b7b;display:grid;place-items:center;height:100vh;margin:0">
      <p>The design for <strong>${blueprint.title}</strong> hasn't been added yet (content/blueprints/${blueprint.file}).</p></body>`
    return new Response(placeholder, { status: 404, headers: HEADERS })
  }
}
