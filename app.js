/* =========================================================
   SWIFTDROP FX — LIVE MARKET BRAIN
   FILE: app.js
========================================================= */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const API_BASE = "https://api.twelvedata.com";

const REFRESH_MS = 30000;

let selectedSymbol = "EURUSD";
let selectedTimeframe = "15";

let currentPrice = null;

let marketData = {};

let analysis = {};

let refreshTimer = null;


/* =========================================================
   SYMBOL MAP
========================================================= */

const SYMBOLS = {

  EURUSD: {
    display: "EUR/USD",
    api: "EUR/USD",
    tv: "FX:EURUSD",
    decimals: 5
  },

  GBPUSD: {
    display: "GBP/USD",
    api: "GBP/USD",
    tv: "FX:GBPUSD",
    decimals: 5
  },

  XAUUSD: {
    display: "XAU/USD",
    api: "XAU/USD",
    tv: "OANDA:XAUUSD",
    decimals: 2
  },

  USDJPY: {
    display: "USD/JPY",
    api: "USD/JPY",
    tv: "FX:USDJPY",
    decimals: 3
  },

  AUDUSD: {
    display: "AUD/USD",
    api: "AUD/USD",
    tv: "FX:AUDUSD",
    decimals: 5
  },

  USDCAD: {
    display: "USD/CAD",
    api: "USD/CAD",
    tv: "FX:USDCAD",
    decimals: 5
  }

};


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {
  return document.getElementById(id);
}


function setText(id, value) {

  const element = $(id);

  if (element) {
    element.textContent = value;
  }

}


function setStatus(text, connected = false) {

  setText("connectionStatus", text);

  const dot = $("statusDot");

  if (dot) {
    dot.style.background = connected
      ? "#19e68c"
      : "#777";
  }

}


/* =========================================================
   API KEY
========================================================= */

function getApiKey() {

  return localStorage.getItem("swiftdrop_twelve_api_key") || "";

}


function saveApiKey() {

  const input = $("apiKey");

  if (!input) return;

  const key = input.value.trim();

  if (!key) {

    alert("Enter your Twelve Data API key first.");

    return;
  }

  localStorage.setItem(
    "swiftdrop_twelve_api_key",
    key
  );

  setStatus("API Key Saved", true);

  loadMarket();

}


function loadSavedApiKey() {

  const input = $("apiKey");

  if (!input) return;

  const key = getApiKey();

  if (key) {
    input.value = key;
  }

}


/* =========================================================
   TWELVE DATA REQUEST
========================================================= */

async function twelveData(endpoint, params = {}) {

  const key = getApiKey();

  if (!key) {

    throw new Error(
      "NO_API_KEY"
    );

  }


  const query = new URLSearchParams();

  query.set("apikey", key);


  Object.keys(params).forEach(keyName => {

    query.set(
      keyName,
      params[keyName]
    );

  });


  const url =
    `${API_BASE}/${endpoint}?${query.toString()}`;


  const response = await fetch(url);


  if (!response.ok) {

    throw new Error(
      `HTTP ${response.status}`
    );

  }


  const data = await response.json();


  if (data.status === "error") {

    throw new Error(
      data.message || "API error"
    );

  }


  return data;

}


/* =========================================================
   GET CANDLES
========================================================= */

async function getCandles(
  timeframe,
  outputsize = 250
) {

  const symbol =
    SYMBOLS[selectedSymbol].api;


  const interval =
    timeframe === "5"
      ? "5min"
      : timeframe === "15"
      ? "15min"
      : timeframe === "60"
      ? "1h"
      : timeframe === "240"
      ? "4h"
      : "15min";


  const data = await twelveData(
    "time_series",
    {

      symbol: symbol,

      interval: interval,

      outputsize: outputsize,

      timezone: "UTC",

      order: "ASC"

    }
  );


  if (!data.values) {

    throw new Error(
      "No candle data returned."
    );

  }


  return data.values.map(candle => ({

    time: candle.datetime,

    open: Number(candle.open),

    high: Number(candle.high),

    low: Number(candle.low),

    close: Number(candle.close),

    volume: Number(candle.volume || 0)

  }));

}


/* =========================================================
   GET CURRENT PRICE
========================================================= */

async function getPrice() {

  const symbol =
    SYMBOLS[selectedSymbol].api;


  const data = await twelveData(
    "price",
    {
      symbol: symbol
    }
  );


  return Number(data.price);

}


