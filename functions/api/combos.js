// Cloudflare Pages Function: same-origin proxy for Commander Spellbook combo searches.
// Route: GET /api/combos?q=card%3A%22Card%20Name%22&page=1
export async function onRequestGet({ request }) {
  const incoming = new URL(request.url);
  const query = incoming.searchParams.get("q");
  const page = incoming.searchParams.get("page") || "1";

  if (!query || query.length > 500) {
    return Response.json({ error: "A valid combo search query is required." }, { status: 400 });
  }
  if (!/^\d+$/.test(page) || Number(page) < 1 || Number(page) > 20) {
    return Response.json({ error: "Invalid page number." }, { status: 400 });
  }

  const upstream = new URL("https://backend.commanderspellbook.com/variants/");
  upstream.searchParams.set("q", query);
  upstream.searchParams.set("page", page);

  try {
    const response = await fetch(upstream.toString(), {
      headers: { Accept: "application/json", "User-Agent": "MTG-Card-Explorer/1.0" },
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8",
        "Cache-Control": response.ok ? "public, max-age=300" : "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      { error: "The upstream Commander Spellbook service could not be reached." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
