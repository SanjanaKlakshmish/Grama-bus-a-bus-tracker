// Supabase Edge Function: validate-bus-sighting
// Validates a live bus sighting in the background using Gemini without blocking the user.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { report_id, photo_url, photo_base64 } = await req.json();

    if (!report_id) {
      return new Response(JSON.stringify({ error: 'report_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If Gemini key is available, call Gemini to verify the bus sighting
    let verificationStatus: 'valid' | 'invalid' | 'review' = 'valid';
    let verificationReason = 'Bus sighting accepted';

    if (geminiApiKey && (photo_base64 || photo_url)) {
      try {
        let base64Data = photo_base64;

        // If photo_url is provided and base64 is missing, fetch the image
        if (!base64Data && photo_url && photo_url.startsWith('http')) {
          const imgRes = await fetch(photo_url);
          if (imgRes.ok) {
            const buf = await imgRes.arrayBuffer();
            base64Data = btoa(String.fromCharCode(...new Uint8Array(buf)));
          }
        }

        if (base64Data) {
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

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        inline_data: {
                          mime_type: 'image/jpeg',
                          data: base64Data,
                        },
                      },
                      { text: prompt },
                    ],
                  },
                ],
                generationConfig: {
                  responseMimeType: 'application/json',
                },
              }),
            }
          );

          if (geminiRes.ok) {
            const geminiJson = await geminiRes.json();
            const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text);
              if (['valid', 'invalid', 'review'].includes(parsed.status)) {
                verificationStatus = parsed.status;
                verificationReason = parsed.reason || verificationReason;
              }
            }
          }
        }
      } catch (err) {
        console.warn('Gemini call inside Edge Function failed, setting to review:', err);
        verificationStatus = 'review';
        verificationReason = 'Automated verification inconclusive, queued for review.';
      }
    }

    // Update the record in Supabase
    const { error: updateError } = await supabase
      .from('bus_reports')
      .update({
        verification_status: verificationStatus,
        verification_reason: verificationReason,
        is_bus_verified: verificationStatus !== 'invalid',
      })
      .eq('id', report_id);

    if (updateError) {
      console.warn('Supabase update warning:', updateError.message);
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_id,
        verification_status: verificationStatus,
        reason: verificationReason,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