/* =========================================================
   EMA
========================================================= */

function ema(values, period) {

  if (
    !values ||
    values.length < period
  ) {
    return null;
  }


  const multiplier =
    2 / (period + 1);


  let result =
    values
      .slice(0, period)
      .reduce(
        (sum, value) =>
          sum + value,
        0
      ) / period;


  for (
    let i = period;
    i < values.length;
    i++
  ) {

    result =
      (
        values[i] - result
      ) * multiplier + result;

  }


  return result;

}


/* =========================================================
   EMA SERIES
========================================================= */

function emaSeries(values, period) {

  const result = [];

  if (values.length < period) {
    return result;
  }


  const multiplier =
    2 / (period + 1);


  let previous =
    values
      .slice(0, period)
      .reduce(
        (sum, value) =>
          sum + value,
        0
      ) / period;


  result[period - 1] = previous;


  for (
    let i = period;
    i < values.length;
    i++
  ) {

    previous =
      (
        values[i] - previous
      ) * multiplier + previous;


    result[i] = previous;

  }


  return result;

}


/* =========================================================
   RSI
========================================================= */

function calculateRSI(
  candles,
  period = 14
) {

  if (
    candles.length <
    period + 2
  ) {
    return null;
  }


  let gains = 0;
  let losses = 0;


  for (
    let i = 1;
    i <= period;
    i++
  ) {

    const change =
      candles[i].close -
      candles[i - 1].close;


    if (change >= 0) {

      gains += change;

    } else {

      losses += Math.abs(change);

    }

  }


  let averageGain =
    gains / period;


  let averageLoss =
    losses / period;


  for (
    let i = period + 1;
    i < candles.length;
    i++
  ) {

    const change =
      candles[i].close -
      candles[i - 1].close;


    const gain =
      change > 0
        ? change
        : 0;


    const loss =
      change < 0
        ? Math.abs(change)
        : 0;


    averageGain =
      (
        averageGain *
        (period - 1) +
        gain
      ) / period;


    averageLoss =
      (
        averageLoss *
        (period - 1) +
        loss
      ) / period;

  }


  if (averageLoss === 0) {
    return 100;
  }


  const relativeStrength =
    averageGain /
    averageLoss;


  return (
    100 -
    100 /
    (1 + relativeStrength)
  );

}


/* =========================================================
   ATR
========================================================= */

function calculateATR(
  candles,
  period = 14
) {

  if (
    candles.length <
    period + 2
  ) {
    return null;
  }


  const trueRanges = [];


  for (
    let i = 1;
    i < candles.length;
    i++
  ) {

    const current =
      candles[i];


    const previous =
      candles[i - 1];


    const tr =
      Math.max(

        current.high -
        current.low,

        Math.abs(
          current.high -
          previous.close
        ),

        Math.abs(
          current.low -
          previous.close
        )

      );


    trueRanges.push(tr);

  }


  const recent =
    trueRanges.slice(-period);


  return (
    recent.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / recent.length
  );

}


/* =========================================================
   SWING HIGH
========================================================= */

function isSwingHigh(
  candles,
  index,
  strength = 2
) {

  if (
    index < strength ||
    index >=
      candles.length - strength
  ) {
    return false;
  }


  const high =
    candles[index].high;


  for (
    let i = 1;
    i <= strength;
    i++
  ) {

    if (
      candles[index - i].high >=
      high
    ) {
      return false;
    }


    if (
      candles[index + i].high >=
      high
    ) {
      return false;
    }

  }


  return true;

}


/* =========================================================
   SWING LOW
========================================================= */

function isSwingLow(
  candles,
  index,
  strength = 2
) {

  if (
    index < strength ||
    index >=
      candles.length - strength
  ) {
    return false;
  }


  const low =
    candles[index].low;


  for (
    let i = 1;
    i <= strength;
    i++
  ) {

    if (
      candles[index - i].low <=
      low
    ) {
      return false;
    }


    if (
      candles[index + i].low <=
      low
    ) {
      return false;
    }

  }


  return true;

}


/* =========================================================
   FIND RECENT SWINGS
========================================================= */

function getSwings(candles) {

  const highs = [];
  const lows = [];


  for (
    let i = 2;
    i < candles.length - 2;
    i++
  ) {

    if (
      isSwingHigh(
        candles,
        i,
        2
      )
    ) {

      highs.push({
        index: i,
        price: candles[i].high
      });

    }


    if (
      isSwingLow(
        candles,
        i,
        2
      )
    ) {

      lows.push({
        index: i,
        price: candles[i].low
      });

    }

  }


  return {

    highs: highs.slice(-8),

    lows: lows.slice(-8)

  };

}


