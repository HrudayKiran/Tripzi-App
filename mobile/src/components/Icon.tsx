import React from 'react';

/**
 * Static icon map — only the Phosphor icons actually used in this app.
 *
 * WHY: `import * as Phosphor` bundles all 1,400+ icons (~2.8 MB extra JS).
 * Importing each icon individually allows Metro to tree-shake everything else,
 * shipping only what's listed here.
 *
 * NOTE: phosphor-react-native individual files use named exports, not default.
 *
 * HOW TO ADD AN ICON: Add a named import below, then add it to ICONS.
 * TypeScript will catch any wrong name at compile time via the IconName type.
 */

// --- Named imports from individual icon files ---
import { ArrowClockwise } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { ArrowLeft } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { ArrowUUpLeft } from 'phosphor-react-native/src/icons/ArrowUUpLeft';
import { Bell } from 'phosphor-react-native/src/icons/Bell';
import { BellSlash } from 'phosphor-react-native/src/icons/BellSlash';
import { Bug } from 'phosphor-react-native/src/icons/Bug';
import { Calendar } from 'phosphor-react-native/src/icons/Calendar';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
import { Camera } from 'phosphor-react-native/src/icons/Camera';
import { CaretDown } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeft } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRight } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretUp } from 'phosphor-react-native/src/icons/CaretUp';
import { ChatTeardrop } from 'phosphor-react-native/src/icons/ChatTeardrop';
import { ChatDots } from 'phosphor-react-native/src/icons/ChatDots';
import { ChatTeardropDots } from 'phosphor-react-native/src/icons/ChatTeardropDots';
import { ChatTeardropText } from 'phosphor-react-native/src/icons/ChatTeardropText';
import { Check } from 'phosphor-react-native/src/icons/Check';
import { CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
import { Checks } from 'phosphor-react-native/src/icons/Checks';
import { CheckSquare } from 'phosphor-react-native/src/icons/CheckSquare';
import { CircleHalf } from 'phosphor-react-native/src/icons/CircleHalf';
import { Clock } from 'phosphor-react-native/src/icons/Clock';
import { CloudSlash } from 'phosphor-react-native/src/icons/CloudSlash';
import { Crop } from 'phosphor-react-native/src/icons/Crop';
import { Cube } from 'phosphor-react-native/src/icons/Cube';
import { DotsThree } from 'phosphor-react-native/src/icons/DotsThree';
import { DotsThreeVertical } from 'phosphor-react-native/src/icons/DotsThreeVertical';
import { DotsSixVertical } from 'phosphor-react-native/src/icons/DotsSixVertical';
import { Download } from 'phosphor-react-native/src/icons/Download';
import { Envelope } from 'phosphor-react-native/src/icons/Envelope';
import { Equals } from 'phosphor-react-native/src/icons/Equals';
import { FileText } from 'phosphor-react-native/src/icons/FileText';
import { Flag } from 'phosphor-react-native/src/icons/Flag';
import { FloppyDisk } from 'phosphor-react-native/src/icons/FloppyDisk';
import { Gear } from 'phosphor-react-native/src/icons/Gear';
import { Globe } from 'phosphor-react-native/src/icons/Globe';
import { Hash } from 'phosphor-react-native/src/icons/Hash';
import { House } from 'phosphor-react-native/src/icons/House';
import { Image } from 'phosphor-react-native/src/icons/Image';
import { Info } from 'phosphor-react-native/src/icons/Info';
import { Key } from 'phosphor-react-native/src/icons/Key';
import { Lightbulb } from 'phosphor-react-native/src/icons/Lightbulb';
import { List } from 'phosphor-react-native/src/icons/List';
import { Lock } from 'phosphor-react-native/src/icons/Lock';
import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPin } from 'phosphor-react-native/src/icons/MapPin';
import { MapTrifold } from 'phosphor-react-native/src/icons/MapTrifold';
import { Megaphone } from 'phosphor-react-native/src/icons/Megaphone';
import { Moon } from 'phosphor-react-native/src/icons/Moon';
import { NavigationArrow } from 'phosphor-react-native/src/icons/NavigationArrow';
import { NotePencil } from 'phosphor-react-native/src/icons/NotePencil';
import { Notebook } from 'phosphor-react-native/src/icons/Notebook';
import { PaperPlaneTilt } from 'phosphor-react-native/src/icons/PaperPlaneTilt';
import { PaperPlaneRight } from 'phosphor-react-native/src/icons/PaperPlaneRight';
import { Pencil } from 'phosphor-react-native/src/icons/Pencil';
import { PencilSimple } from 'phosphor-react-native/src/icons/PencilSimple';
import { Plus } from 'phosphor-react-native/src/icons/Plus';
import { PlusCircle } from 'phosphor-react-native/src/icons/PlusCircle';
import { Prohibit } from 'phosphor-react-native/src/icons/Prohibit';
import { Question } from 'phosphor-react-native/src/icons/Question';
import { Radio } from 'phosphor-react-native/src/icons/Radio';
import { SignOut } from 'phosphor-react-native/src/icons/SignOut';
import { Sparkle } from 'phosphor-react-native/src/icons/Sparkle';
import { Star } from 'phosphor-react-native/src/icons/Star';
import { Sun } from 'phosphor-react-native/src/icons/Sun';
import { ToggleLeft } from 'phosphor-react-native/src/icons/ToggleLeft';
import { ToggleRight } from 'phosphor-react-native/src/icons/ToggleRight';
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { User } from 'phosphor-react-native/src/icons/User';
import { UserMinus } from 'phosphor-react-native/src/icons/UserMinus';
import { UserPlus } from 'phosphor-react-native/src/icons/UserPlus';
import { Users } from 'phosphor-react-native/src/icons/Users';
import { Warning } from 'phosphor-react-native/src/icons/Warning';
import { X } from 'phosphor-react-native/src/icons/X';
import { XCircle } from 'phosphor-react-native/src/icons/XCircle';

