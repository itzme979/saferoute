import type { ReactNode, SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Svg({ size = 20, title, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

const make = (paths: ReactNode) => (p: IconProps) => <Svg {...p}>{paths}</Svg>;

export const IconHome = make(<><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></>);
export const IconRoute = make(<><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" /></>);
export const IconNavigation = make(<path d="M12 3 5 20l7-4 7 4z" />);
export const IconUsers = make(<><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><circle cx="17" cy="9.5" r="2.4" /><path d="M16 14.8c2.3-.2 4 1.2 4.5 3.7" /></>);
export const IconMap = make(<><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z" /><path d="M9 4v14M15 6v14" /></>);
export const IconSettings = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const IconBell = make(<><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>);
export const IconShield = make(<><path d="M12 3.5 5 6v5.5c0 4.3 3 7.7 7 9 4-1.3 7-4.7 7-9V6z" /></>);
export const IconShieldCheck = make(<><path d="M12 3.5 5 6v5.5c0 4.3 3 7.7 7 9 4-1.3 7-4.7 7-9V6z" /><path d="m9 12 2.2 2.2L15.5 10" /></>);
export const IconSos = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5.5" /><circle cx="12" cy="16.3" r=".6" fill="currentColor" /></>);
export const IconPhone = make(<path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5L16 14l4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z" />);
export const IconMail = make(<><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 7 8 6 8-6" /></>);
export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconX = make(<path d="M6 6l12 12M18 6 6 18" />);
export const IconCheck = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconCheckCircle = make(<><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12.2 2.4 2.4 4.8-4.8" /></>);
export const IconAlert = make(<><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4" /><circle cx="12" cy="16.8" r=".6" fill="currentColor" /></>);
export const IconInfo = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".6" fill="currentColor" /></>);
export const IconLightbulb = make(<><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>);
export const IconStreetlight = make(<><path d="M8 21V7a3 3 0 0 1 3-3h4" /><path d="M13.5 4h5l-1 3h-3z" /><path d="M6 21h4" /></>);
export const IconMoon = make(<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />);
export const IconSun = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>);
export const IconNews = make(<><rect x="3.5" y="5" width="13" height="14" rx="1.5" /><path d="M16.5 9h3a1 1 0 0 1 1 1v7.5a1.5 1.5 0 0 1-3 0V9" /><path d="M7 9h6M7 12.5h6M7 16h4" /></>);
export const IconCone =make(<><path d="M9.5 4h5l4 15h-13z" /><path d="M8 11h8M6.8 15.5h10.4" /><path d="M3.5 19.5h17" /></>);
export const IconSidewalk = make(<><path d="M4 20 8 4M20 20 16 4" /><path d="M11 8l1.5 3-2 2 2 3" /></>);
export const IconAccessibility = make(<><circle cx="12" cy="4.5" r="1.6" /><path d="M10.5 8.5h3l-.5 5h3.5l2 4.5" /><path d="M9 11.5a5 5 0 1 0 6.5 7" /></>);
export const IconIntersection = make(<><path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /></>);
export const IconObstacle = make(<><path d="M12 3c-3 0-5 2.2-5 5 0 1.2.4 2.2 1 3a4 4 0 0 0 4 6.5A4 4 0 0 0 16 11c.6-.8 1-1.8 1-3 0-2.8-2-5-5-5z" /><path d="M12 13v8M9 21h6" /></>);
export const IconDots = make(<><circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18" cy="12" r="1.2" fill="currentColor" /></>);
export const IconCrosshair = make(<><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.2" /><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5" /></>);
export const IconSearch = make(<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>);
export const IconChevronRight = make(<path d="m9.5 6 6 6-6 6" />);
export const IconChevronLeft = make(<path d="m14.5 6-6 6 6 6" />);
export const IconChevronDown = make(<path d="m6 9.5 6 6 6-6" />);
export const IconClock = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const IconRuler = make(<><path d="M4 16.5 16.5 4 20 7.5 7.5 20z" /><path d="m8 12.5 1.8 1.8M11 9.5l1.8 1.8M14 6.5l1.8 1.8" /></>);
export const IconTurn = make(<><path d="M6 20v-7a4 4 0 0 1 4-4h8" /><path d="m15 5.5 3.5 3.5-3.5 3.5" /></>);
export const IconStairs = make(<path d="M3.5 19.5h4v-4h4v-4h4v-4h5" />);
export const IconCrossing = make(<><path d="M4 5v14M20 5v14" /><path d="M8 8h8M8 12h8M8 16h8" /></>);
export const IconStore = make(<><path d="M4 9.5 5.5 4.5h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12v7.5h13V12M10 19.5v-4h4v4" /></>);
export const IconEye = make(<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>);
export const IconEyeOff = make(<><path d="M3 3l18 18" /><path d="M10.6 6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.6 6.7C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4.4-1.1" /><path d="M9.9 9.9a2.8 2.8 0 0 0 4 4" /></>);
export const IconLogout = make(<><path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14" /><path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" /></>);
export const IconTrash = make(<><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /><path d="M10 11v5M14 11v5" /></>);
export const IconEdit = make(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>);
export const IconCamera = make(<><path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a.5.5 0 0 1 .5.5v9.5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V9a.5.5 0 0 1 .5-.5z" /><circle cx="12" cy="13.5" r="3.3" /></>);
export const IconLock = make(<><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>);
export const IconShare = make(<><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" /></>);
export const IconUser = make(<><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" /></>);
export const IconFlag = make(<><path d="M5.5 21V4" /><path d="M5.5 4.5h11l-2 4 2 4h-11" /></>);
export const IconFilter = make(<path d="M4 5.5h16l-6.2 7.3V19l-3.6-1.8v-4.4z" />);
export const IconHistory = make(<><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3.5 4.5V8H7" /><path d="M12 8v4.3l3 1.7" /></>);
export const IconMenu = make(<path d="M4 7h16M4 12h16M4 17h16" />);
export const IconArrowRight = make(<path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />);
export const IconSwap = make(<><path d="M7 4v15M3.5 7.5 7 4l3.5 3.5" /><path d="M17 20V5M13.5 16.5 17 20l3.5-3.5" /></>);
export const IconPin = make(<><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>);
export const IconPlay = make(<path d="M8 5.5v13l10-6.5z" />);
export const IconStop = make(<rect x="6.5" y="6.5" width="11" height="11" rx="2" />);
export const IconSend = make(<><path d="M20.5 3.5 10 14" /><path d="m20.5 3.5-6.5 17-4-6.5-6.5-4z" /></>);
export const IconRefresh = make(<><path d="M20 11.5A8 8 0 0 0 5.6 7M4 12.5A8 8 0 0 0 18.4 17" /><path d="M5 3.5V7.5h4M19 20.5v-4h-4" /></>);
export const IconHeart = make(<path d="M12 20s-7.5-4.5-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.5 12 20 12 20z" />);
export const IconSparkle = make(<path d="M12 3.5 13.8 10 20.5 12l-6.7 2-1.8 6.5-1.8-6.5L3.5 12l6.7-2z" />);
export const IconLayers = make(<><path d="m12 4 8.5 4.5L12 13 3.5 8.5z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" /></>);
export const IconLink = make(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const IconCopy = make(<><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>);
export const IconDatabase = make(<><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>);
export const IconBeaker = make(<><path d="M9 3.5h6M10 3.5v6L4.8 18.3A1.5 1.5 0 0 0 6.1 20.5h11.8a1.5 1.5 0 0 0 1.3-2.2L14 9.5v-6" /><path d="M7.5 14.5h9" /></>);
