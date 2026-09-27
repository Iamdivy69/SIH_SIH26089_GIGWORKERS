import { handle } from "../src/server/api";

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  return handle(req, slug);
}