// --- Static map: only icons used in this app ---
const ICONS = {
    ArrowClockwise,
    ArrowLeft,
    ArrowUp,
    ArrowUUpLeft,
    Bell,
    BellSlash,
    Bug,
    Calendar,
    CalendarBlank,
    Camera,
    CaretDown,
    CaretLeft,
    CaretRight,
    CaretUp,
    ChatTeardrop,
    ChatDots,
    ChatTeardropDots,
    ChatTeardropText,
    Check,
    CheckCircle,
    Checks,
    CheckSquare,
    CircleHalf,
    Clock,
    CloudSlash,
    Crop,
    Cube,
    DotsThree,
    DotsThreeVertical,
    DotsSixVertical,
    Download,
    Envelope,
    Equals,
    FileText,
    Flag,
    FloppyDisk,
    Gear,
    Globe,
    Hash,
    House,
    Image,
    Info,
    Key,
    Lightbulb,
    List,
    Lock,
    MagnifyingGlass,
    MapPin,
    MapTrifold,
    Megaphone,
    Moon,
    NavigationArrow,
    NotePencil,
    Notebook,
    PaperPlaneTilt,
    PaperPlaneRight,
    Pencil,
    PencilSimple,
    Plus,
    PlusCircle,
    Prohibit,
    Question,
    Radio,
    SignOut,
    Sparkle,
    Star,
    Sun,
    ToggleLeft,
    ToggleRight,
    Trash,
    User,
    UserMinus,
    UserPlus,
    Users,
    Warning,
    X,
    XCircle,
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
    name: IconName;
    size?: number;
    color?: string;
    weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
    style?: any;
};

export const Icon = ({
    name,
    size = 24,
    color = '#000',
    weight = 'regular',
    style,
}: IconProps) => {
    const IconComponent = ICONS[name];

    if (!IconComponent) {
        if (__DEV__) console.warn(`[Icon] "${name}" not found in static icon map. Add it to Icon.tsx.`);
        return null;
    }

    return <IconComponent size={size} color={color} weight={weight} style={style} />;
};

export default Icon;
