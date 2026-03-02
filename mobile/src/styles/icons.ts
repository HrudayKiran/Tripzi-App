/**
 * Centralized icon name constants for Ionicons used across the app.
 * Prevents typos and makes icon changes easy (change once, updates everywhere).
 */
export const ICONS = {
    // Navigation
    back: 'chevron-back' as const,
    backArrow: 'arrow-back' as const,
    forward: 'chevron-forward' as const,
    close: 'close' as const,
    menu: 'ellipsis-vertical' as const,

    // Tabs
    home: 'home' as const,
    homeOutline: 'home-outline' as const,
    chat: 'chatbubbles' as const,
    chatOutline: 'chatbubbles-outline' as const,
    profile: 'person' as const,
    profileOutline: 'person-outline' as const,
    add: 'add' as const,
    addCircle: 'add-circle' as const,

    // Actions
    search: 'search-outline' as const,
    edit: 'create-outline' as const,
    delete: 'trash-outline' as const,
    send: 'send' as const,
    sendOutline: 'send-outline' as const,
    camera: 'camera' as const,
    cameraOutline: 'camera-outline' as const,
    image: 'images-outline' as const,
    flag: 'flag-outline' as const,
    share: 'share-outline' as const,
    copy: 'copy-outline' as const,
    checkmark: 'checkmark-circle' as const,

    // Content
    location: 'location-outline' as const,
    locationFill: 'location' as const,
    calendar: 'calendar' as const,
    calendarOutline: 'calendar-outline' as const,
    map: 'map' as const,
    mapOutline: 'map-outline' as const,
    star: 'star' as const,
    starOutline: 'star-outline' as const,
    heart: 'heart' as const,
    heartOutline: 'heart-outline' as const,
    people: 'people' as const,
    peopleOutline: 'people-outline' as const,
    grid: 'grid-outline' as const,

    // Settings & Info
    settings: 'settings-outline' as const,
    notifications: 'notifications' as const,
    notificationsOutline: 'notifications-outline' as const,
    moon: 'moon' as const,
    sunnyOutline: 'sunny-outline' as const,
    info: 'information-circle-outline' as const,
    lock: 'lock-closed-outline' as const,
    help: 'help-circle-outline' as const,
    bug: 'bug-outline' as const,
    bulb: 'bulb-outline' as const,

    // Communication
    chatBubble: 'chatbubble-ellipses-outline' as const,
    call: 'call-outline' as const,
    mail: 'mail-outline' as const,

    // Media
    play: 'play' as const,
    pause: 'pause' as const,
    mic: 'mic' as const,
    micOff: 'mic-off' as const,
    attach: 'attach-outline' as const,

    // Status
    warning: 'warning-outline' as const,
    closeCircle: 'close-circle-outline' as const,
    time: 'time-outline' as const,
    eye: 'eye-outline' as const,
    eyeOff: 'eye-off-outline' as const,
} as const;

// Standard icon sizes used across the app
export const ICON_SIZE = {
    xs: 14,
    sm: 18,
    md: 20,
    lg: 24,
    xl: 28,
    xxl: 32,
    hero: 48,
} as const;
