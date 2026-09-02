export interface Profile {
  id: string;
  name: string;
  isDefault?: boolean;
}

export interface FontStyleOptions {
  family: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  superscript?: boolean;
  subscript?: boolean;
  alignHorizontal: 'left' | 'center' | 'right';
  alignVertical: 'top' | 'middle' | 'bottom';
  maxSize: number;
  opacity: number;
  outlineEnabled?: boolean;
  outlineColor?: string;
  outlineSize?: number;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffset?: number;
  marginLeft?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  casing?: 'none' | 'uppercase' | 'lowercase' | 'titlecase';
  lineSpacing?: number;
}

export interface SlideLabelConfig {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  shortcut: string;
}

export interface SystemOptions {
  mainOutput: {
    general: {
      outputMonitor: string;
      alphaChannel: 'Disabled' | 'Enabled';
      position: { left: number; top: number; width: number; height: number };
      margins: { left: number; top: number; right: number; bottom: number };
      defaultFont: FontStyleOptions;
      disableLogoOnLive: boolean;
    };
    song: {
      songFont: FontStyleOptions;
      showVerseChorusLabel: boolean;
      labelFont: FontStyleOptions;
      labelLocation?: 'Header' | 'Top Left' | 'Top Right' | 'Bottom Left' | 'Bottom Right';
      labelStyle?: 'plain' | 'badge' | 'uppercase' | 'parentheses';
      labelPrefix?: string;
      displayCopyrightInfo: boolean;
      copyrightFont: FontStyleOptions;
      copyrightPosition?: 'Bottom Left' | 'Bottom Right' | 'Bottom Center' | 'Top Left' | 'Top Right';
      licenseInfo: string;
      showOnFirstSlideOnly: boolean;
      showOnLastSlideOnly?: boolean;
      minFontSize?: number;
      allCapsLyrics?: boolean;
      lineSpacing?: number;
    };
    scripture: {
      enableScriptureSupport: boolean;
      scriptureFont: FontStyleOptions;
      showVerseNumbers: boolean;
      verseFont: FontStyleOptions;
      verseNumberStyle?: 'superscript' | 'bracket' | 'parenthesis' | 'period' | 'plain';
      verseColor?: string;
      showReference: boolean;
      referenceFont: FontStyleOptions;
      referenceLocation: 'After Each Slide' | 'Before Each Slide' | 'Top Right' | 'Bottom Right' | 'Top Left' | 'Bottom Left';
      referenceFormat?: 'Book Chapter:Verse (Translation)' | 'Book Chapter:Verse' | 'Book Chapter, Verse' | 'Chapter:Verse - Book';
      referenceCasing?: 'none' | 'uppercase' | 'titlecase' | 'lowercase';
      showTranslationBadge?: boolean;
      referencePrefix?: string;
      referenceSuffix?: string;
      showBookName?: boolean;
      showChapterNumber?: boolean;
      showVerseRangeInRef?: boolean;
      showCompletePassage: boolean;
      referenceIndent: boolean;
      abbreviateBookNames: boolean;
      additionalLineSpacing: boolean;
      showReferenceOnly: boolean;
      breakOnNewVerse: boolean;
      automaticallyFlow: boolean;
      minFontSize: number;
      lineSpacing?: number;
    };
    presentations: {
      titleFont: FontStyleOptions;
      subTitleFont: FontStyleOptions;
      contentFont: FontStyleOptions;
    };
    transitions: {
      activeTab: 'Slide' | 'Black' | 'Clear' | 'Logo';
      blend: 'Blend' | 'Cut' | 'Wipe Left' | 'Wipe Right' | 'Fade Black';
      duration: number; // ms e.g. 500
      easing?: string; // easeInOut, linear, easeOut, etc.
    };
    alerts: {
      nursery: {
        enabled: boolean;
        font: FontStyleOptions;
        backgroundColor: string;
        backgroundOpacity: number;
        location: 'Top Right' | 'Top Left' | 'Bottom Right' | 'Bottom Left';
        autoRemove: boolean;
        autoRemoveDuration: string;
        currentCode?: string;
      };
      message: {
        enabled: boolean;
        font: FontStyleOptions;
        backgroundColor: string;
        backgroundOpacity: number;
        location: 'Bottom' | 'Top';
        scrollSpeed: number;
        currentMessage?: string;
      };
    };
  };
  alternateOutput: {
    enabled: boolean;
    outputMonitor: string;
    position: { left: number; top: number; width: number; height: number };
    margins: { left: number; top: number; right: number; bottom: number };
    defaultFont: FontStyleOptions;
  };
  foldback: {
    enabled: boolean;
    outputMonitor: string;
    position: { left: number; top: number; width: number; height: number };
    margins: { left: number; top: number; right: number; bottom: number };
    defaultFont: FontStyleOptions;
    clockEnabled: boolean;
  };
  serviceIntervals: {
    countdownEnabled: boolean;
    countdownTime: string;
    intervalType: string;
  };
  slideLabels: SlideLabelConfig[];
  appearance?: {
    themeMode: 'dark' | 'light' | 'system';
    accentColor?: string;
    compactMode?: boolean;
    highContrast?: boolean;
  };
  advanced: {
    showLiveOnStartup: boolean;
    advanceScheduleOnGoLive: boolean;
    preventDvdSpinDown: boolean;
    alwaysSaveStandalone: boolean;
    enableRemoteControl: boolean;
    remoteName: string;
  };
}

