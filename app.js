/* =====================================================
   SWIFTDROP FX
   MARKET ANALYSIS ENGINE
   ===================================================== */


/* -----------------------------
   GLOBAL VARIABLES
----------------------------- */

let selectedSymbol = "EURUSD";

let selectedTimeframe = "15";

let currentPrice = null;

let candles = [];

let analysisTimer = null;


/* -----------------------------
   SYMBOL MAP
----------------------------- */

const symbols = {

  EURUSD: {
    tv: "FX:EURUSD",
    api: "EUR/USD"
  },

  GBPUSD: {
    tv: "FX:GBPUSD",
    api: "GBP/USD"
  },

  XAUUSD: {
    tv: "OANDA:XAUUSD",
    api: "XAU/USD"
  },

  USDJPY: {
    tv: "FX:USDJPY",
    api: "USD/JPY"
  },

  AUDUSD: {
    tv: "FX:AUDUSD",
    api: "AUD/USD"
  },

  USDCAD: {
    tv: "FX:USDCAD",
    api: "USD/CAD"
  }

};


/* -----------------------------
   DOM
----------------------------- */

const pairButtons =
  document.querySelectorAll(".pair");

const timeframeButtons =
  document.querySelectorAll(".timeframe");

const selectedPair =
  document.getElementById("selectedPair");

const marketPrice =
  document.getElementById("marketPrice");

const priceChange =
  document.getElementById("priceChange");

const trend =
  document.getElementById("trend");

const structure =
  document.getElementById("structure");

const momentum =
  document.getElementById("momentum");

const liquidity =
  document.getElementById("liquidity");

const signal =
  document.getElementById("signal");

const signalReason =
  document.getElementById("signalReason");

const entry =
  document.getElementById("entry");

const stopLoss =
  document.getElementById("stopLoss");

const takeProfit =
  document.getElementById("takeProfit");

const emaCondition =
  document.getElementById("emaCondition");

const rsi =
  document.getElementById("rsi");

const bos =
  document.getElementById("bos");

const sweep =
  document.getElementById("sweep");

const support =
  document.getElementById("support");

const resistance =
  document.getElementById("resistance");

const waitingTitle =
  document.getElementById("waitingTitle");

const waitingText =
  document.getElementById("waitingText");

const signalTime =
  document.getElementById("signalTime");

const connectionStatus =
  document.getElementById("connectionStatus");

const apiKeyInput =
  document.getElementById("apiKey");

const saveApi =
  document.getElementById("saveApi");

const refreshButton =
  document.getElementById("refreshButton");


/* -----------------------------
   TRADINGVIEW CHART
----------------------------- */

function loadChart() {

  const container =
    document.getElementById(
      "tradingview_chart"
    );

  container.innerHTML = "";

  if (typeof TradingView === "undefined") {

    container.innerHTML =
      "<div style='padding:30px;color:#888'>TradingView is loading...</div>";

    return;

  }


  new TradingView.widget({

    autosize: true,

    symbol:
      symbols[selectedSymbol].tv,

    interval:
      selectedTimeframe,

    timezone:
      "Africa/Lagos",

    theme:
      "dark",

    style:
      "1",

    locale:
      "en",

    enable_publishing:
      false,

    allow_symbol_change:
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


/* -----------------------------
   PAIR SELECTION
----------------------------- */

pairButtons.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      pairButtons.forEach(
        b => b.classList.remove("active")
      );

      button.classList.add("active");

      selectedSymbol =
        button.dataset.symbol;

      selectedPair.textContent =
        formatSymbol(selectedSymbol);

      resetAnalysis();

      loadChart();

      fetchMarketData();

    }
  );

});


/* -----------------------------
   TIMEFRAME
----------------------------- */

timeframeButtons.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      timeframeButtons.forEach(
        b => b.classList.remove("active")
      );

      button.classList.add("active");

      selectedTimeframe =
        button.dataset.timeframe;

      loadChart();

      fetchMarketData();

    }
  );

});


/* -----------------------------
   FORMAT SYMBOL
----------------------------- */

function formatSymbol(symbol) {

  if (symbol === "XAUUSD")
    return "XAU/USD";

  return (
    symbol.substring(0, 3) +
    "/" +
    symbol.substring(3)
  );

}


/* -----------------------------
   RESET
----------------------------- */

