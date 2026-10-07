import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { getNews, isNewsCategory } from './lib/news';
import { getDisasters, getEarthquakes, getFlights, getSatellites, isSatelliteGroup } from './lib/worldEvents';
import { getFlightInfo, getFlightLive, searchFlights } from './lib/flightTracker';
import { getGeoNews } from './lib/geonews';
import { getMarkets } from './lib/markets';

dotenv.config();

const app = express();
// Override with PORT=3100 npm run dev to run a second instance side by side.
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Initialize Gemini Client (server-side only)
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Real-time news hub feed (RSS aggregated server-side, cached 3 min)
app.get('/api/news', async (req, res) => {
  const category = isNewsCategory(req.query.category) ? req.query.category : 'all';
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(await getNews(category));
  } catch (error: any) {
    console.error('News feed error:', error?.message || error);
    res.status(502).json({ error: 'News feed unavailable' });
  }
});

// WorldHub globe layers (upstream feeds cached in lib/worldEvents.ts; the
// loaders never throw — failures come back as { stale: true, error }).
app.get('/api/earthquakes', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json(await getEarthquakes());
});
app.get('/api/flights', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(await getFlights());
});
// Single-flight features: search by number, live state ("Segui volo"),
// route / aircraft enrichment. See lib/flightTracker.ts.
app.get('/api/flights/search', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json(await searchFlights(typeof req.query.q === 'string' ? req.query.q : ''));
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'Ricerca non disponibile' });
  }
});
app.get('/api/flights/live', async (req, res) => {
  const icao24 = typeof req.query.icao24 === 'string' ? req.query.icao24 : '';
  if (!/^[0-9a-fA-F]{6}$/.test(icao24)) return res.status(400).json({ error: 'icao24 non valido' });
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getFlightLive(icao24));
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'Dati del volo non disponibili' });
  }
});
app.get('/api/flights/info', async (req, res) => {
  const callsign = typeof req.query.callsign === 'string' && req.query.callsign.trim() ? req.query.callsign.trim() : null;
  const icao24 = typeof req.query.icao24 === 'string' && /^[0-9a-fA-F]{6}$/.test(req.query.icao24) ? req.query.icao24 : null;
  try {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(await getFlightInfo(callsign, icao24));
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'Informazioni non disponibili' });
  }
});
app.get('/api/disasters', async (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=120');
  res.json(await getDisasters());
});
app.get('/api/satellites', async (req, res) => {
  const group = isSatelliteGroup(req.query.group) ? req.query.group : 'stations';
  res.setHeader('Cache-Control', 'public, max-age=1800');
  res.json(await getSatellites(group));
});

// WorldHub: geo-located world headlines (globe layer) (cached 5 min)
app.get('/api/geonews', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(await getGeoNews());
  } catch (error: any) {
    console.error('Geo news feed error:', error?.message || error);
    res.status(502).json({ error: 'Geo news feed unavailable' });
  }
});

// WorldHub: world indices, FX and commodities (cached 45 s)
app.get('/api/markets', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(await getMarkets());
  } catch (error: any) {
    console.error('Market feed error:', error?.message || error);
    res.status(502).json({ error: 'Market feed unavailable' });
  }
});