/* =========================================================
   TREND ANALYSIS
========================================================= */

function getTrend(candles) {

  if (
    candles.length < 30
  ) {
    return "WAITING";
  }


  const closes =
    candles.map(
      candle =>
        candle.close
    );


  const ema9 =
    ema(
      closes,
      9
    );


  const ema21 =
    ema(
      closes,
      21
    );


  if (
    ema9 === null ||
    ema21 === null
  ) {
    return "WAITING";
  }


  if (
    ema9 > ema21
  ) {

    return "BULLISH";

  }


  if (
    ema9 < ema21
  ) {

    return "BEARISH";

  }


  return "RANGE";

}


/* =========================================================
   MARKET STRUCTURE
========================================================= */

function getStructure(candles) {

  const swings =
    getSwings(candles);


  if (
    swings.highs.length < 2 ||
    swings.lows.length < 2
  ) {

    return {
      structure: "WAITING",
      hhll: "WAITING"
    };

  }


  const lastHigh =
    swings.highs[
      swings.highs.length - 1
    ];


  const previousHigh =
    swings.highs[
      swings.highs.length - 2
    ];


  const lastLow =
    swings.lows[
      swings.lows.length - 1
    ];


  const previousLow =
    swings.lows[
      swings.lows.length - 2
    ];


  const higherHigh =
    lastHigh.price >
    previousHigh.price;


  const higherLow =
    lastLow.price >
    previousLow.price;


  const lowerHigh =
    lastHigh.price <
    previousHigh.price;


  const lowerLow =
    lastLow.price <
    previousLow.price;


  if (
    higherHigh &&
    higherLow
  ) {

    return {
      structure: "UPTREND",
      hhll: "HH + HL"
    };

  }


  if (
    lowerHigh &&
    lowerLow
  ) {

    return {
      structure: "DOWNTREND",
      hhll: "LH + LL"
    };

  }


  return {

    structure: "RANGE",

    hhll:
      higherHigh
        ? "HH"
        : lowerLow
        ? "LL"
        : "MIXED"

  };

}


/* =========================================================
   BOS
========================================================= */

function detectBOS(candles) {

  const swings =
    getSwings(candles);


  if (
    !swings.highs.length ||
    !swings.lows.length
  ) {

    return "WAITING";

  }


  const last =
    candles[candles.length - 1];


  const previousHigh =
    swings.highs[
      swings.highs.length - 1
    ];


  const previousLow =
    swings.lows[
      swings.lows.length - 1
    ];


  if (
    last.close >
    previousHigh.price
  ) {

    return "BULLISH BOS";

  }


  if (
    last.close <
    previousLow.price
  ) {

    return "BEARISH BOS";

  }


  return "NO CONFIRMED BOS";

}


/* =========================================================
   LIQUIDITY SWEEP
========================================================= */

function detectSweep(candles) {

  if (
    candles.length < 10
  ) {
    return "WAITING";
  }


  const last =
    candles[candles.length - 1];


  const previous =
    candles.slice(
      -8,
      -1
    );


  const recentHigh =
    Math.max(
      ...previous.map(
        candle =>
          candle.high
      )
    );


  const recentLow =
    Math.min(
      ...previous.map(
        candle =>
          candle.low
      )
    );


  if (
    last.high >
      recentHigh &&
    last.close <
      recentHigh
  ) {

    return "BEARISH SWEEP";

  }


  if (
    last.low <
      recentLow &&
    last.close >
      recentLow
  ) {

    return "BULLISH SWEEP";

  }


  return "NO SWEEP";

}


/* =========================================================
   MSS / CHOCH
========================================================= */

function detectMSS(
  candles,
  trend
) {

  const bos =
    detectBOS(candles);


  if (
    trend === "BEARISH" &&
    bos === "BULLISH BOS"
  ) {

    return "BULLISH MSS";

  }


  if (
    trend === "BULLISH" &&
    bos === "BEARISH BOS"
  ) {

    return "BEARISH MSS";

  }


  return "NO MSS";

}


function detectCHOCH(
  candles,
  structure
) {

  const bos =
    detectBOS(candles);


  if (
    structure === "DOWNTREND" &&
    bos === "BULLISH BOS"
  ) {

    return "BULLISH CHOCH";

  }


  if (
    structure === "UPTREND" &&
    bos === "BEARISH BOS"
  ) {

    return "BEARISH CHOCH";

  }


  return "NO CHOCH";

}