function resetAnalysis() {

  marketPrice.textContent =
    "Loading...";

  priceChange.textContent =
    "--";

  signal.className =
    "signal wait";

  signal.textContent =
    "WAIT";

  signalReason.textContent =
    "Waiting for fresh market data...";

  entry.textContent = "--";

  stopLoss.textContent = "--";

  takeProfit.textContent = "--";

}


/* -----------------------------
   GET API KEY
----------------------------- */

function getApiKey() {

  return localStorage.getItem(
    "swiftdrop_api_key"
  ) || "";

}


/* -----------------------------
   SAVE API KEY
----------------------------- */

saveApi.addEventListener(
  "click",
  () => {

    const key =
      apiKeyInput.value.trim();

    if (!key) {

      alert(
        "Enter your Twelve Data API key first."
      );

      return;

    }

    localStorage.setItem(
      "swiftdrop_api_key",
      key
    );

    connectionStatus.textContent =
      "API Key Saved";

    alert(
      "API key saved successfully."
    );

    fetchMarketData();

  }
);


/* -----------------------------
   LOAD SAVED KEY
----------------------------- */

const savedKey =
  getApiKey();

if (savedKey) {

  apiKeyInput.value =
    savedKey;

}


/* -----------------------------
   FETCH LIVE DATA
----------------------------- */

async function fetchMarketData() {

  const apiKey =
    getApiKey();


  if (!apiKey) {

    connectionStatus.textContent =
      "Demo Mode";

    runDemoAnalysis();

    return;

  }


  connectionStatus.textContent =
    "Connecting...";


  try {

    const interval =
      getApiInterval(selectedTimeframe);


    const url =
      "https://api.twelvedata.com/time_series" +
      "?symbol=" +
      encodeURIComponent(
        symbols[selectedSymbol].api
      ) +
      "&interval=" +
      interval +
      "&outputsize=100" +
      "&apikey=" +
      encodeURIComponent(apiKey);


    const response =
      await fetch(url);


    const data =
      await response.json();


    if (
      data.status === "error" ||
      !data.values
    ) {

      throw new Error(
        data.message ||
        "Unable to get market data"
      );

    }


    candles =
      data.values.reverse();


    if (!candles.length) {

      throw new Error(
        "No candle data returned."
      );

    }


    connectionStatus.textContent =
      "Live Data Connected";


    analyzeMarket(candles);


  } catch (error) {

    console.error(error);

    connectionStatus.textContent =
      "Connection Error";

    signal.className =
      "signal wait";

    signal.textContent =
      "WAIT";

    signalReason.textContent =
      "Live data unavailable. Check your API key or connection.";

  }

}


/* -----------------------------
   TIMEFRAME CONVERSION
----------------------------- */

function getApiInterval(tf) {

  if (tf === "5")
    return "5min";

  if (tf === "15")
    return "15min";

  if (tf === "60")
    return "1h";

  if (tf === "240")
    return "4h";

  return "15min";

}


/* =====================================================
   MARKET ANALYSIS ENGINE
   ===================================================== */