// AI Meteorological Predictive Analysis endpoint
app.post('/api/weather/predict-changes', async (req, res) => {
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

  // Meteorological rule-based fallback generator
  const generateRuleBasedReport = (note?: string) => {
    const isRapidHumidityIncrease = humidityChangeRate > 4;
    const isCloseLightning = lightningDistance <= 15;
    const isVeryHighHumidity = humidity > 85;
    const isLowPressure = pressure < 1008;

    const riskLevel: 'CRITICO' | 'MODERATO' | 'STABILE' =
      isCloseLightning || (isRapidHumidityIncrease && humidityChangeRate > 8)
        ? 'CRITICO'
        : isRapidHumidityIncrease || isVeryHighHumidity || lightningCount > 0
        ? 'MODERATO'
        : 'STABILE';

    let predictionText = 'Masse d\'aria stabili nelle prossime ore con variazioni termodinamiche regolari.';
    if (isRapidHumidityIncrease && isCloseLightning) {
      predictionText = `Allerta instabilità marcata: l'incremento di umidità (+${humidityChangeRate.toFixed(1)}%/h) combinato a scariche a ${lightningDistance} km indica l'impatto di un fronte temporalesco attivo entro 30-60 minuti.`;
    } else if (isRapidHumidityIncrease) {
      predictionText = `Rilevato repentino gradiente di umidità (+${humidityChangeRate.toFixed(1)}%/h): probabile formazione di nubi a sviluppo verticale e rovesci a breve termine.`;
    } else if (isLowPressure) {
      predictionText = `Minimo barometrico (${pressure} hPa) che favorisce addensamenti e instabilità locale diffusa.`;
    }

    return {
      summary: `Quadro per ${location?.name || 'Località'}: ${currentTemp}°C, Umidità ${humidity}%, Vento ${windSpeed} km/h da ${windDirection}°, Pressione ${pressure} hPa.${note ? ` (${note})` : ''}`,
      prediction: predictionText,
      riskLevel,
      lightningRisk: lightningDistance <= 5
        ? `PERICOLO ELEVATO: fulminazioni a brevissima distanza (${lightningDistance} km). Rischio colpi di vento e scariche dirette.`
        : lightningDistance <= 15
        ? `ATTENZIONE: temporale in avvicinamento (${lightningDistance} km). Attività convettiva moderata.`
        : lightningCount > 0
        ? `Attività elettrica debole/distante (${lightningDistance} km). Monitorare la traiettoria.`
        : 'Nessuna attività elettrica rilevata nel raggio di sicurezza.',
      advisory: riskLevel === 'CRITICO'
        ? 'Ripararsi in un edificio o veicolo chiuso. Evitare alberi isolati e staccare dispositivi sensibili.'
        : riskLevel === 'MODERATO'
        ? 'Attenzione a raffiche improvvise e piovaschi improvvisi. Verificare chiusura infissi.'
        : 'Condizioni atmosferiche ottimali per attività all\'aperto.',
      confidence: 94
    };
  };

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json(generateRuleBasedReport('Analisi Motore Barometrico Locale'));
    }

    const prompt = `Sei un esperto meteorologo e previsore della fisica atmosferica.
Analizza questi dati meteorologici in tempo reale per la località ${location?.name || 'Località'} (${location?.latitude || 41.9}, ${location?.longitude || 12.5}):
- Temperatura attuale: ${currentTemp}°C
- Umidità relativa attuale: ${humidity}%
- Rateo di variazione umidità: ${humidityChangeRate > 0 ? '+' : ''}${typeof humidityChangeRate === 'number' ? humidityChangeRate.toFixed(1) : '0'}%/h (un aumento repentino indica fronte temporalesco o convezione)
- Vento: ${windSpeed} km/h con direzione ${windDirection}° (raffiche stimate a ${windGusts} km/h)
- Pressione atmosferica: ${pressure} hPa
- Attività elettrica temporalesca: ${lightningCount} fulmini rilevati, fulmine più vicino a ${lightningDistance} km
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
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      }
    });

    let rawText = response.text || '';
    rawText = rawText.trim();
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(rawText || '{}');
    } catch (parseErr) {
      console.warn('Could not parse Gemini JSON response, using fallback:', parseErr);
      return res.json(generateRuleBasedReport('Motore Meteorologico'));
    }

    // Sanitize and ensure full structure
    const fallback = generateRuleBasedReport();
    const finalReport = {
      summary: parsed.summary || parsed.sintesi || fallback.summary,
      prediction: parsed.prediction || parsed.previsione || fallback.prediction,
      riskLevel: ['CRITICO', 'MODERATO', 'STABILE'].includes(parsed.riskLevel?.toUpperCase?.())
        ? parsed.riskLevel.toUpperCase()
        : fallback.riskLevel,
      lightningRisk: parsed.lightningRisk || parsed.rischioFulmini || fallback.lightningRisk,
      advisory: parsed.advisory || parsed.consigli || fallback.advisory,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : fallback.confidence,
    };

    return res.json(finalReport);
  } catch (error: any) {
    console.error('Error during AI prediction, falling back to local model:', error?.message || error);
    return res.json(generateRuleBasedReport('Analisi di Backup'));
  }
});

// Vite dev middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // The bundled server is CommonJS (no import.meta), and both `npm start`
    // and hosting platforms launch it from the project root.
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Weather app server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
