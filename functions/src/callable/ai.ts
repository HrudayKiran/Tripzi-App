import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

const groqApiKey = defineSecret("GROQ_API_KEY");
const unsplashAccessKey = defineSecret("UNSPLASH_ACCESS_KEY");

type Role = "system" | "assistant" | "user";

interface ChatCompletionMessage {
  role: Role;
  content: string;
}

interface IncomingMessage {
  text?: unknown;
  user?: {
    _id?: unknown;
  };
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

interface UnsplashPhoto {
  urls: {
    regular: string;
    small: string;
  };
  user: {
    name: string;
    links: { html: string };
  };
  links: {
    download_location: string;
  };
}

interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
}

const ALLOWED_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
] as const;

type AllowedModel = typeof ALLOWED_MODELS[number];

const systemPrompt = `You are Tripzi AI, an expert travel consultant for the Tripzi App.

CORE RULES:
1. You MUST gather ALL trip details before generating a Trip Card.
2. Ask questions naturally, 2-3 at a time max.
3. When user mentions a destination, suggest famous places to visit (flexible count based on trip duration — e.g. 3 for 1-day trip, 5 for 3+ days).
4. Each famous place MUST be a real, well-known landmark or attraction. No generic names.
5. Continue the conversation until the user is satisfied.
6. Before generating the Trip Card JSON, show a SUMMARY of all gathered details and ask: "Shall I create the Trip Card with these details?"
7. ONLY generate the JSON after user confirms.

DATA TO GATHER (ask one section at a time):
- Origin city (fromLocation)
- Destination (toLocation)  
- Travel dates: When are you planning to start? What's the return date? (or duration in days)
- Duration in days (durationDays) — calculate from dates if given
- Budget per person in ₹ (cost)
- Number of travelers (maxTravelers)
- Transport mode: train / bus / car / flight / bike / mixed
- Accommodation: hotel / hostel / camping / homestay / none
- Trip type: adventure / trekking / bike_ride / road_trip / camping / sightseeing / beach / pilgrimage
- Interests & specific places they want to visit
- Mandatory items to bring
- Gender preference: anyone / male / female
- Booking status: booked / to_book / not_needed

DATE QUESTIONS:
- Always ask: "When are you planning to start your trip?" and "How many days will you stay?"
- If user says "this weekend", calculate the upcoming Saturday-Sunday
- If user gives specific dates, use them
- Include dates context in the trip description

FAMOUS PLACES:
- When user gives a destination, research and suggest the most popular tourist spots.
- Use EXACT landmark names (e.g., "Mysore Palace" not "palace").
- These will be used to fetch real photos, so accuracy matters.

ITINERARY:
- Generate a DETAILED day-wise itinerary as an array of strings
- Each item should start with "Day X:" followed by detailed activities
- Include timings, meal suggestions, and travel tips
- Example: ["Day 1: Arrive in Manali by morning. Check into hotel. Visit Hadimba Temple (2hrs). Lunch at local dhaba. Evening walk on Mall Road. Dinner at Johnson's Cafe.", "Day 2: Early morning trek to Jogini Falls (3hrs). Return for lunch. Visit Vashisht Hot Springs. Evening at Old Manali market."]

TRIP CARD JSON (output ONLY when user confirms):
Return ONLY a JSON code block, nothing else before or after it.

\`\`\`json
{
  "type": "trip_plan",
  "title": "Trip Title",
  "fromLocation": "Origin City",
  "toLocation": "Destination City",
  "cost": 15000,
  "description": "Detailed trip summary including highlights and what to expect.",
  "itinerary": ["Day 1: Detailed activities...", "Day 2: Detailed activities...", "Day 3: Detailed activities..."],
  "tripType": "adventure",
  "transportMode": "train",
  "accommodationType": "hotel",
  "maxTravelers": 5,
  "durationDays": 3,
  "genderPreference": "anyone",
  "bookingStatus": "to_book",
  "placesToVisit": ["Exact Place 1", "Exact Place 2", "Exact Place 3"],
  "mandatoryItems": ["ID Proof", "Jacket", "Medicines"],
  "imageKeywords": ["Exact Place 1 Destination", "Exact Place 2 Destination", "Exact Place 3 Destination"]
}
\`\`\`

IMPORTANT RULES FOR imageKeywords:
- MUST contain exact famous place/landmark names
- These are used to search real photos — be precise
- Include the destination name + specific landmark (e.g., "Mysore Palace Mysore" or "Abbey Falls Coorg")
- Number of imageKeywords should match placesToVisit

GENERAL BEHAVIOR:
- Be enthusiastic but professional
- Give accurate travel info (distances, costs, weather tips)
- If user asks non-travel questions, politely redirect to trip planning
- Suggest the best time to visit, local food, safety tips
- Mention Tripzi features: group chat, expense splitting, KYC verification`;