function analyzeMarket(data) {

  if (data.length < 30) {

    signalReason.textContent =
      "Not enough candle data.";

    return;

  }


  const closes =
    data.map(c => Number(c.close));

  const highs =
    data.map(c => Number(c.high));

  const lows =
    data.map(c => Number(c.low));


  const latest =
    closes[closes.length - 1];

  currentPrice =
    latest;


  marketPrice.textContent =
    formatPrice(latest);


  /* -----------------------------
     EMA
  ----------------------------- */

  const ema9 =
    calculateEMA(closes, 9);

  const ema21 =
    calculateEMA(closes, 21);


  const ema9Now =
    ema9[ema9.length - 1];

  const ema21Now =
    ema21[ema21.length - 1];


  let direction;


  if (ema9Now > ema21Now) {

    direction =
      "BULLISH";

    emaCondition.textContent =
      "Bullish";

    emaCondition.className =
      "positive";

  }

  else if (ema9Now < ema21Now) {

    direction =
      "BEARISH";

    emaCondition.textContent =
      "Bearish";

    emaCondition.className =
      "negative";

  }

  else {

    direction =
      "NEUTRAL";

    emaCondition.textContent =
      "Neutral";

  }


  trend.textContent =
    direction;


  setColor(
    trend,
    direction
  );


  /* -----------------------------
     RSI
  ----------------------------- */

  const rsiValue =
    calculateRSI(
      closes,
      14
    );


  rsi.textContent =
    rsiValue.toFixed(1);


  if (rsiValue > 70) {

    rsi.className =
      "negative";

    momentum.textContent =
      "Overbought";

  }

  else if (rsiValue < 30) {

    rsi.className =
      "positive";

    momentum.textContent =
      "Oversold";

  }

  else {

    rsi.className =
      "";

    momentum.textContent =
      rsiValue >= 50
        ? "Bullish"
        : "Bearish";

  }


  setColor(
    momentum,
    momentum.textContent
  );


  /* -----------------------------
     SUPPORT / RESISTANCE
  ----------------------------- */

  const recentHigh =
    Math.max(
      ...highs.slice(-20)
    );

  const recentLow =
    Math.min(
      ...lows.slice(-20)
    );


  resistance.textContent =
    formatPrice(recentHigh);

  support.textContent =
    formatPrice(recentLow);


  /* -----------------------------
     MARKET STRUCTURE
  ----------------------------- */

  const structureResult =
    detectStructure(
      highs,
      lows
    );


  structure.textContent =
    structureResult;


  setColor(
    structure,
    structureResult
  );


  /* -----------------------------
     BREAK OF STRUCTURE
  ----------------------------- */

  const bosResult =
    detectBOS(
      highs,
      lows,
      direction
    );


  bos.textContent =
    bosResult;


  /* -----------------------------
     LIQUIDITY SWEEP
  ----------------------------- */

  const sweepResult =
    detectLiquiditySweep(
      highs,
      lows,
      closes
    );


  sweep.textContent =
    sweepResult;


  liquidity.textContent =
    sweepResult;


  setColor(
    liquidity,
    sweepResult
  );


  /* -----------------------------
     SIGNAL ENGINE
  ----------------------------- */

  generateSignal({

    price: latest,

    direction,

    rsi: rsiValue,

    structure:
      structureResult,

    bos:
      bosResult,

    sweep:
      sweepResult,

    support:
      recentLow,

    resistance:
      recentHigh

  });

}


/* =====================================================
   SIGNAL GENERATOR
   ===================================================== */

function generateSignal(data) {

  let scoreBuy = 0;

  let scoreSell = 0;


  /* Trend */

  if (data.direction === "BULLISH")
    scoreBuy += 2;

  if (data.direction === "BEARISH")
    scoreSell += 2;


  /* RSI */

  if (
    data.rsi > 50 &&
    data.rsi < 70
  )

    scoreBuy++;


  if (
    data.rsi < 50 &&
    data.rsi > 30
  )

    scoreSell++;


  /* Structure */

  if (
    data.structure ===
    "BULLISH STRUCTURE"
  )

    scoreBuy += 2;


  if (
    data.structure ===
    "BEARISH STRUCTURE"
  )

    scoreSell += 2;


  /* BOS */

  if (
    data.bos ===
    "BULLISH BOS"
  )

    scoreBuy += 2;


  if (
    data.bos ===
    "BEARISH BOS"
  )

    scoreSell += 2;


  /* Liquidity */

  if (
    data.sweep ===
    "BULLISH SWEEP"
  )

    scoreBuy += 2;


  if (
    data.sweep ===
    "BEARISH SWEEP"
  )

    scoreSell += 2;


  /* -----------------------------
     BUY
  ----------------------------- */

  if (
    scoreBuy >= 6 &&
    scoreBuy > scoreSell
  ) {

    showBuySignal(data);

    return;

  }


  /* -----------------------------
     SELL
  ----------------------------- */

  if (
    scoreSell >= 6 &&
    scoreSell > scoreBuy
  ) {

    showSellSignal(data);

    return;

  }


  /* -----------------------------
     WAIT
  ----------------------------- */

  showWaitSignal(
    scoreBuy,
    scoreSell
  );

}


/* -----------------------------
   BUY SIGNAL
----------------------------- */