/* =========================================================
   FVG
========================================================= */

function detectFVG(candles) {

  if (
    candles.length < 5
  ) {

    return {
      type: "NONE",
      zone: null
    };

  }


  const a =
    candles[candles.length - 3];


  const b =
    candles[candles.length - 2];


  const c =
    candles[candles.length - 1];


  /* Bullish FVG */

  if (
    c.low >
    a.high
  ) {

    return {

      type: "BULLISH FVG",

      zone: {
        high: c.low,
        low: a.high
      }

    };

  }


  /* Bearish FVG */

  if (
    c.high <
    a.low
  ) {

    return {

      type: "BEARISH FVG",

      zone: {
        high: a.low,
        low: c.high
      }

    };

  }


  return {

    type: "NO FVG",

    zone: null

  };

}


/* =========================================================
   ORDER BLOCK
========================================================= */

function detectOrderBlock(candles) {

  if (
    candles.length < 6
  ) {

    return {
      type: "NONE",
      price: null
    };

  }


  const last =
    candles[candles.length - 1];


  const previous =
    candles[candles.length - 2];


  const before =
    candles[candles.length - 3];


  /* Bullish displacement */

  if (
    last.close >
      previous.high &&
    previous.close >
      before.high
  ) {

    return {

      type: "BULLISH ORDER BLOCK",

      price: previous.open

    };

  }


  /* Bearish displacement */

  if (
    last.close <
      previous.low &&
    previous.close <
      before.low
  ) {

    return {

      type: "BEARISH ORDER BLOCK",

      price: previous.open

    };

  }


  return {

    type: "NO CLEAR ORDER BLOCK",

    price: null

  };

}


/* =========================================================
   SUPPLY / DEMAND
========================================================= */

function getZones(candles) {

  const recent =
    candles.slice(-30);


  if (!recent.length) {

    return {
      supply: null,
      demand: null
    };

  }


  const supply =
    Math.max(
      ...recent.map(
        candle =>
          candle.high
      )
    );


  const demand =
    Math.min(
      ...recent.map(
        candle =>
          candle.low
      )
    );


  return {

    supply,

    demand

  };

}


/* =========================================================
   SUPPORT / RESISTANCE
========================================================= */

function getSupportResistance(
  candles
) {

  const recent =
    candles.slice(-50);


  const support =
    Math.min(
      ...recent.map(
        candle =>
          candle.low
      )
    );


  const resistance =
    Math.max(
      ...recent.map(
        candle =>
          candle.high
      )
    );


  return {

    support,

    resistance

  };

}


/* =========================================================
   ASIAN RANGE
========================================================= */

function getAsianRange(candles) {

  const asian =
    candles.filter(
      candle => {

        const date =
          new Date(
            candle.time
          );


        const hour =
          date.getUTCHours();


        return (
          hour >= 0 &&
          hour < 8
        );

      }
    );


  if (!asian.length) {

    return {

      high: null,

      low: null

    };

  }


  return {

    high:
      Math.max(
        ...asian.map(
          candle =>
            candle.high
        )
      ),

    low:
      Math.min(
        ...asian.map(
          candle =>
            candle.low
        )
      )

  };

}


/* =========================================================
   SESSION
========================================================= */

function getSession() {

  const hour =
    new Date()
      .getUTCHours();


  if (
    hour >= 0 &&
    hour < 8
  ) {

    return "ASIAN";

  }


  if (
    hour >= 8 &&
    hour < 13
  ) {

    return "LONDON";

  }


  if (
    hour >= 13 &&
    hour < 21
  ) {

    return "NEW YORK";

  }


  return "AFTER HOURS";

}


/* =========================================================
   NUMBER FORMAT
========================================================= */

function formatPrice(
  value
) {

  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {

    return "--";

  }


  const decimals =
    SYMBOLS[
      selectedSymbol
    ].decimals;


  return Number(value)
    .toFixed(decimals);

}


/* =========================================================
   MULTI-TIMEFRAME ANALYSIS
========================================================= */

