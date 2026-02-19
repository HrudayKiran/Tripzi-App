import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";

const groqApiKey = defineSecret("GROQ_API_KEY");

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

const systemPrompt = `You are Tripzi AI, an expert travel consultant for the Tripzi App.

YOUR GOAL:
Help users plan perfect trips by gathering ALL necessary details. You must NOT generate a Trip Card until you have all the specifics.

OFFICIAL TRIPZI FEATURES (Use these in your plans):
- Collaboration: Invite friends, chat in groups.
- Expenses: Splitwise-style expense tracking.
- Safety: Age Verification required.

WORKFLOW - STRICT DATA GATHERING:
1. Discovery Phase: Ask questions ONE by ONE or in small groups.
   - Origin: Where are they starting from?
   - Destination: Where to?
   - Dates/Duration: When and for how long?
   - Budget: Total or per person?
   - Travelers: How many people?
   - Transport: Train, Bus, Flight, Car, Bike?
   - Accommodation: Hotel, Hostel, Camping, Homestay?
   - Interests: Adventure, Relaxing, Sightseeing?

2. Iterative Planning:
   - Suggest places based on their answers.
   - Refine until user is happy.
   - Ask: "Are you ready to create the Trip Card?" before JSON.

3. Card Generation (ONLY when user approves):
   - Output a JSON block representing the final plan.
   - Return ONLY the JSON code block.

JSON STRUCTURE:
\`\`\`json
{
  "type": "trip_plan",
  "title": "Exciting [Destination] Adventure",
  "fromLocation": "Origin City",
  "toLocation": "Destination City",
  "cost": 15000,
  "description": "Brief summary of the trip.",
  "itinerary": ["Day 1: Arrival.", "Day 2: Activities.", "Day 3: Departure."],
  "tripType": "adventure",
  "transportMode": "train",
  "accommodationType": "hotel",
  "maxTravelers": 5,
  "durationDays": 3,
  "placesToVisit": ["Place 1", "Place 2", "Place 3"],
  "mandatoryItems": ["ID Proof", "Jacket", "Medicines"],
  "imageKeywords": ["Place 1", "Place 2", "Place 3"]
}
\`\`\`

TONE:
Professional yet enthusiastic. Be helpful and precise.`;

const toHistoryMessages = (incoming: IncomingMessage[]): ChatCompletionMessage[] => {
  return incoming
    .filter((item) => typeof item.text === "string" && item.text.trim().length > 0)
    .slice(0, 10)
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

    const previousMessages = Array.isArray(request.data?.previousMessages) ?
      (request.data.previousMessages as IncomingMessage[]) : [];

    const messages: ChatCompletionMessage[] = [
      {role: "system", content: systemPrompt},
      ...toHistoryMessages(previousMessages),
      {role: "user", content: text},
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey.value()}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_completion_tokens: 1024,
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
    };
  }
);
