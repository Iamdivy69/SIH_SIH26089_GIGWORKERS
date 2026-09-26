import { NextRequest } from "next/server";
import { handle } from "@/server/api";

/**
 * Catch-all mock API adapter. All frontend data access goes through
 * /api/* — replacing this with a real backend only requires changing
 * the handlers in src/server/api.ts.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await ctx.params;
  return handle(req, slug);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await ctx.params;
  return handle(req, slug);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await ctx.params;
  return handle(req, slug);
}