export type AssetType = 'image' | 'video' | 'motion' | 'audio' | 'logo' | 'document';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  hash?: string;
  url: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  tags?: string[];
  blob?: Blob;
  duration?: number;
  data?: any;
  isDefaultScope?: {
    songs?: boolean;
    scriptures?: boolean;
    presentations?: boolean;
    announcements?: boolean;
  };
  createdAt?: number;
}

export interface AssetReference {
  assetId: string;
  usageContext: string;
}

export interface ThemeStyles {
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: 'none' | 'underline';
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  alignVertical?: 'top' | 'middle' | 'bottom';
  textShadow?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  textOutline?: boolean;
  outlineColor?: string;
  outlineSize?: number;
  backgroundType?: 'color' | 'image' | 'video' | 'gradient';
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  backgroundAssetId?: string;
  backgroundOverlayColor?: string;
  backgroundOverlayOpacity?: number;
  backgroundBlur?: number;
  logoAssetId?: string;
  logoUrl?: string;
  logoPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'custom';
  logoSize?: number;
  logoOpacity?: number;
  showLogo?: boolean;
  transitions?: string;
  padding?: string;
  paddingHorizontal?: number;
  paddingVertical?: number;
  lineHeight?: number;
  letterSpacing?: number;
  boxStyle?: 'none' | 'glass' | 'solid' | 'light-glass' | 'border';
  widthPercent?: number;
  positionX?: number;
  positionY?: number;
  layoutPreset?: 'center' | 'lower-third' | 'glass-card' | 'top-header' | 'split-two-column' | 'editorial' | 'border';
  labelBgColor?: string;
  labelTextColor?: string;
}

export type ThemeType = 'global' | 'song' | 'bible' | 'presentation' | 'announcement' | 'stage' | 'logo' | 'custom';

export interface Theme {
  id: string;
  name: string;
  type: 'global' | 'song' | 'bible' | 'presentation' | 'announcement' | 'stage' | 'logo' | 'custom';
  styles: ThemeStyles;
}

export type ContentType = 'song' | 'bible' | 'ppt' | 'presentation' | 'media' | 'image' | 'video' | 'announcement' | 'countdown';

export interface SongSection {
  id: string;
  name: string; // e.g., 'Verse 1', 'Chorus 1', 'Bridge', 'Ending'
  text: string;
}

export interface Song {
  id: string;
  title: string;
  author?: string;
  copyright?: string;
  ccli?: string;
  ccliNumber?: string;
  key?: string;
  tempo?: string;
  category?: string;
  lyrics?: string;
  tags?: string[];
  sections?: SongSection[];
  themeId?: string;
  themeOverride?: ThemeStyles;
  defaultBackgroundUrl?: string;
}

export interface ScriptureVerse {
  id: string;
  translation: string;
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
}

export interface Slide {
  id: string;
  title?: string;
  text: string;
  notes?: string;
  backgroundUrl?: string;
  isVideo?: boolean;
  themeId?: string;
  themeOverride?: ThemeStyles;
  verses?: Array<{ verse: number, text: string }>;
}

export interface PresentationItem {
  id: string;
  type: ContentType;
  contentId: string;
  name: string;
  notes?: string;
  themeId?: string;
  themeOverride?: ThemeStyles;
  customBackgroundUrl?: string;
  data?: any;
  isExpanded?: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  items: PresentationItem[];
  createdAt: number;
}

export interface OutputDisplay {
  id: string;
  name: string;
  resolution: string;
  position: string;
  assignedGroupId: string;
  isConnected: boolean;
  isEnabled: boolean;
}

export interface OutputGroup {
  id: string;
  name: string;
  role?: 'primary' | 'confidence' | 'broadcast' | 'lobby';
  themeId?: string;
  themeStyles?: ThemeStyles;
  displayIds?: string[];
  aspectRatio?: string;
  customResolution?: { width: number; height: number };
  isBlack?: boolean;
  isClear?: boolean;
  showLogo?: boolean;
}

export interface AlertState {
  active: boolean;
  message: string;
  position: 'top' | 'bottom';
  backgroundColor?: string;
  textColor?: string;
  speed?: number;
  nurseryText?: string;
  showNursery?: boolean;
}

export interface PresentationState {
  activeScheduleId: string | null;
  activeItemId: string | null;
  activeSlideIndex: number;
  nextSlideIndex: number;
  isBlack: boolean;
  isClear: boolean;
  showLogo: boolean;
  timestamp: number;
  isVideoPlaying?: boolean;
  isVideoMuted?: boolean;
  isVideoLooping?: boolean;
  videoVolume?: number;
  videoCurrentTime?: number;
  videoDuration?: number;
  videoSeekTime?: number;
}