const toHistoryMessages = (incoming: IncomingMessage[]): ChatCompletionMessage[] => {
  return incoming
    .filter((item) => typeof item.text === "string" && (item.text as string).trim().length > 0)
    .slice(0, 20)
    .reverse()
    .map((item) => {
      const senderId = item.user?._id;
      const role: Role = senderId === "tripzi-ai" ? "assistant" : "user";
      return {
        role,
        content: (item.text as string).trim(),
      };
    });
};

export const planTripWithAI = onCall(
  {
    secrets: [groqApiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const text = typeof request.data?.text === "string" ? request.data.text.trim() : "";
    if (!text) {
      throw new HttpsError("invalid-argument", "Message text is required.");
    }
    if (text.length > 2000) {
      throw new HttpsError("invalid-argument", "Message is too long.");
    }

    // Model selection — default to versatile, allow instant
    let model: AllowedModel = "llama-3.3-70b-versatile";
    if (typeof request.data?.model === "string" &&
      ALLOWED_MODELS.includes(request.data.model as AllowedModel)) {
      model = request.data.model as AllowedModel;
    }

    const previousMessages = Array.isArray(request.data?.previousMessages) ?
      (request.data.previousMessages as IncomingMessage[]) : [];

    const messages: ChatCompletionMessage[] = [
      { role: "system", content: systemPrompt },
      ...toHistoryMessages(previousMessages),
      { role: "user", content: text },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey.value()}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_completion_tokens: 1500,
      }),
    });

    const responseData = (await response.json()) as GroqResponse;
    if (!response.ok) {
      const message = responseData.error?.message || "AI provider request failed.";
      throw new HttpsError("internal", message);
    }

    const answer = responseData.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new HttpsError("internal", "AI provider returned an empty response.");
    }

    return {
      text: answer,
      model,
    };
  }
);

// ─── Unsplash Image Search ──────────────────────────────────────────
// Fetches specific landmark photos for trip card places
export const getPlaceImages = onCall(
  {
    secrets: [unsplashAccessKey],
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const places = request.data?.places;
    if (!Array.isArray(places) || places.length === 0) {
      throw new HttpsError("invalid-argument", "Places array is required.");
    }

    // Limit to 7 places max to stay within rate limits
    const limitedPlaces = places.slice(0, 7).filter(
      (p: unknown) => typeof p === "string" && (p as string).trim().length > 0
    ) as string[];

    const results: Array<{
      place: string;
      imageUrl: string;
      photographerName: string;
      photographerUrl: string;
    }> = [];

    for (const place of limitedPlaces) {
      try {
        const query = encodeURIComponent(place.trim());
        const searchUrl =
          `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape&content_filter=high`;

        const res = await fetch(searchUrl, {
          headers: {
            "Authorization": `Client-ID ${unsplashAccessKey.value()}`,
          },
        });

        if (!res.ok) continue;

        const data = (await res.json()) as UnsplashSearchResponse;
        if (data.results && data.results.length > 0) {
          const photo = data.results[0];

          // Trigger download endpoint per Unsplash API guidelines
          try {
            await fetch(photo.links.download_location, {
              headers: {
                "Authorization": `Client-ID ${unsplashAccessKey.value()}`,
              },
            });
          } catch {
            // Non-critical — best effort compliance
          }

          results.push({
            place: place.trim(),
            imageUrl: photo.urls.regular,
            photographerName: photo.user.name,
            photographerUrl: photo.user.links.html,
          });
        } else {
          // No results — skip this place
          results.push({
            place: place.trim(),
            imageUrl: "",
            photographerName: "",
            photographerUrl: "",
          });
        }
      } catch {
        results.push({
          place: place.trim(),
          imageUrl: "",
          photographerName: "",
          photographerUrl: "",
        });
      }
    }

    return { images: results };
  }
);