function showBuySignal(data) {

  signal.className =
    "signal buy";

  signal.textContent =
    "BUY";

  signalReason.textContent =
    "Bullish conditions are aligned. Wait for a clean entry confirmation/retest before entering.";

  entry.textContent =
    formatPrice(data.price);

  const risk =
    calculateRiskDistance(
      data.price
    );


  stopLoss.textContent =
    formatPrice(
      data.price - risk
    );


  takeProfit.textContent =
    formatPrice(
      data.price + risk * 2
    );


  waitingTitle.textContent =
    "Buy setup detected";


  waitingText.textContent =
    "Wait for confirmation or a retest. Do not chase a candle.";

  signalTime.textContent =
    currentTime();

}


/* -----------------------------
   SELL SIGNAL
----------------------------- */

function showSellSignal(data) {

  signal.className =
    "signal sell";

  signal.textContent =
    "SELL";

  signalReason.textContent =
    "Bearish conditions are aligned. Wait for a clean entry confirmation/retest before entering.";

  entry.textContent =
    formatPrice(data.price);

  const risk =
    calculateRiskDistance(
      data.price
    );


  stopLoss.textContent =
    formatPrice(
      data.price + risk
    );


  takeProfit.textContent =
    formatPrice(
      data.price - risk * 2
    );


  waitingTitle.textContent =
    "Sell setup detected";


  waitingText.textContent =
    "Wait for confirmation or a retest. Do not chase a candle.";

  signalTime.textContent =
    currentTime();

}


/* -----------------------------
   WAIT
----------------------------- */

function showWaitSignal(
  buyScore,
  sellScore
) {

  signal.className =
    "signal wait";

  signal.textContent =
    "WAIT";


  if (
    Math.abs(
      buyScore - sellScore
    ) <= 1
  ) {

    signalReason.textContent =
      "The market is mixed. There is no clean directional advantage yet.";

    waitingTitle.textContent =
      "We are waiting for direction";

    waitingText.textContent =
      "Wait for trend + structure + momentum to align.";

  }

  else {

    signalReason.textContent =
      "Some conditions are present, but the setup is not strong enough.";

    waitingTitle.textContent =
      "What are we waiting for?";

    waitingText.textContent =
      "We need stronger confirmation before considering an entry.";

  }


  entry.textContent =
    "--";

  stopLoss.textContent =
    "--";

  takeProfit.textContent =
    "--";

}


/* =====================================================
   EMA
   ===================================================== */

function calculateEMA(
  values,
  period
) {

  const result = [];

  const multiplier =
    2 / (period + 1);


  let ema =
    values
      .slice(0, period)
      .reduce(
        (a, b) => a + b,
        0
      ) / period;


  result.push(ema);


  for (
    let i = period;
    i < values.length;
    i++
  ) {

    ema =
      (
        values[i] - ema
      ) *
      multiplier +
      ema;


    result.push(ema);

  }


  return result;

}


/* =====================================================
   RSI
   ===================================================== */

function calculateRSI(
  prices,
  period
) {

  if (
    prices.length <= period
  )

    return 50;


  let gains = 0;

  let losses = 0;


  for (
    let i = 1;
    i <= period;
    i++
  ) {

    const change =
      prices[i] -
      prices[i - 1];


    if (change >= 0)
      gains += change;

    else
      losses -= change;

  }


  let avgGain =
    gains / period;


  let avgLoss =
    losses / period;


  for (
    let i = period + 1;
    i < prices.length;
    i++
  ) {

    const change =
      prices[i] -
      prices[i - 1];


    const gain =
      Math.max(
        change,
        0
      );


    const loss =
      Math.max(
        -change,
        0
      );


    avgGain =
      (
        avgGain *
        (period - 1) +
        gain
      ) / period;


    avgLoss =
      (
        avgLoss *
        (period - 1) +
        loss
      ) / period;

  }


  if (avgLoss === 0)
    return 100;


  const rs =
    avgGain /
    avgLoss;


  return 100 -
    (
      100 /
      (1 + rs)
    );

}


/* =====================================================
   STRUCTURE
   ===================================================== */

function detectStructure(
  highs,
  lows
) {

  const h1 =
    highs[highs.length - 1];

  const h2 =
    highs[highs.length - 6];

  const l1 =
    lows[lows.length - 1];

  const l2 =
    lows[lows.length - 6];


  if (
    h1 > h2 &&
    l1 > l2
  )

    return "BULLISH STRUCTURE";


  if (
    h1 < h2 &&
    l1 < l2
  )

    return "BEARISH STRUCTURE";


  return "RANGE";


}


/* =====================================================
   BOS
   ===================================================== */

