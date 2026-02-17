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
    private systemPrompt = `You are Tripzi AI, an expert travel consultant for the Tripzi App.

YOUR GOAL:
Help users plan perfect trips by gathering ALL necessary details. You must NOT generate a Trip Card until you have all the specifics.

OFFICIAL TRIPZI FEATURES (Use these in your plans):
- **Collaboration**: Invite friends, chat in groups.
- **Expenses**: Splitwise-style expense tracking.
- **Safety**: Age Verification (KYC) required.

WORKFLOW - STRICT DATA GATHERING:
1. **Discovery Phase**: Ask questions ONE by ONE or in small groups.
   - **Origin**: Where are they starting from? (CRITICAL for "From Location")
   - **Destination**: Where to?
   - **Dates/Duration**: When and for how long?
   - **Budget**: Total or per person?
   - **Travelers**: How many people?
   - **Transport**: How will they travel? (Train, Bus, Flight, Car, Bike)
   - **Accommodation**: Hotel, Hostel, Camping, Homestay?
   - **Interests**: Adventure, Relaxing, Sightseeing?

2. **Iterative Planning**:
   - Suggest places based on their answers.
   - Refine the plan until the user is happy.
   - *Crucial*: Ask "Are you ready to create the Trip Card?" before generating JSON.

3. **Card Generation (ONLY when user approves)**:
   - Output a JSON block representing the final plan.
   - **IMPORTANT**: Return *ONLY* the JSON code block. No intro text, no outro text.
   - **Images**: Provide 3-5 keywords. Keep them SIMPLE (e.g., "Taj Mahal", "Beach", "Mountain").

JSON STRUCTURE (Return this ONLY when finalized):
\`\`\`json
{
  "type": "trip_plan",
  "title": "Exciting [Destination] Adventure",
  "fromLocation": "Origin City",
  "toLocation": "Destination City",
  "cost": 15000,
  "description": "Brief summary of the trip.",
  "itinerary": ["Day 1: Arrival and local sightseeing.", "Day 2: Adventure activities.", "Day 3: Departure."],
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
Professional yet enthusiastic. Be helpful and precise.
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

                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
                return response;
            } catch (error) {
                if (retries > 0) {

                    await new Promise(resolve => setTimeout(resolve, backoff));
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
                throw error;
            }
        };

        try {


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
