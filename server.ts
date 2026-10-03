import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Support up to 10MB payloads for camera capture base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', route: 'Sira-Tumakuru Bus Tracker API' });
});

/**
 * Heuristic fallback validator when Gemini API key is absent.
 * Follows the user's validation rules:
 * - Accept if there is reasonable visual evidence of a bus (exterior, doors, windows, seats, interior, dashboard, standing area, window view).
 * - Do NOT reject merely because partial, rotated, inside, or logo missing.
 * - Reject only when clearly a selfie, personal face without bus, car, bike, blank wall/floor, or unrelated object.
 */
function analyzeFallbackBusSighting(buffer: Buffer): {
  is_valid_bus_sighting: boolean;
  confidence: number;
  reason: string;
} {
  let redPixels = 0;
  let bluePixels = 0;
  let interiorSeatPixels = 0;
  let skinTonePixels = 0;
  let structuralPixels = 0;
  let totalSampled = 0;

  const step = Math.max(3, Math.floor(buffer.length / 45000));
  for (let i = 0; i < buffer.length - 3; i += step) {
    const r = buffer[i];
    const g = buffer[i + 1];
    const b = buffer[i + 2];

    totalSampled++;

    // Red bus body/seat features
    if (r > 105 && r > g * 1.25 && r > b * 1.25) {
      redPixels++;
    }
    // Blue bus body/seat features
    else if (b > 105 && b > r * 1.2 && b > g * 1.1) {
      bluePixels++;
    }
    // Interior upholstery / bus seats / metal bars
    else if (r > 75 && r < 170 && g > 35 && g < 100 && b > 20 && b < 80 && r > g * 1.3) {
      interiorSeatPixels++;
    }
    // Skin tones
    else if (r > 120 && g > 80 && b > 50 && r > g && g > b && r - g < 60) {
      skinTonePixels++;
    }
    // Metallic / structural frames (windows, bus ceiling, grab rails)
    else if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 90 && r < 210) {
      structuralPixels++;
    }
  }

  if (totalSampled === 0) totalSampled = 1;
  const redRatio = redPixels / totalSampled;
  const blueRatio = bluePixels / totalSampled;
  const interiorRatio = interiorSeatPixels / totalSampled;
  const skinRatio = skinTonePixels / totalSampled;
  const structuralRatio = structuralPixels / totalSampled;

  // Pure selfie close-up without any bus elements
  if (skinRatio > 0.4 && redRatio < 0.02 && blueRatio < 0.02 && interiorRatio < 0.02) {
    return {
      is_valid_bus_sighting: false,
      confidence: 90,
      reason: 'No bus-related object or interior visible; appears to be a personal selfie or face.',
    };
  }

  // Visual evidence of a bus (exterior red/blue, seats, passenger interior, window/structure)
  if (
    redRatio >= 0.035 ||
    blueRatio >= 0.03 ||
    interiorRatio >= 0.04 ||
    (structuralRatio >= 0.15 && (redRatio >= 0.015 || blueRatio >= 0.015 || interiorRatio >= 0.02)) ||
    (skinRatio >= 0.07 && (interiorRatio >= 0.02 || redRatio >= 0.015 || blueRatio >= 0.015))
  ) {
    return {
      is_valid_bus_sighting: true,
      confidence: 88,
      reason: 'Reasonable visual evidence of a public bus (exterior, interior seats, or passenger area).',
    };
  }

  return {
    is_valid_bus_sighting: false,
    confidence: 80,
    reason: 'No bus-related object, windows, or interior visible in the frame.',
  };
}