async function getMultiTimeframe() {

  const result = {};


  const timeframes = [
    "240",
    "60",
    "15",
    "5"
  ];


  for (
    const tf of timeframes
  ) {

    try {

      const candles =
        await getCandles(
          tf,
          180
        );


      result[tf] = {

        candles,

        trend:
          getTrend(
            candles
          ),

        structure:
          getStructure(
            candles
          )

      };

    } catch (error) {

      result[tf] = {

        candles: [],

        trend: "ERROR",

        structure: {
          structure: "ERROR",
          hhll: "ERROR"
        }

      };

    }

  }


  return result;

}


/* =========================================================
   MTF ALIGNMENT
========================================================= */

function calculateAlignment(
  mtf
) {

  const trends = [

    mtf["240"]?.trend,

    mtf["60"]?.trend,

    mtf["15"]?.trend,

    mtf["5"]?.trend

  ];


  const bullish =
    trends.filter(
      value =>
        value === "BULLISH"
    ).length;


  const bearish =
    trends.filter(
      value =>
        value === "BEARISH"
    ).length;


  if (
    bullish >= 3
  ) {

    return "BULLISH ALIGNMENT";

  }


  if (
    bearish >= 3
  ) {

    return "BEARISH ALIGNMENT";

  }


  return "MIXED / WAIT";

}


/* =========================================================
   TRADE PLAN
========================================================= */

function buildTradePlan(
  candles,
  trend,
  bos,
  sweep,
  fvg,
  orderBlock,
  atr
) {

  if (
    !candles.length ||
    !atr
  ) {

    return null;

  }


  const price =
    candles[
      candles.length - 1
    ].close;


  let direction =
    null;


  if (
    trend === "BULLISH" &&
    (
      bos === "BULLISH BOS" ||
      sweep === "BULLISH SWEEP"
    )
  ) {

    direction = "BUY";

  }


  if (
    trend === "BEARISH" &&
    (
      bos === "BEARISH BOS" ||
      sweep === "BEARISH SWEEP"
    )
  ) {

    direction = "SELL";

  }


  if (!direction) {

    return null;

  }


  let entry =
    price;


  if (
    fvg.zone
  ) {

    entry =
      (
        fvg.zone.high +
        fvg.zone.low
      ) / 2;

  }


  if (
    orderBlock.price
  ) {

    entry =
      (
        entry +
        orderBlock.price
      ) / 2;

  }


  let stopDistance =
    atr * 1.2;


  let sl;
  let tp1;
  let tp2;
  let tp3;


  if (
    direction === "BUY"
  ) {

    sl =
      entry -
      stopDistance;


    tp1 =
      entry +
      stopDistance *
      1.5;


    tp2 =
      entry +
      stopDistance *
      2;


    tp3 =
      entry +
      stopDistance *
      3;

  } else {

    sl =
      entry +
      stopDistance;


    tp1 =
      entry -
      stopDistance *
      1.5;


    tp2 =
      entry -
      stopDistance *
      2;


    tp3 =
      entry -
      stopDistance *
      3;

  }


  return {

    direction,

    entry,

    sl,

    tp1,

    tp2,

    tp3,

    rr: "1 : 1.5 / 1 : 2 / 1 : 3"

  };

}


/* =========================================================
   UPDATE TRADE PLAN
========================================================= */

function renderTradePlan(
  plan
) {

  if (!plan) {

    setText(
      "planEntry",
      "--"
    );

    setText(
      "planSL",
      "--"
    );

    setText(
      "planTP1",
      "--"
    );

    setText(
      "planTP2",
      "--"
    );

    setText(
      "planTP3",
      "--"
    );

    setText(
      "riskReward",
      "--"
    );

    return;

  }


  setText(
    "planEntry",
    formatPrice(
      plan.entry
    )
  );


  setText(
    "planSL",
    formatPrice(
      plan.sl
    )
  );


  setText(
    "planTP1",
    formatPrice(
      plan.tp1
    )
  );


  setText(
    "planTP2",
    formatPrice(
      plan.tp2
    )
  );


  setText(
    "planTP3",
    formatPrice(
      plan.tp3
    )
  );


  setText(
    "riskReward",
    plan.rr
  );


  setText(
    "entry",
    formatPrice(
      plan.entry
    )
  );


  setText(
    "stopLoss",
    formatPrice(
      plan.sl
    )
  );


  setText(
    "takeProfit",
    formatPrice(
      plan.tp1
    )
  );

}


/* =========================================================
   SIGNAL ENGINE
========================================================= */

