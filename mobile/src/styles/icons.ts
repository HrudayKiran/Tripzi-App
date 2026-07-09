/**
 * Centralized icon name constants for Phosphor icons used across the app.
 * Prevents typos and makes icon changes easy (change once, updates everywhere).
 * These names correspond to components in 'phosphor-react-native'.
 */
export const ICONS = {
    // Navigation
    back: 'CaretLeft' as const,
    backArrow: 'ArrowLeft' as const,
    forward: 'CaretRight' as const,
    close: 'X' as const,
    menu: 'DotsThreeVertical' as const,

    // Tabs
    home: 'House' as const,
    homeOutline: 'House' as const, // Use weight='fill' for active state
    chat: 'ChatTeardropDots' as const,
    chatOutline: 'ChatTeardropDots' as const,
    profile: 'User' as const,
    profileOutline: 'User' as const,
    add: 'Plus' as const,
    addCircle: 'PlusCircle' as const,

    // Actions
    search: 'MagnifyingGlass' as const,
    edit: 'PencilSimple' as const,
    delete: 'Trash' as const,
    send: 'PaperPlaneTilt' as const,
    sendOutline: 'PaperPlaneTilt' as const,
    camera: 'Camera' as const,
    cameraOutline: 'Camera' as const,
    image: 'Image' as const,
    flag: 'Flag' as const,
    copy: 'Copy' as const,
    checkmark: 'CheckCircle' as const,

    // Content
    location: 'MapPin' as const,
    locationFill: 'MapPin' as const,
    calendar: 'Calendar' as const,
    calendarOutline: 'Calendar' as const,
    map: 'MapTrifold' as const,
    mapOutline: 'MapTrifold' as const,
    star: 'Star' as const,
    starOutline: 'Star' as const,
    heart: 'Heart' as const,
    heartOutline: 'Heart' as const,
    people: 'Users' as const,
    peopleOutline: 'Users' as const,
    grid: 'SquaresFour' as const,

    // Settings & Info
    settings: 'Gear' as const,
    notifications: 'Bell' as const,
    notificationsOutline: 'Bell' as const,
    moon: 'Moon' as const,
    sunnyOutline: 'Sun' as const,
    info: 'Info' as const,
    lock: 'Lock' as const,
    help: 'Question' as const,
    bug: 'Bug' as const,
    bulb: 'Lightbulb' as const,

    // Communication
    chatBubble: 'ChatCircle' as const,
    call: 'Phone' as const,
    mail: 'Envelope' as const,

    // Media
    play: 'Play' as const,
    pause: 'Pause' as const,
    mic: 'Microphone' as const,
    micOff: 'MicrophoneSlash' as const,
    attach: 'Paperclip' as const,

    // Status
    warning: 'Warning' as const,
    closeCircle: 'XCircle' as const,
    time: 'Clock' as const,
    eye: 'Eye' as const,
    eyeOff: 'EyeSlash' as const,
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