// Workspace & Panel Management Types
export type PanelId = 'schedule' | 'preview' | 'live' | 'multiGroup' | 'resources' | 'stageMonitor' | 'quickNotes' | 'mediaLibrary';

export interface FloatingCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMaximized?: boolean;
}

export interface PanelState {
  id: PanelId;
  title: string;
  visible: boolean;
  visibility?: boolean;
  isCollapsed: boolean;
  collapsed?: boolean;
  isDocked: boolean;
  size?: number;
  floating: FloatingCoordinates;
  defaultDockSize?: number;
}

export interface WorkspaceLayoutState {
  version: number;
  activePresetId: string;
  panels: Record<PanelId, PanelState>;
  panelGroupSizes: {
    verticalSplit: number[];
    horizontalMainSplit: number[];
    bottomSplit: number[];
    previewVerticalSplit: number[];
    liveVerticalSplit: number[];
    resourcesSplit: number[];
  };
  lastUpdated: number;
}

export interface WorkspacePreset {
  id: string;
  name: string;
  description: string;
  isBuiltIn?: boolean;
  panels: Record<PanelId, Partial<PanelState>>;
  panelGroupSizes: {
    verticalSplit: number[];
    horizontalMainSplit: number[];
    bottomSplit: number[];
    previewVerticalSplit: number[];
    liveVerticalSplit: number[];
    resourcesSplit: number[];
  };
}

export interface CustomKeyMappings {
  clearOutput: string; // e.g. 'F7' or 'C'
  goLive: string; // e.g. 'F5' or 'Enter'
  nextSlide: string; // e.g. 'ArrowDown' or 'Space'
  previousSlide: string; // e.g. 'ArrowUp' or 'PageUp'
  blackout?: string; // e.g. 'F6' or 'B'
  logo?: string; // e.g. 'F8' or 'L'
  nextItem?: string; // e.g. 'ArrowRight'
  previousItem?: string; // e.g. 'ArrowLeft'
}

export interface ShortcutSettings {
  arrowControlsLive: boolean; // default true: arrow down/up directly moves live slides
  spacebarAdvancesLive: boolean; // default true: space advances live slide
  enterGoesLive: boolean; // default true: Enter or Ctrl+Enter sends to live
  singleClickGoLive: boolean; // default false
  numericQuickJump: boolean; // default true: 1-9 jumps to verse/chorus
  quickKeysBcl: boolean; // default true: B, C, L toggles black, clear, logo
  wrapAroundSlides: boolean; // default false: wrap around when reaching end of slide deck
  presetName: 'SimpleWorship' | 'EasyWorship' | 'ProPresenter' | 'Custom';
  keyMappings: CustomKeyMappings;
}

export type ProjectorStatus = 'CONNECTED' | 'DISCONNECTED' | 'MINIMIZED' | 'FULLSCREEN' | 'WINDOWED' | 'ERROR' | 'DISPLAY UNAVAILABLE' | 'PROJECTOR CLOSED';

export interface NativeDisplayTarget {
  id: string;
  label?: string;
  name?: string;
  isPrimary?: boolean;
  isInternal?: boolean;
  connectionState?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  workArea?: { x: number; y: number; width: number; height: number };
  scaleFactor?: number;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron?: boolean;
      minimizeWindow?: () => Promise<boolean>;
      toggleMaximizeWindow?: () => Promise<boolean>;
      isWindowMaximized?: () => Promise<boolean>;
      closeWindow?: () => Promise<boolean>;
      onWindowStateChanged?: (callback: (isMaximized: boolean) => void) => () => void;
      getDisplays?: () => Promise<NativeDisplayTarget[]>;
      onDisplaysChanged?: (callback: (displays: NativeDisplayTarget[]) => void) => () => void;
      onDisplayChanged?: (callback: (info: any) => void) => () => void;
      openProjector?: (groupId: string, displayId?: string) => Promise<{ success: boolean; status: ProjectorStatus; displayId?: string; conflict?: string | null; error?: string }>;
      closeProjector?: (groupId: string) => Promise<{ success: boolean; status: ProjectorStatus }>;
      getProjectorStatus?: (groupId: string) => Promise<{ status: ProjectorStatus }>;
      getProjectorStatuses?: () => Promise<Record<string, ProjectorStatus>>;
      onProjectorStatusChanged?: (callback: (data: { groupId: string; status: ProjectorStatus }) => void) => () => void;
      saveSwsFile?: (defaultName: string, data: Uint8Array | number[]) => Promise<{ canceled: boolean; filePath?: string }>;
      openSwsFile?: () => Promise<{ canceled: boolean; filePath?: string; data?: ArrayBuffer | Uint8Array }>;
      readSwsFromPath?: (filePath: string) => Promise<{ canceled: boolean; filePath?: string; data?: ArrayBuffer | Uint8Array; error?: string }>;
      onFileAssociationOpened?: (callback: (filePath: string) => void) => () => void;
    };
  }
}


