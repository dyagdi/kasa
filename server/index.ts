import express from "express";
import { resolve } from "node:path";
import { z } from "zod";
import { assetRequestSchema, fetchQuotes, resolveBistStock, resolveUsEtf, resolveUsStock, searchUsEtfs, searchUsStocks } from "./providers";
import { getTefasFundCatalog, searchFundCatalog, verifyTefasFundCode } from "./fund-catalog";

const app = express();
const port = Number(process.env.PORT ?? 5173);
const isProduction = process.env.NODE_ENV === "production" || process.argv.includes("--production");

app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

const priceRequestSchema = z.object({
  assets: z.array(assetRequestSchema).min(1).max(50)
});

app.get("/api/health", (_request, response) => {
  response.setHeader("Cache-Control", "no-store");
  response.json({ ok: true, service: "Kasa yerel fiyat aracısı" });
});

app.get("/api/funds/search", async (request, response) => {
  const parsed = z.string().trim().max(80).safeParse(request.query.q ?? "");
  if (!parsed.success) {
    response.status(400).json({ error: "Fon araması geçersiz." });
    return;
  }
  try {
    const catalog = await getTefasFundCatalog();
    let funds = searchFundCatalog(catalog.funds, parsed.data);
    let warning = catalog.warning;
    const exactCode = parsed.data.toUpperCase();
    if (/^[A-Z0-9]{2,10}$/.test(exactCode) && !catalog.funds.some((fund) => fund.code === exactCode)) {
      try {
        const verified = await verifyTefasFundCode(exactCode);
        funds = [verified, ...funds.filter((fund) => fund.code !== verified.code)];
        warning = `${exactCode}, aktif YAT/EMK/BYF katalog listelerinde yok; resmî TEFAS fiyat ucu üzerinden kodu ve adı doğrulandı.`;
      } catch {
        warning = `${exactCode}, aktif katalog listelerinde bulunamadı ve resmî fiyat ucunda doğrulanamadı.`;
      }
    }
    response.setHeader("Cache-Control", "no-store");
    response.json({
      funds,
      meta: {
        source: "TEFAS",
        endpoint: "fonGetiriBazliBilgiGetir",
        catalogVersion: 2,
        total: catalog.funds.length,
        fetchedAt: catalog.fetchedAt,
        stale: catalog.stale,
        warning
      }
    });
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : "TEFAS fon kataloğu alınamadı."
    });
  }
});

app.get("/api/stocks/bist/resolve", async (request, response) => {
  const parsed = z.string().trim().max(16).safeParse(request.query.symbol ?? "");
  if (!parsed.success) {
    response.status(400).json({ error: "BIST kodu geçersiz." });
    return;
  }
  try {
    response.setHeader("Cache-Control", "no-store");
    response.json({ stock: await resolveBistStock(parsed.data) });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "BIST hissesi doğrulanamadı." });
  }
});

app.get("/api/stocks/us/search", async (request, response) => {
  const parsed = z.string().trim().max(80).safeParse(request.query.q ?? "");
  if (!parsed.success || !parsed.data) {
    response.status(400).json({ error: "ABD hissesi araması geçersiz." });
    return;
  }
  try {
    let stocks = await searchUsStocks(parsed.data);
    let warning: string | undefined;
    const possibleSymbol = parsed.data.toLocaleUpperCase("en-US");
    if (/^[A-Z0-9.\-]{1,12}$/.test(possibleSymbol) && !stocks.some((stock) => stock.symbol === possibleSymbol)) {
      try {
        const verified = await resolveUsStock(possibleSymbol);
        stocks = [verified, ...stocks];
      } catch {
        if (!stocks.length) warning = `${possibleSymbol} için doğrulanmış NASDAQ/NYSE hissesi bulunamadı.`;
      }
    }
    response.setHeader("Cache-Control", "no-store");
    response.json({ stocks, meta: { source: "Yahoo Finance", delayed: true, warning } });
  } catch (error) {
    response.status(503).json({ error: error instanceof Error ? error.message : "ABD hissesi araması kullanılamıyor." });
  }
});

app.get("/api/stocks/us/resolve", async (request, response) => {
  const parsed = z.string().trim().max(16).safeParse(request.query.symbol ?? "");
  if (!parsed.success) {
    response.status(400).json({ error: "ABD hisse sembolü geçersiz." });
    return;
  }
  try {
    response.setHeader("Cache-Control", "no-store");
    response.json({ stock: await resolveUsStock(parsed.data) });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "ABD hissesi doğrulanamadı." });
  }
});

app.get("/api/etfs/us/search", async (request, response) => {
  const parsed = z.string().trim().max(80).safeParse(request.query.q ?? "");
  if (!parsed.success || !parsed.data) {
    response.status(400).json({ error: "ABD ETF araması geçersiz." });
    return;
  }
  try {
    let etfs = await searchUsEtfs(parsed.data);
    let warning: string | undefined;
    const possibleSymbol = parsed.data.toUpperCase();
    if (/^[A-Z0-9.\-]{1,12}$/.test(possibleSymbol) && !etfs.some((etf) => etf.symbol === possibleSymbol)) {
      try {
        const verified = await resolveUsEtf(possibleSymbol);
        etfs = [verified, ...etfs];
      } catch {
        if (!etfs.length) warning = `${possibleSymbol} için doğrulanmış ABD ETF'i bulunamadı.`;
      }
    }
    response.setHeader("Cache-Control", "no-store");
    response.json({ etfs, meta: { source: "Yahoo Finance", delayed: true, warning } });
  } catch (error) {
    response.status(503).json({ error: error instanceof Error ? error.message : "ABD ETF araması kullanılamıyor." });
  }
});

app.get("/api/etfs/us/resolve", async (request, response) => {
  const parsed = z.string().trim().max(16).safeParse(request.query.symbol ?? "");
  if (!parsed.success) {
    response.status(400).json({ error: "ABD ETF sembolü geçersiz." });
    return;
  }
  try {
    response.setHeader("Cache-Control", "no-store");
    response.json({ etf: await resolveUsEtf(parsed.data) });
  } catch (error) {
    response.status(404).json({ error: error instanceof Error ? error.message : "ABD ETF'i doğrulanamadı." });
  }
});

app.post("/api/prices", async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  const parsed = priceRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Geçersiz fiyat isteği." });
    return;
  }
  const unique = Array.from(
    new Map(parsed.data.assets.map((asset) => [`${asset.type}:${asset.symbol.toLowerCase()}`, asset])).values()
  );
  response.json({ quotes: await fetchQuotes(unique) });
});

if (isProduction) {
  const dist = resolve(process.cwd(), "dist");
  app.use(express.static(dist));
  app.get("*splat", (_request, response) => response.sendFile(resolve(dist, "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

const server = app.listen(port, "127.0.0.1");
server.on("listening", () => {
  console.log(`Kasa http://127.0.0.1:${port} adresinde hazır.`);
});
server.on("error", (error) => {
  console.error(`Kasa yerel sunucusu başlatılamadı: ${error.message}`);
  process.exitCode = 1;
});
