import { ImageVerificationResult } from '../types/bus';

/**
 * Validates a live bus sighting for rural Karnataka bus tracking.
 * In-browser canvas analyzer when offline or server is unreachable.
 *
 * Rules:
 * - Accept if there is reasonable visual evidence of a bus (front, rear, side, doors, windows, seats, interior, dashboard, standing passenger area, window view).
 * - Do NOT reject merely because partial, rotated, inside, or logo missing.
 * - Reject only when clearly a selfie, personal face without bus, car, bike, blank wall/floor, or unrelated object.
 */
async function analyzeImageLocally(imageBlob: Blob): Promise<ImageVerificationResult> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            isBus: true,
            is_valid_bus_sighting: true,
            confidence: 75,
            reason: 'Visual evidence captured (canvas analysis unavailable)',
            detectedSubject: 'Bus transit capture',
            rejectionReason: null,
          });
          return;
        }

        const width = 160;
        const height = 120;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let redPixels = 0;
        let bluePixels = 0;
        let interiorSeatPixels = 0;
        let skinTonePixels = 0;
        let structuralPixels = 0;
        const totalPixels = width * height;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Red bus body/seat features
          if (r > 105 && r > g * 1.25 && r > b * 1.25) {
            redPixels++;
          }
          // Blue bus body/seat features
          else if (b > 105 && b > r * 1.2 && b > g * 1.1) {
            bluePixels++;
          }
          // Bus interior upholstery (brown/maroon rexine seats & railings)
          else if (r > 75 && r < 170 && g > 35 && g < 100 && b > 20 && b < 80 && r > g * 1.3) {
            interiorSeatPixels++;
          }
          // Human skin tones (standing passengers or face)
          else if (r > 115 && g > 75 && b > 50 && r > g && g > b && r - g < 65) {
            skinTonePixels++;
          }
          // Metallic / structural frames (windows, bus ceiling, grab rails)
          else if (Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 90 && r < 210) {
            structuralPixels++;
          }
        }

        const redRatio = redPixels / totalPixels;
        const blueRatio = bluePixels / totalPixels;
        const interiorRatio = interiorSeatPixels / totalPixels;
        const skinRatio = skinTonePixels / totalPixels;
        const structuralRatio = structuralPixels / totalPixels;

        // Selfie or face detection without any bus elements
        if (skinRatio > 0.4 && redRatio < 0.02 && blueRatio < 0.02 && interiorRatio < 0.02) {
          resolve({
            isBus: false,
            is_valid_bus_sighting: false,
            confidence: 92,
            reason: 'No bus-related object or interior is visible; appears to be a personal selfie or face.',
            detectedSubject: 'Human portrait / selfie (not a bus)',
            detectedAngle: 'selfie',
            rejectionReason: 'No bus-related object or interior is visible; appears to be a personal selfie or face.',
          });
          return;
        }

        // Reasonable visual evidence of a public bus (exterior, doors, windows, seats, interior, dashboard, standing area, window view)
        if (
          redRatio >= 0.03 ||
          blueRatio >= 0.025 ||
          interiorRatio >= 0.035 ||
          (structuralRatio >= 0.15 && (redRatio >= 0.015 || blueRatio >= 0.015 || interiorRatio >= 0.02)) ||
          (skinRatio >= 0.07 && (interiorRatio >= 0.02 || redRatio >= 0.015 || blueRatio >= 0.015))
        ) {
          const isInterior = interiorRatio >= 0.04 || skinRatio >= 0.08;
          resolve({
            isBus: true,
            is_valid_bus_sighting: true,
            confidence: 90,
            reason: isInterior
              ? 'Reasonable visual evidence of bus interior / passenger seating area'
              : 'Reasonable visual evidence of a Karnataka public bus',
            detectedSubject: isInterior
              ? 'Public bus interior (seats & passenger area)'
              : 'Karnataka public bus sighting',
            detectedAngle: isInterior ? 'interior_standing' : 'exterior',
            estimatedOccupancy: skinRatio >= 0.14 ? 'full_rush' : isInterior ? 'standing_only' : 'seats_available',
            rejectionReason: null,
          });
          return;
        }

        // No bus-related features
        resolve({
          isBus: false,
          is_valid_bus_sighting: false,
          confidence: 80,
          reason: 'No bus-related object or interior visible in the frame.',
          detectedSubject: 'Non-bus object or unverified view',
          detectedAngle: 'unknown',
          rejectionReason: 'No bus-related object, windows, or interior visible. Please point your camera at the bus.',
        });
      } catch (err) {
        resolve({
          isBus: false,
          is_valid_bus_sighting: false,
          confidence: 70,
          reason: 'Failed to inspect photo frame for bus features.',
          detectedSubject: 'Processing error',
          detectedAngle: 'unknown',
          rejectionReason: 'Failed to verify bus sighting. Please retake the photo directly pointing at or inside the bus.',
        });
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        isBus: false,
        is_valid_bus_sighting: false,
        confidence: 85,
        reason: 'Unable to decode photo frame. Please retake.',
        detectedSubject: 'Corrupted image',
        detectedAngle: 'none',
        rejectionReason: 'Unable to decode photo. Please retake.',
      });
    };

    img.src = url;
  });
}

/**
 * Sends a captured camera photo to the server-side visual verification API,
 * validating against reasonable visual evidence of a real public bus:
 * - Front, rear, side, door/windows, seats, interior, dashboard, standing area, window view.
 * - Does NOT require full bus, logo, or clear color.
 * - Returns { is_valid_bus_sighting, confidence, reason }.
 */
export async function verifyBusPhoto(imageBlob: Blob): Promise<ImageVerificationResult> {
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read image data for verification.'));
    reader.readAsDataURL(imageBlob);
  });

  try {
    const response = await fetch('/api/verify-bus-photo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType: imageBlob.type || 'image/jpeg',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const isValid = typeof data.is_valid_bus_sighting === 'boolean' ? data.is_valid_bus_sighting : Boolean(data.isBus);
      const conf = typeof data.confidence === 'number' ? data.confidence : 85;
      const reasonText = data.reason || data.detectedSubject || (isValid ? 'Valid bus sighting' : 'Unverified photo');

      return {
        isBus: isValid,
        is_valid_bus_sighting: isValid,
        confidence: conf,
        reason: reasonText,
        detectedSubject: reasonText,
        detectedAngle: data.detectedAngle || 'general',
        estimatedOccupancy: data.estimatedOccupancy || 'seats_available',
        rejectionReason: isValid ? null : reasonText,
      };
    }
  } catch (err) {
    console.warn('Server bus verification endpoint unavailable, running local visual inspection:', err);
  }

  // Fallback to in-browser visual inspection
  return analyzeImageLocally(imageBlob);
}
