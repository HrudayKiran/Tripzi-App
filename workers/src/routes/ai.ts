import { Hono } from 'hono';
import { Env } from '../lib/supabase';

const ai = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const SYSTEM_PROMPT = `You are Tripzi AI, an expert travel consultant for the Tripzi App.

CORE RULES:
1. You MUST gather ALL trip details before generating a Trip Card.
2. Ask questions naturally, 2-3 at a time max.
3. When user mentions a destination, suggest famous places to visit.
4. Each famous place MUST be a real, well-known landmark or attraction.
5. Continue the conversation until the user is satisfied.
6. Before generating the Trip Card JSON, show a SUMMARY and ask for confirmation.
7. ONLY generate the JSON after user confirms.

DATA TO GATHER:
- Origin city (fromLocation), Destination (toLocation)
- Travel dates, Duration in days (durationDays)
- Budget per person in ₹ (cost), Number of travelers (maxTravelers)
- Transport mode, Accommodation type, Trip type
- Interests & specific places, Mandatory items
- Gender preference, Booking status

TRIP CARD JSON (output ONLY when user confirms):
Return ONLY a JSON code block:

\`\`\`json
{
  "type": "trip_plan",
  "title": "Trip Title",
  "fromLocation": "Origin City",
  "toLocation": "Destination City",
  "cost": 15000,
  "description": "Detailed trip summary.",
  "itinerary": ["Day 1: ...", "Day 2: ..."],
  "tripType": "adventure",
  "transportMode": "train",
  "accommodationType": "hotel",
  "maxTravelers": 5,
  "durationDays": 3,
  "genderPreference": "anyone",
  "bookingStatus": "to_book",
  "placesToVisit": ["Place 1", "Place 2"],
  "mandatoryItems": ["ID Proof", "Jacket"],
  "imageKeywords": ["Place 1 Destination", "Place 2 Destination"]
}
\`\`\`

GENERAL BEHAVIOR:
- Be enthusiastic but professional
- Give accurate travel info
- If user asks non-travel questions, redirect to trip planning`;

type Role = 'system' | 'assistant' | 'user';
interface ChatMessage { role: Role; content: string; }
interface IncomingMessage { text?: unknown; user?: { _id?: unknown }; }

const toHistoryMessages = (incoming: IncomingMessage[]): ChatMessage[] => {
  return incoming
    .filter((item) => typeof item.text === 'string' && (item.text as string).trim().length > 0)
    .slice(0, 20)
    .reverse()
    .map((item) => ({
      role: (item.user?._id === 'tripzi-ai' ? 'assistant' : 'user') as Role,
      content: (item.text as string).trim(),
    }));
};

/**
 * POST /ai/plan
 * Body: { text: string, previousMessages?: IncomingMessage[], model?: string }
 */
ai.post('/plan', async (c) => {
  const body = await c.req.json<{
    text?: string;
    previousMessages?: IncomingMessage[];
    model?: string;
  }>();

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return c.json({ error: 'Message text is required.' }, 400);
  if (text.length > 2000) return c.json({ error: 'Message is too long.' }, 400);

  const ALLOWED_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
  let model = 'llama-3.3-70b-versatile';
  if (typeof body.model === 'string' && ALLOWED_MODELS.includes(body.model)) {
    model = body.model;
  }

  const previousMessages = Array.isArray(body.previousMessages) ? body.previousMessages : [];

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...toHistoryMessages(previousMessages),
    { role: 'user', content: text },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${c.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_completion_tokens: 1500,
    }),
  });

  const data = (await response.json()) as any;
  if (!response.ok) {
    return c.json({ error: data.error?.message || 'AI provider request failed.' }, 500);
  }

  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    return c.json({ error: 'AI provider returned an empty response.' }, 500);
  }

  return c.json({ text: answer, model });
});

/**
 * POST /ai/images
 * Body: { places: string[] }
 */
ai.post('/images', async (c) => {
  const body = await c.req.json<{ places?: string[] }>();
  const places = Array.isArray(body.places) ? body.places : [];

  if (places.length === 0) {
    return c.json({ error: 'Places array is required.' }, 400);
  }

  const limitedPlaces = places
    .slice(0, 7)
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);

  const results: Array<{
    place: string;
    imageUrl: string;
    photographerName: string;
    photographerUrl: string;
  }> = [];

  for (const place of limitedPlaces) {
    try {
      const query = encodeURIComponent(place.trim());
      const searchUrl = `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high`;

      const res = await fetch(searchUrl, {
        headers: { Authorization: `Client-ID ${c.env.UNSPLASH_ACCESS_KEY}` },
      });

      if (!res.ok) {
        results.push({ place: place.trim(), imageUrl: '', photographerName: '', photographerUrl: '' });
        continue;
      }

      const data = (await res.json()) as any;
      if (data.results?.length > 0) {
        const photo = data.results[0];

        // Trigger download endpoint per Unsplash API guidelines
        try {
          await fetch(photo.links.download_location, {
            headers: { Authorization: `Client-ID ${c.env.UNSPLASH_ACCESS_KEY}` },
          });
        } catch { /* best effort */ }

        results.push({
          place: place.trim(),
          imageUrl: photo.urls.regular,
          photographerName: photo.user.name,
          photographerUrl: photo.user.links.html,
        });
      } else {
        results.push({ place: place.trim(), imageUrl: '', photographerName: '', photographerUrl: '' });
      }
    } catch {
      results.push({ place: place.trim(), imageUrl: '', photographerName: '', photographerUrl: '' });
    }
  }

  return c.json({ images: results });
});

export default ai;
