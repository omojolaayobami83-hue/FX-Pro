require("dotenv").config();

const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.TWELVE_DATA_API_KEY;

app.disable("x-powered-by");
app.use(express.json({ limit: "50kb" }));

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"]
}));

app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false
}));

const ALLOWED_SYMBOLS = new Set([
  "EUR/USD",
  "GBP/USD",
  "XAU/USD",
  "USD/JPY",
  "AUD/USD",
  "USD/CAD"
]);

const ALLOWED_INTERVALS = new Set([
  "1min",
  "5min",
  "15min",
  "30min",
  "1h",
  "4h",
  "1day"
]);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    app: "SwiftDrop FX",
    marketDataConfigured: Boolean(
      API_KEY &&
      API_KEY !== "put_your_twelve_data_key_here"
    )
  });
});

app.get("/api/candles", async (req, res) => {
  const symbol = String(
    req.query.symbol || "EUR/USD"
  ).toUpperCase();

  const interval = String(
    req.query.interval || "15min"
  );

  const outputsize = Math.min(
    Math.max(Number(req.query.outputsize || 100), 30),
    500
  );

  if (!ALLOWED_SYMBOLS.has(symbol)) {
    return res.status(400).json({
      error: "This market is not supported."
    });
  }

  if (!ALLOWED_INTERVALS.has(interval)) {
    return res.status(400).json({
      error: "This timeframe is not supported."
    });
  }

  if (
    !API_KEY ||
    API_KEY === "put_your_twelve_data_key_here"
  ) {
    return res.status(503).json({
      error: "Add your Twelve Data API key to the server environment."
    });
  }

  try {
    const url = new URL(
      "https://api.twelvedata.com/time_series"
    );

    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", String(outputsize));
    url.searchParams.set("apikey", API_KEY);
    url.searchParams.set("format", "JSON");

    const response = await fetch(url);
    const data = await response.json();

    if (
      !response.ok ||
      data.status === "error" ||
      !Array.isArray(data.values)
    ) {
      return res.status(502).json({
        error: data.message ||
          "Market data could not be loaded."
      });
    }

    const candles = data.values
      .map(item => ({
        time: item.datetime,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close)
      }))
      .filter(c =>
        [
          c.open,
          c.high,
          c.low,
          c.close
        ].every(Number.isFinite)
      )
      .reverse();

    if (candles.length < 30) {
      return res.status(502).json({
        error: "Not enough candles to analyse this market."
      });
    }

    res.set("Cache-Control", "public, max-age=20");

    return res.json({
      symbol,
      interval,
      candles,
      provider: "Twelve Data",
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    return res.status(502).json({
      error: "Unable to connect to the market-data provider."
    });
  }
});

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      error: "API route not found."
    });
  }

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(PORT, () => {
  console.log(
    `SwiftDrop FX running on port ${PORT}`
  );
});