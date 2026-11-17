import type { IncomingMessage, ServerResponse } from 'node:http'

/** Minimal Vercel Node function types, kept local so this project does not need the vulnerable runtime SDK at build time. */
export interface VercelRequest extends IncomingMessage {
  body: any
  query: Record<string, string | string[] | undefined>
}

export interface VercelResponse extends ServerResponse {
  status(code: number): this
  json(body: unknown): this
}
