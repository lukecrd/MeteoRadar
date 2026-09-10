var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_meta = {};
import_dotenv.default.config();
var __filename = (0, import_url.fileURLToPath)(import_meta.url);
var __dirname = import_path.default.dirname(__filename);
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
var aiClient = null;
function getGeminiClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/weather/predict-changes", async (req, res) => {
  const {
    location,
    currentTemp = 20,
    humidity = 60,
    humidityChangeRate = 0,
    windSpeed = 10,
    windDirection = 180,
    windGusts = 15,
    pressure = 1013,
    lightningCount = 0,
    lightningDistance = 99,
    hourlyForecast = []
  } = req.body || {};
  const generateRuleBasedReport = (note) => {
    const isRapidHumidityIncrease = humidityChangeRate > 4;
    const isCloseLightning = lightningDistance <= 15;
    const isVeryHighHumidity = humidity > 85;
    const isLowPressure = pressure < 1008;
    const riskLevel = isCloseLightning || isRapidHumidityIncrease && humidityChangeRate > 8 ? "CRITICO" : isRapidHumidityIncrease || isVeryHighHumidity || lightningCount > 0 ? "MODERATO" : "STABILE";
    let predictionText = "Masse d'aria stabili nelle prossime ore con variazioni termodinamiche regolari.";
    if (isRapidHumidityIncrease && isCloseLightning) {
      predictionText = `Allerta instabilit\xE0 marcata: l'incremento di umidit\xE0 (+${humidityChangeRate.toFixed(1)}%/h) combinato a scariche a ${lightningDistance} km indica l'impatto di un fronte temporalesco attivo entro 30-60 minuti.`;
    } else if (isRapidHumidityIncrease) {
      predictionText = `Rilevato repentino gradiente di umidit\xE0 (+${humidityChangeRate.toFixed(1)}%/h): probabile formazione di nubi a sviluppo verticale e rovesci a breve termine.`;
    } else if (isLowPressure) {
      predictionText = `Minimo barometrico (${pressure} hPa) che favorisce addensamenti e instabilit\xE0 locale diffusa.`;
    }
    return {
      summary: `Quadro per ${location?.name || "Localit\xE0"}: ${currentTemp}\xB0C, Umidit\xE0 ${humidity}%, Vento ${windSpeed} km/h da ${windDirection}\xB0, Pressione ${pressure} hPa.${note ? ` (${note})` : ""}`,
      prediction: predictionText,
      riskLevel,
      lightningRisk: lightningDistance <= 5 ? `PERICOLO ELEVATO: fulminazioni a brevissima distanza (${lightningDistance} km). Rischio colpi di vento e scariche dirette.` : lightningDistance <= 15 ? `ATTENZIONE: temporale in avvicinamento (${lightningDistance} km). Attivit\xE0 convettiva moderata.` : lightningCount > 0 ? `Attivit\xE0 elettrica debole/distante (${lightningDistance} km). Monitorare la traiettoria.` : "Nessuna attivit\xE0 elettrica rilevata nel raggio di sicurezza.",
      advisory: riskLevel === "CRITICO" ? "Ripararsi in un edificio o veicolo chiuso. Evitare alberi isolati e staccare dispositivi sensibili." : riskLevel === "MODERATO" ? "Attenzione a raffiche improvvise e piovaschi improvvisi. Verificare chiusura infissi." : "Condizioni atmosferiche ottimali per attivit\xE0 all'aperto.",
      confidence: 94
    };
  };
  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json(generateRuleBasedReport("Analisi Motore Barometrico Locale"));
    }
    const prompt = `Sei un esperto meteorologo e previsore della fisica atmosferica.
Analizza questi dati meteorologici in tempo reale per la localit\xE0 ${location?.name || "Localit\xE0"} (${location?.latitude || 41.9}, ${location?.longitude || 12.5}):
- Temperatura attuale: ${currentTemp}\xB0C
- Umidit\xE0 relativa attuale: ${humidity}%
- Rateo di variazione umidit\xE0: ${humidityChangeRate > 0 ? "+" : ""}${typeof humidityChangeRate === "number" ? humidityChangeRate.toFixed(1) : "0"}%/h (un aumento repentino indica fronte temporalesco o convezione)
- Vento: ${windSpeed} km/h con direzione ${windDirection}\xB0 (raffiche stimate a ${windGusts} km/h)
- Pressione atmosferica: ${pressure} hPa
- Attivit\xE0 elettrica temporalesca: ${lightningCount} fulmini rilevati, fulmine pi\xF9 vicino a ${lightningDistance} km
- Previsioni orarie 6h: ${JSON.stringify(hourlyForecast?.slice(0, 6) || [])}

Restituisci un JSON puro valido (senza markdown o con markdown pulito) con questa struttura esatta:
{
  "summary": "sintesi chiara dello stato atmosferico in 1-2 frasi in italiano",
  "prediction": "previsione fisica a brevissimo termine (1-6 ore) su arrivo piogge, temporali o schiarite",
  "riskLevel": "STABILE" | "MODERATO" | "CRITICO",
  "lightningRisk": "valutazione dettagliata del rischio fulmini e convezione",
  "advisory": "consigli pratici di sicurezza",
  "confidence": 95
}`;
    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });
    let rawText = response.text || "";
    rawText = rawText.trim();
    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    let parsed = {};
    try {
      parsed = JSON.parse(rawText || "{}");
    } catch (parseErr) {
      console.warn("Could not parse Gemini JSON response, using fallback:", parseErr);
      return res.json(generateRuleBasedReport("Motore Meteorologico"));
    }
    const fallback = generateRuleBasedReport();
    const finalReport = {
      summary: parsed.summary || parsed.sintesi || fallback.summary,
      prediction: parsed.prediction || parsed.previsione || fallback.prediction,
      riskLevel: ["CRITICO", "MODERATO", "STABILE"].includes(parsed.riskLevel?.toUpperCase?.()) ? parsed.riskLevel.toUpperCase() : fallback.riskLevel,
      lightningRisk: parsed.lightningRisk || parsed.rischioFulmini || fallback.lightningRisk,
      advisory: parsed.advisory || parsed.consigli || fallback.advisory,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : fallback.confidence
    };
    return res.json(finalReport);
  } catch (error) {
    console.error("Error during AI prediction, falling back to local model:", error?.message || error);
    return res.json(generateRuleBasedReport("Analisi di Backup"));
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(__dirname, "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Weather app server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