function createSignal(
  mtf,
  candles
) {

  const tf15 =
    mtf["15"];


  if (
    !tf15 ||
    !tf15.candles.length
  ) {

    return {

      signal: "WAIT",

      reason:
        "Waiting for enough market data.",

      plan: null

    };

  }


  const data =
    tf15.candles;


  const trend =
    getTrend(data);


  const structure =
    getStructure(data);


  const bos =
    detectBOS(data);


  const sweep =
    detectSweep(data);


  const fvg =
    detectFVG(data);


  const ob =
    detectOrderBlock(data);


  const atr =
    calculateATR(data);


  const alignment =
    calculateAlignment(
      mtf
    );


  const plan =
    buildTradePlan(
      data,
      trend,
      bos,
      sweep,
      fvg,
      ob,
      atr
    );


  /* Strong BUY */

  if (
    alignment ===
      "BULLISH ALIGNMENT" &&
    trend === "BULLISH" &&
    (
      bos === "BULLISH BOS" ||
      sweep === "BULLISH SWEEP"
    )
  ) {

    return {

      signal: "BUY",

      reason:
        "Bullish higher-timeframe alignment with structure/liquidity confirmation.",

      plan

    };

  }


  /* Strong SELL */

  if (
    alignment ===
      "BEARISH ALIGNMENT" &&
    trend === "BEARISH" &&
    (
      bos === "BEARISH BOS" ||
      sweep === "BEARISH SWEEP"
    )
  ) {

    return {

      signal: "SELL",

      reason:
        "Bearish higher-timeframe alignment with structure/liquidity confirmation.",

      plan

    };

  }


  /* Waiting */

  let reason =
    "Waiting for confirmation.";


  if (
    alignment ===
      "MIXED / WAIT"
  ) {

    reason =
      "Higher timeframes are not aligned.";

  }


  if (
    alignment !==
      "MIXED / WAIT" &&
    bos ===
      "NO CONFIRMED BOS"
  ) {

    reason =
      "Waiting for a confirmed Break of Structure.";

  }


  return {

    signal: "WAIT",

    reason,

    plan: null

  };

}


/* =========================================================
   RENDER MAIN ANALYSIS
========================================================= */