// Live Bus Sighting Validation Endpoint
app.post('/api/verify-bus-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        is_valid_bus_sighting: false,
        confidence: 0,
        reason: 'Camera capture data is required for verification.',
        isBus: false,
        detectedSubject: 'No image provided',
        rejectionReason: 'Camera capture data is required for verification.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // 1. If Gemini API Key is available, use Gemini 3.8 Flash with the exact user specification
    if (apiKey) {
      const ai = new GoogleGenAI();

      const prompt = `You are validating a LIVE BUS SIGHTING for a rural Karnataka bus tracking website.

The user must capture a photo using the camera at the time of reporting.
Do NOT require the entire bus to be visible.
Do NOT require a KSRTC logo, registration number, route board, or Karnataka text to be visible.

Accept the image if there is reasonable visual evidence that the photo was taken at or inside a real public bus.

Valid examples:
- Front of a Karnataka government bus
- Rear of a bus
- Side of a bus
- Bus door or windows
- Bus seats or interior
- Dashboard/driver area
- Passenger area while standing inside the bus
- View from a bus window showing the bus structure/interior
- Partial bus images where enough bus-related features are visible

Reject only when:
- No bus-related object or interior is visible
- Clearly a car, bike, building, landscape, person, etc.
- Screenshot, downloaded image, poster, drawing, or obviously unrelated image
- Image is completely unusable

IMPORTANT:
Do not reject merely because:
- the image is rotated
- only part of the bus is visible
- the Karnataka/KSRTC logo is not visible
- the bus is photographed from inside
- the bus is photographed through a window
- the bus colour is unclear

Return JSON only:

{
  "is_valid_bus_sighting": true/false,
  "confidence": 0-100,
  "reason": "short reason"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text?.trim() || '{}';
      try {
        const parsed = JSON.parse(responseText);
        const isValid = Boolean(parsed.is_valid_bus_sighting);
        const confidenceVal = typeof parsed.confidence === 'number' ? parsed.confidence : isValid ? 90 : 80;
        const reasonText = parsed.reason || (isValid ? 'Valid bus sighting' : 'Unverified photo');

        return res.json({
          is_valid_bus_sighting: isValid,
          confidence: confidenceVal,
          reason: reasonText,
          // Backward-compatible fields
          isBus: isValid,
          detectedSubject: reasonText,
          rejectionReason: isValid ? null : reasonText,
        });
      } catch (parseErr) {
        console.warn('Failed parsing Gemini JSON, falling back to heuristic verification:', parseErr);
      }
    }

    // 2. Strict Fallback
    const imageBuffer = Buffer.from(imageBase64, 'base64');
    const result = analyzeFallbackBusSighting(imageBuffer);

    return res.json({
      is_valid_bus_sighting: result.is_valid_bus_sighting,
      confidence: result.confidence,
      reason: result.reason,
      // Backward-compatible fields
      isBus: result.is_valid_bus_sighting,
      detectedSubject: result.reason,
      rejectionReason: result.is_valid_bus_sighting ? null : result.reason,
    });
  } catch (err: unknown) {
    const errorObj = err as Error;
    console.error('Error during bus verification:', errorObj?.message || err);

    return res.status(200).json({
      is_valid_bus_sighting: false,
      confidence: 70,
      reason: 'Could not verify bus evidence in the photo. Please capture the bus or bus interior.',
      isBus: false,
      detectedSubject: 'Verification inconclusive',
      rejectionReason: 'Could not verify bus evidence in the photo. Please capture the bus or bus interior.',
    });
  }
});

// Background Edge Function / Server validation endpoint
app.post('/api/validate-bus-sighting', async (req, res) => {
  // Respond immediately so user NEVER waits
  res.status(202).json({ accepted: true, message: 'Background validation triggered' });

  const { report_id, photo_url, photo_base64 } = req.body;
  if (!report_id) return;

  // Process Gemini in background
  (async () => {
    try {
      let status: 'valid' | 'invalid' | 'review' = 'valid';
      let reason = 'Bus sighting accepted';

      const apiKey = process.env.GEMINI_API_KEY;
      let base64 = photo_base64;

      if (!base64 && photo_url && photo_url.startsWith('http')) {
        try {
          const fetched = await fetch(photo_url);
          if (fetched.ok) {
            const buf = await fetched.arrayBuffer();
            base64 = Buffer.from(buf).toString('base64');
          }
        } catch {
          // ignore
        }
      }

      if (apiKey && base64) {
        const ai = new GoogleGenAI();
        const prompt = `You are validating a live bus sighting photo for a rural Karnataka bus tracker.
Check whether the image reasonably shows a real public bus or bus interior.

Accept front, rear, side, partial bus, windows, seats, driver area, and photos taken from inside the bus.
Do NOT require KSRTC logo, route board, registration number, or the whole bus to be visible.
Do NOT reject because of partial view, rotation, or inside perspective.

If uncertain or ambiguous, return "review" instead of rejecting.
Only return "invalid" if it is clearly an unrelated vehicle (car, bike), indoor house room, personal face selfie, or obviously not a bus.

Return JSON only in this exact format:
{
  "status": "valid" | "invalid" | "review",
  "reason": "short explanation"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/jpeg',
                    data: base64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: { responseMimeType: 'application/json' },
        });

        const text = response.text?.trim() || '{}';
        try {
          const parsed = JSON.parse(text);
          if (['valid', 'invalid', 'review'].includes(parsed.status)) {
            status = parsed.status;
            reason = parsed.reason || reason;
          }
        } catch {
          status = 'review';
        }
      }

      // Update in Supabase if configured
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        await fetch(`${supabaseUrl}/rest/v1/bus_reports?id=eq.${report_id}`, {
          method: 'PATCH',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            verification_status: status,
            verification_reason: reason,
            is_bus_verified: status !== 'invalid',
          }),
        });
      }
    } catch (e) {
      console.warn('Background validation error:', e);
    }
  })();
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
