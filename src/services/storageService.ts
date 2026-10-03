/**
 * Storage Service for bus sighting photographs.
 * 
 * Supports both:
 * 1. Supabase Storage (when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are provided)
 * 2. Local Blob / IndexedDB fallback for immediate standalone development & offline resilience
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const BUCKET_NAME = 'bus-sightings';

// Local cache for photos in memory/localStorage for instant viewing
const localPhotoCache = new Map<string, string>();

export async function uploadBusPhoto(imageBlob: Blob, reportId: string): Promise<string> {
  // Validate MIME type
  if (!imageBlob.type.startsWith('image/')) {
    throw new Error('Invalid file format. Only photo captures are allowed.');
  }

  // Validate size (max 8MB)
  if (imageBlob.size > 8 * 1024 * 1024) {
    throw new Error('Image size is too large. Must be under 8MB.');
  }

  const filename = `sighting_${reportId}_${Date.now()}.jpg`;

  // If Supabase is configured with valid credentials
  if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('http')) {
    try {
      const uploadEndpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filename}`;
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': imageBlob.type || 'image/jpeg',
          'x-upsert': 'true',
        },
        body: imageBlob,
      });

      if (response.ok) {
        // Return public URL
        return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filename}`;
      }
      console.warn('Supabase upload failed, falling back to local photo storage:', response.statusText);
    } catch (err) {
      console.warn('Network error during Supabase upload, using local storage fallback:', err);
    }
  }

  // Standalone / Local development mode: convert Blob to base64 Data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      localPhotoCache.set(filename, base64data);
      // Persist in localStorage key if reasonable size
      try {
        localStorage.setItem(`photo_${reportId}`, base64data);
      } catch (e) {
        console.warn('localStorage storage limit reached for cached photo preview', e);
      }
      resolve(base64data);
    };
    reader.onerror = () => reject(new Error('Failed to process captured photo.'));
    reader.readAsDataURL(imageBlob);
  });
}

export function getCachedPhoto(reportId: string): string | null {
  try {
    return localStorage.getItem(`photo_${reportId}`) || null;
  } catch {
    return null;
  }
}
