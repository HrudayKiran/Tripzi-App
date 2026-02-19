import functions from '@react-native-firebase/functions';


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
    constructor() {}

    async sendMessage(text: string, previousMessages: AIMessage[] = []): Promise<AIMessage[]> {
        const responseMessages: AIMessage[] = [];
        const aiUser = {
            _id: 'tripzi-ai',
            name: 'Tripzi AI',
            avatar: 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png',
        };

        try {
            const callable = functions().httpsCallable('planTripWithAI');
            const result = await callable({ text, previousMessages });
            const aiText = result?.data?.text;

            if (typeof aiText === 'string' && aiText.trim().length > 0) {
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
                    const errorMessage = "I'm having a bit of trouble thinking right now. Please try again.";
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
