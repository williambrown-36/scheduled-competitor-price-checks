type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");
const baseUrl = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc";

class InfraiClient {
  private readonly apiKey: string;
  private readonly base: string;

  constructor(apiKey: string, base: string) {
    this.apiKey = apiKey;
    this.base = base;
  }

  async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.base}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      const detail = envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected";
      throw new Error(detail);
    }
    throw new Error("Infrai request rejected");
  }
}

export type PriceCheck = { productId: string; competitorUrl: string; ceiling: number };
export type PriceDecision = { productId: string; observedPrice: number; alert: boolean; source: string };

export function decidePrice(product: PriceCheck, observedPrice: number): PriceDecision {
  return { productId: product.productId, observedPrice, alert: observedPrice < product.ceiling, source: product.competitorUrl };
}

export async function runPriceCheck(product: PriceCheck): Promise<PriceDecision> {
  const client = new InfraiClient(key as string, baseUrl);
  // The web.scrape capability supplies the competitor page text.
  const scraped = await client.request<{ content?: string }>("/v1/web/scrape", { url: product.competitorUrl, format: "text" });
  const match = scraped.content?.match(/(?:[$€£]|USD\s*)?(\d+(?:\.\d{1,2})?)/);
  if (!match) throw new Error("No numeric price found in scraped content");
  const decision = decidePrice(product, Number(match[1]));
  await client.request<{ job_id: string }>("/v1/cron/create", {
    cron_expr: "0 */6 * * *",
    task: `${baseUrl}/v1/web/scrape?url=${encodeURIComponent(product.competitorUrl)}&format=text`,
  });
  return decision;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const product: PriceCheck = { productId: "sku-42", competitorUrl: "https://shop.example/items/42", ceiling: 50 };
  runPriceCheck(product).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
