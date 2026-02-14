import { Alert } from 'react-native';

import { GROQ_API_KEY } from '../config/secrets';


export interface AIMessage {
    _id: string | number;
    text: string;
    createdAt: Date | number;
    user: {
        _id: string | number;
        name: string;
        avatar?: string;
    };
    // Custom properties for Tripzi
    tripData?: any; // For structured trip previews
    quickReplies?: {
        type: 'radio' | 'checkbox';
        values: { title: string; value: string }[];
        keepIt?: boolean;
    };
}

class AIService {
    private apiKey: string;
    private apiUrl: string;
    private model: string;

    // STRICT JSON PROMPT
    private systemPrompt = `You are Tripzi AI, the official intelligent assistant for the Tripzi Travel App.

YOUR KNOWLEDGE BASE (TRIPZI APP FEATURES):
- **Collaboration**: Users can create trips, invite friends via link, and chat in real-time.
- **Expenses**: Tripzi has a built-in "Splitwise" feature. Users can add expenses, split them, and track balances.
- **Safety**: Age Verification (KYC) keeps the platform safe.

WORKFLOW - TRIP PLANNING:
1. **Collect Details (MANDATORY)**: You MUST collect these before generating a JSON card. Ask ONE question at a time if missing:
   - **Destination**: Where?
   - **Duration**: How many days? (Important)
   - **Budget/Cost**: Approx budget? (Important)
   - **Vibe**: Adventure, Relaxing, etc.?
2. **Clarify**: If ANY detail is missing, ask for it. Do NOT hallucinate defaults yet.
3. **Generate**: ONLY when you have these details, generate the JSON trip plan.
4. **Auto-Post Ready**: The JSON you return determines the trip. Ensure it's high quality.

JSON STRUCTURE (Return this for trip cards):
{
  "type": "trip_plan",
  "title": "Trip Title",
  "fromLocation": "Origin City (Infer or 'India')",
  "toLocation": "Destination City",
  "cost": 15000, 
  "description": "Engaging description...",
  "tripType": "adventure",
  "placesToVisit": ["Place 1", "Place 2"],
  "imageKeywords": ["mountain,snow", "river,rafting", "temple,ancient"], // MANDATORY: 3 comma-separated keyword sets for stock photos
  "itinerary": "Day 1: ... Day 2: ..."
}

TONE:
Expert, Friendly, and App-Aware. Use emojis.
`;

    constructor() {
        this.apiKey = GROQ_API_KEY;
        this.apiUrl = "https://api.groq.com/openai/v1/chat/completions";
        this.model = "llama-3.3-70b-versatile";
    }

    async sendMessage(text: string, previousMessages: AIMessage[] = []): Promise<AIMessage[]> {
        const responseMessages: AIMessage[] = [];
        const aiUser = {
            _id: 'tripzi-ai',
            name: 'Tripzi AI',
            avatar: 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png',
        };

        // Retry logic helper
        const fetchWithRetry = async (url: string, options: any, retries = 3, backoff = 1000) => {
            try {
                const response = await fetch(url, options);
                // Retry on 503 (Service Unavailable) or 429 (Too Many Requests)
                if ((response.status === 503 || response.status === 429) && retries > 0) {
                    console.log(`Service busy (${response.status}). Retrying in ${backoff}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
                return response;
            } catch (error) {
                if (retries > 0) {
                    console.log(`Network error. Retrying in ${backoff}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
                throw error;
            }
        };

        try {
            console.log("Sending to Groq:", text);

            // Construct Conversation for OpenAI format
            // System message first
            const messages = [
                { role: "system", content: this.systemPrompt }
            ];

            // Add previous history (last 10)
            const history = previousMessages.slice(0, 10).reverse(); // chronological
            history.forEach(msg => {
                const role = msg.user._id === 'tripzi-ai' ? "assistant" : "user";
                messages.push({ role, content: msg.text });
            });

            // Add current user message
            messages.push({ role: "user", content: text });

            const payload = {
                model: this.model,
                messages: messages,
                temperature: 0.7,
                max_completion_tokens: 1024
            };

            const response = await fetchWithRetry(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Groq API Error:", JSON.stringify(data));
                // Fallback to generic error if needed, or just let the error throw to catch block
                // But better to show the error message from Groq if possible
                if (data.error && data.error.message) {
                    throw new Error(`Groq API: ${data.error.message}`);
                }
            }

            if (data.choices && data.choices[0]?.message?.content) {
                const aiText = data.choices[0].message.content;
                responseMessages.push({
                    _id: Math.random(),
                    text: aiText,
                    createdAt: new Date(),
                    user: aiUser
                });
            } else {
                console.error("Groq Error / No Text:", JSON.stringify(data));

                // FALLBACK FOR COORG DEMO IF API FAILS
                if (text.toLowerCase().includes('coorg')) {
                    const coorgTrip = {
                        type: "trip_plan",
                        title: "Escapade to Coorg",
                        fromLocation: "Bangalore, India",
                        toLocation: "Coorg, Karnataka",
                        cost: 8500,
                        description: "Experience the Scotland of India with misty hills, coffee plantations, and waterfalls.",
                        tripType: "adventure",
                        placesToVisit: ["Abbey Falls", "Raja's Seat", "Dubare Elephant Camp"],
                        imageKeywords: ["waterfall,nature", "elephant,river", "hills,sunset"],
                        itinerary: "Day 1: Arrival & Abbey Falls\nDay 2: Dubare Camp & Rafting\nDay 3: Raja's Seat & Departure"
                    };

                    responseMessages.push({
                        _id: Math.random(),
                        text: "I'm having trouble connecting to the brain, but here is a plan I remember for Coorg! \`\`\`json\n" + JSON.stringify(coorgTrip) + "\n\`\`\`",
                        createdAt: new Date(),
                        user: aiUser
                    });
                } else {
                    let errorMessage = "I'm having a bit of trouble thinking right now. Please try again.";
                    if (data.error) {
                        errorMessage += ` (Error: ${data.error.message})`;
                    }
                    responseMessages.push({
                        _id: Math.random(),
                        text: errorMessage,
                        createdAt: new Date(),
                        user: aiUser
                    });
                }
            }

            return responseMessages;

        } catch (error: any) {
            console.error("AI Network Error:", error);
            responseMessages.push({
                _id: Math.random(),
                text: "Sorry, I'm having trouble connecting to the AI. Please check your internet connection.",
                createdAt: new Date(),
                user: aiUser
            });
            return responseMessages;
        }
    }
}

export const aiService = new AIService();
