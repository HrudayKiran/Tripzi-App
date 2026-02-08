
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';

// Hardcoded for now, or use environment variable
const REGION = 'us-central1';
const PROJECT_ID = admin.instanceId().app.options.projectId || 'tripzi-app';
const BASE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/shareTrip`;

/**
 * Generate a shareable link for a trip.
 * This is called by the mobile client.
 */
export const generateShareLink = onCall(async (request) => {
    const { tripId, tripTitle, tripImage } = request.data;

    if (!tripId) {
        throw new HttpsError('invalid-argument', 'Trip ID is required');
    }

    // specific handling for tripTitle and tripImage to be URL safe
    const encodedTitle = encodeURIComponent(tripTitle || 'Check out this trip!');
    const encodedImage = encodeURIComponent(tripImage || '');

    // Construct the URL with query parameters
    // We point to our HTTP function 'shareTrip'
    const link = `${BASE_URL}?id=${tripId}&title=${encodedTitle}&img=${encodedImage}`;

    return {
        webLink: link,
        message: `Check out this trip: ${tripTitle}`,
        title: tripTitle
    };
});


/**
 * Handle the HTTP request for the share link.
 * Serves an HTML page with Open Graph tags and JS redirect.
 */
export const shareTrip = onRequest(async (req, res) => {
    const tripId = req.query.id as string;
    const title = req.query.title as string || 'Tripzi Trip';
    const image = req.query.img as string || 'https://tripzi.app/logo.png'; // Fallback image

    if (!tripId) {
        res.status(400).send('Invalid Trip ID');
        return;
    }

    const appScheme = `tripzi://trip/${tripId}`;
    const playStoreUrl = `https://play.google.com/store/apps/details?id=com.tripzi.mobile`;

    // HTML with Open Graph tags and Redirect Script
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} | Tripzi</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        
        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">
        <meta property="og:title" content="${title}">
        <meta property="og:description" content="View this trip on Tripzi! Join me on an adventure.">
        <meta property="og:image" content="${image}">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">
        <meta property="twitter:title" content="${title}">
        <meta property="twitter:description" content="View this trip on Tripzi! Join me on an adventure.">
        <meta property="twitter:image" content="${image}">

        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #f3f4f6;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
                padding: 20px;
            }
            .card {
                background: white;
                padding: 2rem;
                border-radius: 1rem;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                max-width: 400px;
                width: 100%;
            }
            .btn {
                display: inline-block;
                background-color: #8B5CF6;
                color: white;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                text-decoration: none;
                font-weight: bold;
                margin-top: 1rem;
            }
            h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
            p { color: #6B7280; }
        </style>

        <script>
          window.onload = function() {
            // Try to open the app
            window.location.href = "${appScheme}";
            
            // Fallback to Play Store after timeout
            setTimeout(function() {
                // If the user sets a specific flag or if the browser doesn't support deep links well
                // we can redirect to store.
                // For better UX, we might show a button if auto-redirect fails/is blocked.
                
                // Simple auto-redirect attempt
                // window.location.href = "${playStoreUrl}";
            }, 2500);
          };
          
          function openApp() {
             window.location.href = "${appScheme}";
          }
        </script>
      </head>
      <body>
        <div class="card">
            <h1>${title}</h1>
            <p>Opening Tripzi...</p>
            <p>If the app doesn't open automatically, click below.</p>
            <a href="javascript:openApp()" class="btn">Open App</a>
            <br/><br/>
            <p style="font-size: 0.875rem;">Don't have the app?</p>
            <a href="${playStoreUrl}" style="color: #8B5CF6; text-decoration: none;">Download from Play Store</a>
        </div>
      </body>
    </html>
    `;

    res.status(200).send(html);
});
