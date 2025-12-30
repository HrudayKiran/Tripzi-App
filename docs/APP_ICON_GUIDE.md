# Tripzi App Icon Integration Guide

## Icon Design Prompt

Use this prompt with an AI image generator (DALL-E, Midjourney, or similar):

```
App icon for a travel buddy app called "Tripzi". Modern, minimalist design with vibrant gradient colors (purple to pink, #8B5CF6 to #EC4899). Icon should represent travel and connection - incorporate elements like a stylized airplane trail forming a heart, or connected location pins, or abstract globe with movement lines. Clean white details on gradient background. No text. Square format suitable for mobile app icon. Flat design, iOS/Android app icon style. High contrast, recognizable at small sizes.
```

### Design Guidelines
- **Colors**: Primary gradient from `#8B5CF6` (purple) to `#EC4899` (pink)
- **Style**: Flat, modern, minimalist
- **Elements to consider**:
  - Airplane + heart trail
  - Connected location pins
  - Abstract globe with journey lines
  - Compass/navigation motif
- **Format**: Square (1024x1024 for high-res source)
- **No text**: Icon should work without text

---

## Integration Checklist

### 1. Generate Icon Sizes

From your 1024x1024 source icon, create these sizes:

#### Android (place in `android/app/src/main/res/`)
```
mipmap-mdpi/ic_launcher.png         48x48
mipmap-hdpi/ic_launcher.png         72x72
mipmap-xhdpi/ic_launcher.png        96x96
mipmap-xxhdpi/ic_launcher.png       144x144
mipmap-xxxhdpi/ic_launcher.png      192x192
```

#### Android Adaptive Icons
```
mipmap-anydpi-v26/ic_launcher.xml   (vector pointing to foreground/background)
drawable/ic_launcher_foreground.xml  (or PNG with 108dp safe zone)
drawable/ic_launcher_background.xml  (or solid color)
```

#### iOS (place in `ios/Tripzi/Images.xcassets/AppIcon.appiconset/`)
```
Icon-20.png          20x20
Icon-20@2x.png       40x40
Icon-20@3x.png       60x60
Icon-29.png          29x29
Icon-29@2x.png       58x58
Icon-29@3x.png       87x87
Icon-40.png          40x40
Icon-40@2x.png       80x80
Icon-40@3x.png       120x120
Icon-60@2x.png       120x120
Icon-60@3x.png       180x180
Icon-76.png          76x76
Icon-76@2x.png       152x152
Icon-83.5@2x.png     167x167
Icon-1024.png        1024x1024
```

### 2. Update Expo Configuration

Edit `mobile/app.json`:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#8B5CF6"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon-foreground.png",
        "backgroundColor": "#8B5CF6"
      }
    },
    "ios": {
      "icon": "./assets/icon.png"
    }
  }
}
```

### 3. Required Assets

Place in `mobile/assets/`:
- `icon.png` - 1024x1024 main icon
- `adaptive-icon-foreground.png` - 1024x1024 with transparent background (Android adaptive)
- `splash.png` - 1284x2778 (or larger) splash screen
- `favicon.png` - 48x48 (for web)

### 4. Android Adaptive Icon Notes

For Android 8.0+ adaptive icons:
- **Foreground**: Your icon design on transparent background
- **Background**: Solid color (#8B5CF6) or gradient image
- **Safe zone**: Content should be within the center 66% circle
- The system may apply various masks (circle, squircle, rounded square)

### 5. Splash Screen

Match the app icon theme:
- Background: Gradient or solid `#8B5CF6`
- Center: White or light-colored logo/icon
- Dimensions: Various, Expo handles resizing

### 6. Build Commands

After updating assets:

```bash
# Regenerate native projects
npx expo prebuild --clean

# Build for Android
eas build -p android --profile development

# Build for iOS  
eas build -p ios --profile development
```

### 7. Verification

After building:
- [ ] Check Android home screen icon
- [ ] Check Android recent apps icon
- [ ] Check iOS home screen icon
- [ ] Check iOS Settings icon
- [ ] Verify splash screen displays correctly
- [ ] Test dark mode appearance (if applicable)

---

## Quick Tool Recommendations

### Icon Generators
- [App Icon Generator](https://appicon.co/) - Generate all sizes from source
- [Make App Icon](https://makeappicon.com/) - Similar tool
- [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/) - Android-specific

### Design Tools
- Figma (free, great for icon design)
- Canva (easy gradient backgrounds)
- Adobe Illustrator (professional vector work)