function detectBOS(
  highs,
  lows,
  direction
) {

  const price =
    direction === "BULLISH"
      ? highs[highs.length - 1]
      : lows[lows.length - 1];


  const previousHigh =
    Math.max(
      ...highs.slice(-10, -1)
    );


  const previousLow =
    Math.min(
      ...lows.slice(-10, -1)
    );


  if (
    direction === "BULLISH" &&
    price > previousHigh
  )

    return "BULLISH BOS";


  if (
    direction === "BEARISH" &&
    price < previousLow
  )

    return "BEARISH BOS";


  return "NO BOS";

}


/* =====================================================
   LIQUIDITY SWEEP
   ===================================================== */

function detectLiquiditySweep(
  highs,
  lows,
  closes
) {

  const last =
    closes.length - 1;


  const previousHigh =
    Math.max(
      ...highs.slice(-10, -1)
    );


  const previousLow =
    Math.min(
      ...lows.slice(-10, -1)
    );


  const lastHigh =
    highs[last];


  const lastLow =
    lows[last];


  const lastClose =
    closes[last];


  if (
    lastLow < previousLow &&
    lastClose > previousLow
  )

    return "BULLISH SWEEP";


  if (
    lastHigh > previousHigh &&
    lastClose < previousHigh
  )

    return "BEARISH SWEEP";


  return "NO SWEEP";

}


/* =====================================================
   RISK
   ===================================================== */

function calculateRiskDistance(
  price
) {

  if (
    selectedSymbol ===
    "XAUUSD"
  )

    return price * 0.001;


  if (
    selectedSymbol ===
    "USDJPY"
  )

    return price * 0.0008;


  return price * 0.0007;

}


/* =====================================================
   PRICE FORMAT
   ===================================================== */

function formatPrice(
  price
) {

  if (
    selectedSymbol ===
    "USDJPY"
  )

    return price.toFixed(3);


  if (
    selectedSymbol ===
    "XAUUSD"
  )

    return price.toFixed(2);


  return price.toFixed(5);

}


/* =====================================================
   COLORS
   ===================================================== */

function setColor(
  element,
  value
) {

  element.classList.remove(
    "positive",
    "negative"
  );


  if (
    value.includes("BULLISH") ||
    value.includes("BUY")
  )

    element.classList.add(
      "positive"
    );


  if (
    value.includes("BEARISH") ||
    value.includes("SELL")
  )

    element.classList.add(
      "negative"
    );

}


/* =====================================================
   TIME
   ===================================================== */

function currentTime() {

  return new Date()
    .toLocaleTimeString(
      "en-NG",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

}


/* =====================================================
   DEMO ANALYSIS
   ===================================================== */

function runDemoAnalysis() {

  connectionStatus.textContent =
    "Demo Mode";


  const fakePrice =
    selectedSymbol === "XAUUSD"
      ? 2650 + Math.random() * 20
      : selectedSymbol === "USDJPY"
      ? 148 + Math.random()
      : 1.05 + Math.random() * .05;


  currentPrice =
    fakePrice;


  marketPrice.textContent =
    formatPrice(
      fakePrice
    );


  trend.textContent =
    "WAITING";


  structure.textContent =
    "WAITING";


  momentum.textContent =
    "WAITING";


  liquidity.textContent =
    "WAITING";


  emaCondition.textContent =
    "WAITING";


  bos.textContent =
    "WAITING";


  sweep.textContent =
    "WAITING";


  signal.className =
    "signal wait";


  signal.textContent =
    "WAIT";


  signalReason.textContent =
    "Add your Twelve Data API key to activate live market analysis.";


  waitingTitle.textContent =
    "What are we waiting for?";


  waitingText.textContent =
    "Live candles. Once connected, SwiftDrop FX will analyse trend, structure, momentum and liquidity.";

}


/* =====================================================
   REFRESH
   ===================================================== */

refreshButton.addEventListener(
  "click",
  () => {

    fetchMarketData();

  }
);


/* =====================================================
   AUTO UPDATE
   ===================================================== */

function startAutoUpdate() {

  if (analysisTimer)
    clearInterval(
      analysisTimer
    );


  analysisTimer =
    setInterval(
      () => {

        fetchMarketData();

      },
      60000
    );

}


/* =====================================================
   START APP
   ===================================================== */

loadChart();

fetchMarketData();

startAutoUpdate();