function renderAnalysis(
  mtf
) {

  const tf15 =
    mtf["15"];


  if (
    !tf15 ||
    !tf15.candles.length
  ) {

    return;

  }


  const candles =
    tf15.candles;


  const trend =
    getTrend(candles);


  const structure =
    getStructure(candles);


  const rsi =
    calculateRSI(candles);


  const atr =
    calculateATR(candles);


  const bos =
    detectBOS(candles);


  const sweep =
    detectSweep(candles);


  const mss =
    detectMSS(
      candles,
      trend
    );


  const choch =
    detectCHOCH(
      candles,
      structure.structure
    );


  const fvg =
    detectFVG(candles);


  const ob =
    detectOrderBlock(candles);


  const zones =
    getZones(candles);


  const sr =
    getSupportResistance(
      candles
    );


  const asian =
    getAsianRange(
      candles
    );


  const alignment =
    calculateAlignment(
      mtf
    );


  /* Main structure */

  setText(
    "trend",
    trend
  );


  setText(
    "structure",
    structure.structure
  );


  setText(
    "momentum",
    rsi === null
      ? "WAITING"
      : rsi >= 50
      ? "BULLISH"
      : "BEARISH"
  );


  setText(
    "liquidity",
    sweep
  );


  setText(
    "marketState",
    alignment
  );


  /* MTF */

  setText(
    "trend4h",
    mtf["240"].trend
  );


  setText(
    "trend1h",
    mtf["60"].trend
  );


  setText(
    "trend15m",
    mtf["15"].trend
  );


  setText(
    "trend5m",
    mtf["5"].trend
  );


  setText(
    "mtfAlignment",
    alignment
  );


  /* Structure */

  setText(
    "bos",
    bos
  );


  setText(
    "bosCondition",
    bos
  );


  setText(
    "choch",
    choch
  );


  setText(
    "mss",
    mss
  );


  setText(
    "swingStructure",
    structure.structure
  );


  setText(
    "hhll",
    structure.hhll
  );


  /* Liquidity */

  setText(
    "sweep",
    sweep
  );


  setText(
    "buyLiquidity",
    formatPrice(
      sr.resistance
    )
  );


  setText(
    "sellLiquidity",
    formatPrice(
      sr.support
    )
  );


  setText(
    "equalHighs",
    "Scanning"
  );


  setText(
    "equalLows",
    "Scanning"
  );


  /* Smart money zones */

  setText(
    "fvg",
    fvg.type
  );


  setText(
    "fvgStatus",
    fvg.zone
      ? "ACTIVE"
      : "NONE"
  );


  setText(
    "orderBlock",
    ob.type
  );


  setText(
    "supply",
    formatPrice(
      zones.supply
    )
  );


  setText(
    "demand",
    formatPrice(
      zones.demand
    )
  );


  /* Technical */

  const closes =
    candles.map(
      candle =>
        candle.close
    );


  const ema9 =
    ema(
      closes,
      9
    );


  const ema21 =
    ema(
      closes,
      21
    );


  let emaState =
    "WAITING";


  if (
    ema9 !== null &&
    ema21 !== null
  ) {

    emaState =
      ema9 > ema21
        ? "BULLISH"
        : ema9 < ema21
        ? "BEARISH"
        : "NEUTRAL";

  }


  setText(
    "emaCondition",
    emaState
  );


  setText(
    "rsi",
    rsi === null
      ? "--"
      : rsi.toFixed(1)
  );


  setText(
    "atr",
    formatPrice(
      atr
    )
  );


  setText(
    "support",
    formatPrice(
      sr.support
    )
  );


  setText(
    "resistance",
    formatPrice(
      sr.resistance
    )
  );


  /* Asian */

  setText(
    "asianHigh",
    formatPrice(
      asian.high
    )
  );


  setText(
    "asianLow",
    formatPrice(
      asian.low
    )
  );


  setText(
    "session",
    getSession()
  );


  setText(
    "marketOpen",
    "LIVE"
  );


  /* Signal */

  const signal =
    createSignal(
      mtf,
      candles
    );


  setText(
    "signal",
    signal.signal
  );


  setText(
    "signalReason",
    signal.reason
  );


  setText(
    "signalTime",
    new Date()
      .toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit"
        }
      )
  );


  renderTradePlan(
    signal.plan
  );


  /* Waiting engine */

  if (
    signal.signal ===
    "BUY"
  ) {

    setText(
      "waitingTitle",
      "BUY setup detected"
    );


    setText(
      "waitingText",
      "Bullish conditions are aligned. Wait for a clean entry confirmation/pullback before taking risk."
    );

  }

  else if (
    signal.signal ===
    "SELL"
  ) {

    setText(
      "waitingTitle",
      "SELL setup detected"
    );


    setText(
      "waitingText",
      "Bearish conditions are aligned. Wait for a clean entry confirmation/pullback before taking risk."
    );

  }

  else {

    setText(
      "waitingTitle",
      "What are we waiting for?"
    );


    setText(
      "waitingText",
      signal.reason
    );

  }


  /* Checklist */

  updateChecklist(
    trend,
    structure.structure,
    sweep,
    bos,
    fvg,
    ob,
    signal
  );

}


/* =========================================================
   CHECKLIST
========================================================= */

function updateChecklist(
  trend,
  structure,
  sweep,
  bos,
  fvg,
  ob,
  signal
) {

  const trendOK =
    trend === "BULLISH" ||
    trend === "BEARISH";


  const structureOK =
    structure === "UPTREND" ||
    structure === "DOWNTREND";


  const liquidityOK =
    sweep ===
      "BULLISH SWEEP" ||
    sweep ===
      "BEARISH SWEEP";


  const bosOK =
    bos ===
      "BULLISH BOS" ||
    bos ===
      "BEARISH BOS";


  const zoneOK =
    fvg.type !== "NO FVG" ||
    ob.type !==
      "NO CLEAR ORDER BLOCK";


  if ($("checkTrend"))
    $("checkTrend").checked =
      trendOK;


  if ($("checkStructure"))
    $("checkStructure").checked =
      structureOK;


  if ($("checkLiquidity"))
    $("checkLiquidity").checked =
      liquidityOK;


  if ($("checkBOS"))
    $("checkBOS").checked =
      bosOK;


  if ($("checkZone"))
    $("checkZone").checked =
      zoneOK;


  if ($("checkEntry"))
    $("checkEntry").checked =
      signal.signal === "BUY" ||
      signal.signal === "SELL";


  if ($("checkRisk"))
    $("checkRisk").checked =
      false;

}


/* =========================================================
   PRICE UPDATE
========================================================= */

