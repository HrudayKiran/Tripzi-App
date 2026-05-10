/**
 * Tripzi Knowledge Base — Seed Data
 *
 * This file contains the initial knowledge base content that gets
 * embedded and stored in Zilliz Cloud for RAG retrieval.
 *
 * Categories: feature, faq, guide, prd
 */

export interface KnowledgeChunk {
  id: string;
  content: string;
  category: 'feature' | 'faq' | 'guide' | 'prd';
  title: string;
  source: string;
}

export const KNOWLEDGE_BASE: KnowledgeChunk[] = [
  // ═══════════════════════════════════════════════
  // FEATURES
  // ═══════════════════════════════════════════════
  {
    id: 'feat-ai-planner',
    content: 'Tripzi AI Planner is an intelligent travel planning assistant that helps users plan trips step by step. Users can describe their dream trip, and the AI will ask follow-up questions about origin, destination, budget, travel dates, transport mode, accommodation, trip type, and traveler count. Once all details are gathered, it generates a complete Trip Card with itinerary, cost estimates, and recommended places to visit.',
    category: 'feature',
    title: 'AI Trip Planner',
    source: 'tripzi-features',
  },
  {
    id: 'feat-trip-cards',
    content: 'Trip Cards are the core content unit in Tripzi. A Trip Card contains: title, origin & destination, cost per person in INR, detailed description, day-by-day itinerary, trip type (adventure, relaxation, spiritual, etc.), transport mode (train, flight, car, bus, bike), accommodation type (hotel, hostel, homestay, camping), max travelers, duration in days, gender preference, booking status, places to visit, and mandatory items to carry.',
    category: 'feature',
    title: 'Trip Cards',
    source: 'tripzi-features',
  },
  {
    id: 'feat-create-trip',
    content: 'Users can create trips in two ways: 1) Using the AI Planner which guides them through the process and generates a Trip Card automatically. 2) Manually creating a trip by filling in the trip details form. Created trips appear on the user profile and can be shared with the community. Other users can view, like, and join trip plans.',
    category: 'feature',
    title: 'Create a Trip',
    source: 'tripzi-features',
  },
  {
    id: 'feat-explore',
    content: 'The Explore screen shows a feed of Trip Cards from the Tripzi community. Users can browse trips by destination, trip type, budget range, and duration. Each card shows a preview image, destination, cost, duration, and trip type tag. Users can like trips, save them to favorites, and share them with friends.',
    category: 'feature',
    title: 'Explore Trips',
    source: 'tripzi-features',
  },
  {
    id: 'feat-group-chat',
    content: 'Tripzi has built-in group chat functionality for trip planning. When users join a trip, they can chat with other travelers in a dedicated group chat. Group chats support text messages, image sharing, location sharing, live location sharing, and media previews. Each group chat shows member count and online status.',
    category: 'feature',
    title: 'Group Chat',
    source: 'tripzi-features',
  },
  {
    id: 'feat-direct-messages',
    content: 'Users can send direct messages to other Tripzi users. Direct messages support text, image sharing, and location sharing. The messaging system shows online/offline status, last seen time, and read receipts. Users can block or report other users from the chat screen.',
    category: 'feature',
    title: 'Direct Messages',
    source: 'tripzi-features',
  },
  {
    id: 'feat-user-profile',
    content: 'Every Tripzi user has a profile showing their display name, profile picture, bio, and a grid of their created trips. Users can edit their profile, change their avatar, and update their bio. Other users can view profiles and see trip cards created by that user. Profiles also show verification status and follower/following counts.',
    category: 'feature',
    title: 'User Profile',
    source: 'tripzi-features',
  },
  {
    id: 'feat-notifications',
    content: 'Tripzi supports push notifications for: new messages, trip updates, new followers, trip likes, and trip join requests. Users can manage notification preferences from the Settings screen. Notifications can be enabled or disabled per category. Push notifications use Expo Notifications service.',
    category: 'feature',
    title: 'Push Notifications',
    source: 'tripzi-features',
  },
  {
    id: 'feat-dark-mode',
    content: 'Tripzi supports light and dark mode themes. Users can toggle between themes from the Settings screen, or set it to follow their system preference. The dark mode uses carefully designed color tokens that ensure readability and visual consistency across all screens.',
    category: 'feature',
    title: 'Dark Mode',
    source: 'tripzi-features',
  },
  {
    id: 'feat-map-integration',
    content: 'Tripzi integrates Google Maps for location features. Users can view trip destinations on a map, share their current location in chats, share live location, and see nearby points of interest. The map integration uses Google Maps API with custom styling to match the Tripzi theme.',
    category: 'feature',
    title: 'Map Integration',
    source: 'tripzi-features',
  },
  {
    id: 'feat-auth',
    content: 'Tripzi uses Supabase Authentication with Google Sign-In as the primary login method. Users can sign in with their Google account for a seamless onboarding experience. The app also supports email/password authentication as a fallback. Authentication tokens are securely stored and refreshed automatically.',
    category: 'feature',
    title: 'Authentication',
    source: 'tripzi-features',
  },
  {
    id: 'feat-settings',
    content: 'The Settings screen allows users to: manage notification preferences (push notifications, message alerts, trip updates), switch between light/dark mode, view app version, rate the app, share the app, access help & support, manage account (delete account), and view privacy policy and terms of service.',
    category: 'feature',
    title: 'Settings',
    source: 'tripzi-features',
  },
  {
    id: 'feat-media-upload',
    content: 'Tripzi supports media uploads for profile pictures, trip cover images, and chat attachments. Images are uploaded to Cloudflare R2 storage for fast, global delivery. The upload system shows progress indicators and supports image compression before upload to optimize bandwidth usage.',
    category: 'feature',
    title: 'Media Upload',
    source: 'tripzi-features',
  },

  // ═══════════════════════════════════════════════
  // FAQs
  // ═══════════════════════════════════════════════
  {
    id: 'faq-how-to-plan',
    content: 'To plan a trip with Tripzi AI: 1) Open the AI Planner from the bottom navigation tab. 2) Tap on a destination or the chat button to start a conversation. 3) Tell the AI where you want to go. 4) Answer the AI\'s questions about dates, budget, transport, accommodation, etc. 5) Review the summary the AI provides. 6) Confirm to generate your Trip Card. 7) Your Trip Card is automatically saved to your profile.',
    category: 'faq',
    title: 'How to plan a trip with AI?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-create-manual',
    content: 'To create a trip manually without AI: 1) Go to your Profile screen. 2) Tap the "+" or "Create Trip" button. 3) Fill in the trip details form: title, destination, dates, budget, transport, accommodation, etc. 4) Add places to visit and mandatory items. 5) Upload a cover image. 6) Tap "Create" to publish your trip card.',
    category: 'faq',
    title: 'How to create a trip manually?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-join-trip',
    content: 'To join someone else\'s trip: 1) Browse Trip Cards on the Explore screen. 2) Tap a Trip Card to view full details. 3) Tap the "Join Trip" button. 4) You\'ll be added to the trip\'s group chat where you can coordinate with other travelers. Note: The trip creator can set a maximum number of travelers and gender preferences.',
    category: 'faq',
    title: 'How to join a trip?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-change-theme',
    content: 'To change between dark and light mode: Go to Settings → Appearance → Toggle "Dark Mode" on or off. You can also set it to follow your device\'s system theme automatically.',
    category: 'faq',
    title: 'How to change dark/light mode?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-notifications-manage',
    content: 'To manage notifications: Go to Settings → Notifications. You can toggle push notifications on/off globally, or manage specific notification categories like message alerts, trip updates, and follow notifications. If you deny notification permissions at the OS level, you can re-enable them from your device\'s app settings.',
    category: 'faq',
    title: 'How to manage notifications?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-share-trip',
    content: 'To share a trip: 1) Open the Trip Card you want to share. 2) Tap the share icon. 3) Choose how to share — via direct message to another Tripzi user, or via external apps (WhatsApp, Instagram, etc.). Trip Cards generate a shareable link that anyone can open.',
    category: 'faq',
    title: 'How to share a trip?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-delete-account',
    content: 'To delete your Tripzi account: Go to Settings → Account → Delete Account. This will permanently delete your profile, trips, messages, and all associated data. This action cannot be undone. You\'ll need to confirm the deletion.',
    category: 'faq',
    title: 'How to delete my account?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-ai-models',
    content: 'Tripzi AI offers two response modes: 1) "Detailed" (Llama 3.3 70B) — Best for comprehensive trip planning with detailed itineraries and recommendations. 2) "Quick" (Llama 3.1 8B) — Faster responses for simple queries and quick suggestions. You can switch between models using the model selector at the top of the AI chat screen.',
    category: 'faq',
    title: 'What AI models are available?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-is-free',
    content: 'Tripzi is completely free to use. There are no subscription fees, no premium tiers, and no hidden charges. All features including AI trip planning, group chats, and trip creation are available to all users at no cost.',
    category: 'faq',
    title: 'Is Tripzi free?',
    source: 'tripzi-faq',
  },
  {
    id: 'faq-supported-platforms',
    content: 'Tripzi is available as a mobile app for Android. The app is built with React Native and Expo, ensuring a smooth native experience. iOS support is planned for a future release.',
    category: 'faq',
    title: 'What platforms is Tripzi available on?',
    source: 'tripzi-faq',
  },

  // ═══════════════════════════════════════════════
  // GUIDES
  // ═══════════════════════════════════════════════
  {
    id: 'guide-budget-planning',
    content: 'Budget planning tips for Indian trips: Budget trips: ₹1,000–₹3,000/day per person — includes hostels/homestays, local food, public transport. Mid-range trips: ₹3,000–₹8,000/day per person — includes 3-star hotels, mixed dining, private/shared transport. Luxury trips: ₹8,000–₹20,000+/day per person — includes 4-5 star hotels, fine dining, private transport. Always budget 10-15% extra for emergencies and unexpected expenses.',
    category: 'guide',
    title: 'Budget Planning for Indian Trips',
    source: 'tripzi-guides',
  },
  {
    id: 'guide-solo-safety',
    content: 'Safety tips for solo travelers in India: 1) Always share your itinerary with someone back home. 2) Keep digital and physical copies of important documents. 3) Register with your embassy if traveling for extended periods. 4) Avoid isolated areas after dark. 5) Use trusted transport services (Ola, Uber, or pre-booked vehicles). 6) Keep emergency numbers saved: Police (100), Ambulance (108), Women Helpline (1091). 7) Stay in well-reviewed accommodations. 8) Trust your instincts — if something feels off, leave.',
    category: 'guide',
    title: 'Solo Travel Safety Tips',
    source: 'tripzi-guides',
  },
  {
    id: 'guide-seasonal-best',
    content: 'Best times to visit popular Indian destinations: Manali: March–June (summer), December–February (snow). Goa: November–February (pleasant weather, peak season). Jaipur: October–March (cool weather). Leh-Ladakh: June–September (roads open, clear skies). Kerala: September–March (post-monsoon, pleasant). Varanasi: October–March (cool, festival season). Rishikesh: September–November, February–May (rafting season). Udaipur: October–March (best weather).',
    category: 'guide',
    title: 'Best Times to Visit Indian Destinations',
    source: 'tripzi-guides',
  },
  {
    id: 'guide-women-travel',
    content: 'Travel tips for women travelers in India: 1) Dress modestly, especially at religious sites — carry a scarf/dupatta. 2) Avoid traveling alone at night. 3) Use women-only compartments on trains and women-specific ride services. 4) Keep your phone charged and share live location with trusted contacts. 5) Research areas beforehand and read recent traveler reviews. 6) Join group trips through Tripzi for added safety and companionship. 7) Women Helpline: 1091 (24/7).',
    category: 'guide',
    title: 'Women Travel Safety Guide',
    source: 'tripzi-guides',
  },
  {
    id: 'guide-packing-essentials',
    content: 'Essential packing list for Indian trips: Documents: ID proof (Aadhaar/Passport), trip bookings printout, insurance. Health: First-aid kit, hand sanitizer, masks, sunscreen (SPF 50+), insect repellent. Tech: Phone charger, power bank (20000mAh+), earphones, offline maps. Clothing: Comfortable shoes, rain jacket (monsoon), layers (hill stations), modest clothing (temples). Misc: Reusable water bottle, snacks, local SIM card, cash + UPI.',
    category: 'guide',
    title: 'Packing Essentials',
    source: 'tripzi-guides',
  },
  {
    id: 'guide-transport-options',
    content: 'Transport options in India: Trains: Best for long distances, book via IRCTC. Categories: Sleeper (budget), 3AC, 2AC, 1AC (premium). Book 60–120 days in advance. Flights: Budget airlines like IndiGo, SpiceJet. Book 2–3 weeks ahead. Buses: State transport (KSRTC, UPSRTC) or private (RedBus). Good for 4–12 hour routes. Car: Self-drive (Zoomcar) or with driver. Best for group trips and flexible itineraries. Bike: Royal Enfield rentals popular for Ladakh, Spiti, and coastal routes.',
    category: 'guide',
    title: 'Transport Options in India',
    source: 'tripzi-guides',
  },

  // ═══════════════════════════════════════════════
  // PRD (Product)
  // ═══════════════════════════════════════════════
  {
    id: 'prd-about',
    content: 'Tripzi is a social travel planning app designed primarily for young travelers in India (18-35 age group). The app combines AI-powered trip planning with social features like trip sharing, group chats, and community discovery. The mission is to make travel planning collaborative, intelligent, and accessible to everyone.',
    category: 'prd',
    title: 'About Tripzi',
    source: 'tripzi-prd',
  },
  {
    id: 'prd-tech-stack',
    content: 'Tripzi Tech Stack: Frontend: React Native with Expo (TypeScript). Backend: Cloudflare Workers (Hono framework). Database: Supabase (PostgreSQL). AI: Groq API (Llama models) with Cloudflare AI Gateway. Vector DB: Zilliz Cloud. Storage: Cloudflare R2. Auth: Supabase Auth with Google Sign-In. Push Notifications: Expo Notifications. Maps: Google Maps API.',
    category: 'prd',
    title: 'Technology Stack',
    source: 'tripzi-prd',
  },
  {
    id: 'prd-target-audience',
    content: 'Tripzi targets young travelers in India aged 18-35 who are looking for affordable travel options, group trip companions, and AI-assisted trip planning. The app caters to college students, working professionals, solo travelers, and friend groups who want to plan trips collaboratively.',
    category: 'prd',
    title: 'Target Audience',
    source: 'tripzi-prd',
  },
  {
    id: 'prd-support',
    content: 'For support, feedback, or bug reports, users can reach out through: 1) In-app live chat support (Tawk.to integration). 2) Settings → Help & Support. The Tripzi team actively monitors and responds to all support requests.',
    category: 'prd',
    title: 'Support & Contact',
    source: 'tripzi-prd',
  },
];
