import data from "emojibase-data/en/data.json";
import messages from "emojibase-data/en/messages.json";

/**
 * The emoji picker's data (frimousse), served from our own origin instead of
 * a CDN: people's browsers never call a third party to pick an emoji.
 * Built once, static; frimousse caches it in localStorage per ETag.
 */
const FILES = { "data.json": data, "messages.json": messages } as const;

export function generateStaticParams() {
  return Object.keys(FILES).map((file) => ({ file }));
}

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const body = FILES[file as keyof typeof FILES];
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