async function updatePrice() {

  try {

    const price =
      await getPrice();


    const previous =
      currentPrice;


    currentPrice =
      price;


    setText(
      "marketPrice",
      formatPrice(price)
    );


    if (
      previous !== null
    ) {

      const difference =
        price -
        previous;


      const percentage =
        (
          difference /
          previous
        ) * 100;


      const changeElement =
        $("priceChange");


      if (changeElement) {

        changeElement.textContent =
          `${difference >= 0 ? "+" : ""}${percentage.toFixed(3)}%`;


        changeElement.className =
          difference >= 0
            ? "positive"
            : "negative";

      }

    }


  } catch (error) {

    console.error(
      "Price error:",
      error
    );

  }

}


/* =========================================================
   MAIN MARKET LOAD
========================================================= */

async function loadMarket() {

  const key =
    getApiKey();


  if (!key) {

    setStatus(
      "Add Twelve Data API Key",
      false
    );


    setText(
      "marketPrice",
      "API KEY NEEDED"
    );


    return;

  }


  setStatus(
    "Loading Live Market...",
    false
  );


  try {

    await updatePrice();


    const mtf =
      await getMultiTimeframe();


    marketData =
      mtf;


    renderAnalysis(
      mtf
    );


    setStatus(
      "Live Data Connected",
      true
    );


  } catch (error) {

    console.error(
      "Market loading error:",
      error
    );


    setStatus(
      "Data Connection Error",
      false
    );


    setText(
      "waitingTitle",
      "Market data problem"
    );


    setText(
      "waitingText",
      error.message ||
      "Unable to load market data."
    );

  }

}


/* =========================================================
   TRADINGVIEW CHART
========================================================= */

function loadTradingView() {

  const container =
    $("tradingview_chart");


  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (
    typeof TradingView ===
    "undefined"
  ) {

    container.innerHTML =
      "<p style='padding:20px'>TradingView is loading...</p>";

    return;

  }


  new TradingView.widget({

    autosize: true,

    symbol:
      SYMBOLS[
        selectedSymbol
      ].tv,

    interval:
      selectedTimeframe === "5"
        ? "5"
        : selectedTimeframe === "15"
        ? "15"
        : selectedTimeframe === "60"
        ? "60"
        : "240",

    timezone:
      "Etc/UTC",

    theme:
      "dark",

    style:
      "1",

    locale:
      "en",

    toolbar_bg:
      "#050807",

    enable_publishing:
      false,

    hide_top_toolbar:
      false,

    hide_legend:
      false,

    save_image:
      false,

    container_id:
      "tradingview_chart"

  });

}


/* =========================================================
   PAIR SELECTION
========================================================= */

function setupPairButtons() {

  const buttons =
    document.querySelectorAll(
      ".pair"
    );


  buttons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        buttons.forEach(
          item =>
            item.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );


        selectedSymbol =
          button.dataset.symbol;


        setText(
          "selectedPair",
          SYMBOLS[
            selectedSymbol
          ].display
        );


        currentPrice =
          null;


        loadTradingView();

        loadMarket();

      }
    );

  });

}


/* =========================================================
   TIMEFRAME BUTTONS
========================================================= */

function setupTimeframes() {

  const buttons =
    document.querySelectorAll(
      ".timeframe"
    );


  buttons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        buttons.forEach(
          item =>
            item.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );


        selectedTimeframe =
          button.dataset.timeframe;


        loadTradingView();

        loadMarket();

      }
    );

  });

}


/* =========================================================
   REFRESH BUTTON
========================================================= */

function setupRefresh() {

  const button =
    $("refreshButton");


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    async () => {

      button.textContent =
        "⏳ Scanning Market...";


      await loadMarket();


      button.textContent =
        "🔄 Refresh Market Analysis";

    }
  );

}


/* =========================================================
   API BUTTON
========================================================= */

function setupApi() {

  const button =
    $("saveApi");


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    saveApiKey
  );

}


/* =========================================================
   AUTO REFRESH
========================================================= */

function startAutoRefresh() {

  if (refreshTimer) {

    clearInterval(
      refreshTimer
    );

  }


  refreshTimer =
    setInterval(
      () => {

        loadMarket();

      },
      REFRESH_MS
    );

}


/* =========================================================
   INITIALIZATION
========================================================= */

async function init() {

  console.log(
    "SwiftDrop FX starting..."
  );


  loadSavedApiKey();


  setupPairButtons();


  setupTimeframes();


  setupRefresh();


  setupApi();


  loadTradingView();


  startAutoRefresh();


  await loadMarket();

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);