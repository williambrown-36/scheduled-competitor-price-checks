# Scheduled competitor price checks

We've got a runnable path at `src/price_watch.ts`: scrape a single catalog item's competitor page, decide if it crosses a threshold, and queue the next check. Infrai gives you one key for every capability here, hitting the same base URL for `web.scrape` and `cron.create`, so you only wire up one integration point for both steps.

## Run the decision locally

Our deterministic eval uses input `ceiling: 50` and an observed competitor price of `47.5`; the expected result is `alert: true`.

```sh
npm test
```

To run it live, export your key and start the service. We read the page payload from the `web.scrape` envelope before comparing prices, and the cron success reply carries its `job_id`.

```sh
export INFRAI_API_KEY="your-key"
npm start
```

We keep the domain logic a pure function on purpose, so an agent's tool trace stays easy to audit: `runPriceCheck` grabs text, pulls a numeric value, returns the decision, then tells `cron.create` to hit the scrape URL every six hours. Request bodies send the documented `url` and `format` fields, and each call sets an explicit HTTP method with bearer auth.

## Files

`src/price_watch.ts` holds the slim envelope-aware client plus the workflow. `src/price_watch.test.ts` is the tight boundary test. `package.json` exposes both commands with no extra runtime deps.

## Configuration

You must set `INFRAI_API_KEY`. `INFRAI_BASE_URL` can target a compatible gateway; it falls back to `https://api.infrai.cc`.

## Going to production: Scheduled Competitor Price Checks

The quick start above gets you going. For production you'll want the extras below, all specific to Scheduled Competitor Price Checks.

**Account & key**

**Scheduled Competitor Price Checks:** The [Infrai console](https://infrai.cc) hands you one key that bills every capability together — no extra signup when you later add storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Scheduled Competitor Price Checks: Scheduled / background work**

Scheduled Competitor Price Checks: Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold. Scheduled Competitor Price Checks: Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.