import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Copy,
  Save,
  Play,
  Calendar,
  Layout,
  Type,
  Palette,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon,
  Sliders,
  FileText,
  Clock,
  Radio,
  Square,
  Circle,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Layers,
  BookOpen,
  Quote,
  Split,
  Tv,
  Monitor,
  GripVertical,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Wand2,
  Upload,
  RotateCw,
  Sun,
  ShieldAlert,
  Star,
  ArrowRight,
  QrCode,
  Timer,
  PlayCircle,
  Check,
  ChevronDown
} from 'lucide-react';
import { Asset, Slide, SlideObject, ShapeType, SlideTransitionType, AnimationType, AnimationCategory, ObjectAnimation } from '../types';
import { savePresentation } from '../db/presentations';
import { useStore } from '../store/useStore';
import { SlideCanvas } from './presentation-editor/SlideCanvas';
import { SlideThumbnailsDeck } from './presentation-editor/SlideThumbnailsDeck';
import { NotesAndTimelineDrawer } from './presentation-editor/NotesAndTimelineDrawer';
import { TemplateGalleryModal, TEMPLATE_DEFINITIONS } from './presentation-editor/TemplateGalleryModal';
import { ImagePickerModal } from './presentation-editor/ImagePickerModal';

const QUICK_SWATCHES = ['#FFFFFF', '#38BDF8', '#10B981', '#F59E0B', '#EF4444', '#A855F7', '#64748B', '#000000'];

function toHexColor(color?: string, fallback = '#ffffff'): string {
  if (!color) return fallback;
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return color;
  if (/^#[0-9A-Fa-f]{3}$/.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  const lower = color.toLowerCase();
  if (lower === 'white') return '#ffffff';
  if (lower === 'black') return '#000000';
  if (lower === 'transparent') return '#000000';
  return fallback;
}

interface PresentationEditorModalProps {
  presentation?: Asset | null;
  onClose: () => void;
  onSaved?: (asset: Asset) => void;
}

type RibbonTab = 'home' | 'insert' | 'design' | 'transitions' | 'animations' | 'view';

// Helper to ensure initial slides have editable canvas objects
function ensureObjectsOnSlide(slide: Slide): Slide {
  if (Array.isArray(slide.objects) && slide.objects.length > 0) {
    return slide;
  }

  const objects: SlideObject[] = [];

  if (slide.isTitleSlide) {
    // Title Object
    objects.push({
      id: `obj-${Date.now()}-title`,
      type: 'text',
      x: 160,
      y: 220,
      width: 1600,
      height: 220,
      text: slide.title || 'Presentation Title',
      style: {
        fontSize: slide.titleFontSize || 64,
        fontColor: slide.titleColor || '#FFFFFF',
        fontFamily: slide.titleFontFamily || 'Aptos, Calibri, sans-serif',
        fontWeight: 'bold',
        textAlign: slide.textAlign || 'center',
        alignVertical: 'middle',
      },
    });

    // Subtitle / Description Object
    if (slide.subtitle || slide.text) {
      objects.push({
        id: `obj-${Date.now()}-subtitle`,
        type: 'text',
        x: 200,
        y: 480,
        width: 1520,
        height: 280,
        text: slide.subtitle || slide.text || 'Subtitle / Description text',
        style: {
          fontSize: slide.fontSize || 32,
          fontColor: slide.fontColor || '#E2E8F0',
          fontFamily: slide.fontFamily || 'Aptos, Calibri, sans-serif',
          fontWeight: 'normal',
          textAlign: slide.textAlign || 'center',
          alignVertical: 'top',
        },
      });
    }
  } else {
    // Content Slide: Header Title
    if (slide.title) {
      objects.push({
        id: `obj-${Date.now()}-title`,
        type: 'text',
        x: 120,
        y: 80,
        width: 1680,
        height: 140,
        text: slide.title,
        style: {
          fontSize: slide.titleFontSize || 48,
          fontColor: slide.titleColor || '#FFFFFF',
          fontFamily: slide.titleFontFamily || 'Aptos, Calibri, sans-serif',
          fontWeight: 'bold',
          textAlign: slide.textAlign || 'left',
          alignVertical: 'middle',
        },
      });
    }

    // Body Bullets / Text
    const bodyText =
      slide.bullets && slide.bullets.length > 0
        ? slide.bullets.map((b) => `• ${b}`).join('\n\n')
        : slide.text || 'Click to add body content...';

    objects.push({
      id: `obj-${Date.now()}-body`,
      type: 'text',
      x: 120,
      y: 260,
      width: 1680,
      height: 720,
      text: bodyText,
      style: {
        fontSize: slide.fontSize || 32,
        fontColor: slide.fontColor || '#CBD5E1',
        fontFamily: slide.fontFamily || 'Aptos, Calibri, sans-serif',
        fontWeight: 'normal',
        textAlign: slide.textAlign || 'left',
        alignVertical: 'top',
      },
    });
  }

  // Preserve badges / elements if any
  if (slide.elements && slide.elements.length > 0) {
    slide.elements.forEach((elem, idx) => {
      if (elem.type === 'badge') {
        objects.push({
          id: `obj-${Date.now()}-badge-${idx}`,
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 120 + idx * 220,
          y: 980,
          width: 200,
          height: 60,
          text: elem.text || 'Badge',
          style: {
            backgroundColor: elem.backgroundColor || '#0284c7',
            fontColor: elem.fontColor || '#FFFFFF',
            fontSize: 20,
            borderRadius: 8,
          },
        });
      }
    });
  }

  return {
    ...slide,
    objects,
  };
}

export function PresentationEditorModal({
  presentation,
  onClose,
  onSaved,
}: PresentationEditorModalProps) {
  const { addScheduleItem, goLiveItem } = useStore();

  const [deckName, setDeckName] = useState(presentation?.name || 'New Presentation Deck');
  const [activeRibbonTab, setActiveRibbonTab] = useState<RibbonTab>('home');
  const [inspectorTab, setInspectorTab] = useState<'format' | 'animations' | 'transition' | 'theme'>('format');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [zoom, setZoom] = useState(0.55); // Default canvas scale to fit viewport neatly
  const [isSaving, setIsSaving] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showSafeMargins, setShowSafeMargins] = useState(false);
  const [imagePickerMode, setImagePickerMode] = useState<'object' | 'background' | null>(null);
  const [isTransitionPlaying, setIsTransitionPlaying] = useState(false);
  const [appliedAllTransitionFeedback, setAppliedAllTransitionFeedback] = useState(false);

  // Hidden Local Computer Image File Picker Ref
  const localImageInputRef = useRef<HTMLInputElement>(null);

  // Resizable & Collapsible Panels State
  const [leftWidth, setLeftWidth] = useState<number>(260); // Left thumbnail deck width
  const [rightWidth, setRightWidth] = useState<number>(300); // Right inspector width
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isDraggingLeftDivider, setIsDraggingLeftDivider] = useState(false);
  const [isDraggingRightDivider, setIsDraggingRightDivider] = useState(false);

  // Initialize Slides
  const [slides, setSlides] = useState<Slide[]>(() => {
    let rawSlides: Slide[] = [];
    if (presentation?.data?.slides && Array.isArray(presentation.data.slides) && presentation.data.slides.length > 0) {
      rawSlides = presentation.data.slides.map((s: any, idx: number) => ({
        id: s.id || `slide-${Date.now()}-${idx}`,
        title: s.title || '',
        subtitle: s.subtitle || '',
        text: s.text || '',
        bullets: Array.isArray(s.bullets) ? s.bullets : [],
        notes: s.notes || '',
        isTitleSlide: Boolean(s.isTitleSlide || (idx === 0 && (!s.bullets || s.bullets.length <= 1))),
        backgroundColor: s.backgroundColor || '#12141a',
        fontColor: s.fontColor || '#cbd5e1',
        titleColor: s.titleColor || '#FFFFFF',
        fontFamily: s.fontFamily || 'Aptos, Calibri, sans-serif',
        titleFontFamily: s.titleFontFamily || 'Aptos, Calibri, sans-serif',
        fontSize: s.fontSize || 22,
        titleFontSize: s.titleFontSize || 36,
        textAlign: s.textAlign || 'left',
        accentColor: s.accentColor || '#38bdf8',
        headerBarColor: s.headerBarColor || '#0284c7',
        backgroundUrl: s.backgroundUrl || '',
        transition: s.transition || { type: 'smooth-fade', durationMs: 500 },
        objects: s.objects || [],
      }));
    } else {
      // Default starter template
      rawSlides = [
        {
          id: `slide-${Date.now()}-0`,
          title: 'Sunday Service Presentation',
          subtitle: 'Worship • Prayer • Teaching',
          text: 'Welcome to worship service',
          bullets: [],
          notes: 'Welcome congregation and introduce sermon topic.',
          isTitleSlide: true,
          backgroundColor: '#12141a',
          fontColor: '#cbd5e1',
          titleColor: '#FFFFFF',
          fontFamily: 'Aptos, Calibri, sans-serif',
          titleFontFamily: 'Aptos, Calibri, sans-serif',
          fontSize: 24,
          titleFontSize: 56,
          textAlign: 'center',
          accentColor: '#38bdf8',
          headerBarColor: '#0284c7',
        },
        {
          id: `slide-${Date.now()}-1`,
          title: 'Key Message Focus',
          subtitle: '',
          text: 'Faith anchored in truth\nGrace renewed every morning\nCommunity built on love',
          bullets: ['Faith anchored in truth', 'Grace renewed every morning', 'Community built on love'],
          notes: 'Read key scriptures.',
          isTitleSlide: false,
          backgroundColor: '#12141a',
          fontColor: '#cbd5e1',
          titleColor: '#FFFFFF',
          fontFamily: 'Aptos, Calibri, sans-serif',
          titleFontFamily: 'Aptos, Calibri, sans-serif',
          fontSize: 22,
          titleFontSize: 36,
          textAlign: 'left',
          accentColor: '#38bdf8',
          headerBarColor: '#0284c7',
        },
      ];
    }
    return rawSlides.map(ensureObjectsOnSlide);
  });

  // History State for Undo / Redo
  const [history, setHistory] = useState<Slide[][]>([slides]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const updateSlidesWithHistory = (newSlides: Slide[]) => {
    setSlides(newSlides);
    const sliced = history.slice(0, historyIndex + 1);
    setHistory([...sliced, newSlides]);
    setHistoryIndex(sliced.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setSlides(history[prevIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setSlides(history[nextIdx]);
    }
  };

  // Create New Presentation Deck
  const handleNewDeck = () => {
    if (confirm('Create a new presentation deck? Unsaved changes will be cleared.')) {
      setDeckName('Untitled Presentation Deck');
      const starterTemplate = TEMPLATE_DEFINITIONS[0].slide;
      const initial = [ensureObjectsOnSlide({ ...starterTemplate, id: `slide-${Date.now()}-0` })];
      updateSlidesWithHistory(initial);
      setActiveSlideIndex(0);
      setSelectedObjectIds([]);
    }
  };

  // Select Layout from Template Gallery
  const handleSelectTemplate = (templateId: string, customSlide?: Slide) => {
    if (customSlide) {
      const newSlide = ensureObjectsOnSlide({
        ...customSlide,
        id: `slide-${Date.now()}-${slides.length}`,
      });
      const updated = [...slides, newSlide];
      updateSlidesWithHistory(updated);
      setActiveSlideIndex(updated.length - 1);
    } else {
      handleAddSlide(templateId);
    }
  };

  // Active Slide Reference
  const activeSlide = slides[activeSlideIndex] || slides[0];

  // Update current slide helper
  const handleUpdateActiveSlide = (patch: Partial<Slide>) => {
    const updated = slides.map((s, idx) => (idx === activeSlideIndex ? { ...s, ...patch } : s));
    updateSlidesWithHistory(updated);
  };

  // Update active slide objects helper
  const handleUpdateActiveSlideObjects = (objects: SlideObject[], pushHistory: boolean = true) => {
    const updated = slides.map((s, idx) => (idx === activeSlideIndex ? { ...s, objects } : s));
    if (pushHistory) {
      updateSlidesWithHistory(updated);
    } else {
      setSlides(updated);
    }
  };

  // Primary Object and Selected Objects (Enterprise fallback ensures controls work even when nothing is explicitly clicked)
  const primaryObject = activeSlide?.objects?.find((o) => selectedObjectIds.includes(o.id))
    || (activeSlide?.objects && activeSlide.objects.length > 0 ? activeSlide.objects[0] : undefined);
  const selectedObjects = selectedObjectIds.length > 0
    ? (activeSlide?.objects?.filter((o) => selectedObjectIds.includes(o.id)) || [])
    : (primaryObject ? [primaryObject] : []);

  const updateSelectedTransform = (transformPatch: Partial<SlideObject>) => {
    const objects = activeSlide?.objects || [];
    if (objects.length === 0) return;
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [objects[0].id];
    if (selectedObjectIds.length === 0) {
      setSelectedObjectIds([objects[0].id]);
    }
    const targetSet = new Set(targetIds);
    const updated = objects.map((obj) => {
      if (targetSet.has(obj.id)) {
        return { ...obj, ...transformPatch };
      }
      return obj;
    });
    handleUpdateActiveSlideObjects(updated);
  };

  const alignObjects = (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const objects = activeSlide?.objects || [];
    if (objects.length === 0) return;
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [objects[0].id];
    if (selectedObjectIds.length === 0) {
      setSelectedObjectIds([objects[0].id]);
    }
    const CANVAS_W = 1920;
    const CANVAS_H = 1080;
    const targetSet = new Set(targetIds);
    const updated = objects.map((obj) => {
      if (!targetSet.has(obj.id)) return obj;
      let newX = obj.x;
      let newY = obj.y;
      if (alignment === 'left') newX = 50;
      if (alignment === 'center') newX = Math.round(CANVAS_W / 2 - obj.width / 2);
      if (alignment === 'right') newX = CANVAS_W - obj.width - 50;
      if (alignment === 'top') newY = 50;
      if (alignment === 'middle') newY = Math.round(CANVAS_H / 2 - obj.height / 2);
      if (alignment === 'bottom') newY = CANVAS_H - obj.height - 50;
      return { ...obj, x: newX, y: newY };
    });
    handleUpdateActiveSlideObjects(updated);
  };

  const updateSelectedStyle = (updates: Partial<SlideObject['style']>) => {
    if (!activeSlide) return;
    const objects = activeSlide.objects || [];
    if (objects.length === 0) {
      const newObj: SlideObject = {
        id: `obj-${Date.now()}-text`,
        type: 'text',
        x: 200,
        y: 300,
        width: 1520,
        height: 200,
        text: 'New Text Block',
        style: {
          fontSize: 48,
          fontColor: '#FFFFFF',
          fontFamily: 'Aptos, Calibri, sans-serif',
          textAlign: 'center',
          ...updates,
        },
      };
      handleUpdateActiveSlideObjects([newObj]);
      setSelectedObjectIds([newObj.id]);
      return;
    }
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [objects[0].id];
    if (selectedObjectIds.length === 0) {
      setSelectedObjectIds([objects[0].id]);
    }
    const updated = objects.map((obj) => {
      if (targetIds.includes(obj.id)) {
        return { ...obj, style: { ...obj.style, ...updates } };
      }
      return obj;
    });
    handleUpdateActiveSlideObjects(updated);
  };

  const bringToFront = () => {
    if (!activeSlide || !activeSlide.objects || activeSlide.objects.length === 0) return;
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [activeSlide.objects[0].id];
    if (selectedObjectIds.length === 0) setSelectedObjectIds([activeSlide.objects[0].id]);
    const selectedSet = new Set(targetIds);
    const unselected = activeSlide.objects.filter((o) => !selectedSet.has(o.id));
    const selected = activeSlide.objects.filter((o) => selectedSet.has(o.id));
    handleUpdateActiveSlideObjects([...unselected, ...selected]);
  };

  const sendToBack = () => {
    if (!activeSlide || !activeSlide.objects || activeSlide.objects.length === 0) return;
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [activeSlide.objects[0].id];
    if (selectedObjectIds.length === 0) setSelectedObjectIds([activeSlide.objects[0].id]);
    const selectedSet = new Set(targetIds);
    const unselected = activeSlide.objects.filter((o) => !selectedSet.has(o.id));
    const selected = activeSlide.objects.filter((o) => selectedSet.has(o.id));
    handleUpdateActiveSlideObjects([...selected, ...unselected]);
  };

  const toggleLock = () => {
    if (!activeSlide || !activeSlide.objects || activeSlide.objects.length === 0) return;
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [activeSlide.objects[0].id];
    if (selectedObjectIds.length === 0) setSelectedObjectIds([activeSlide.objects[0].id]);
    const selectedObjectsList = activeSlide.objects.filter((o) => targetIds.includes(o.id));
    const isCurrentlyLocked = selectedObjectsList.some((o) => o.locked);
    const updated = activeSlide.objects.map((obj) => {
      if (targetIds.includes(obj.id)) {
        return { ...obj, locked: !isCurrentlyLocked };
      }
      return obj;
    });
    handleUpdateActiveSlideObjects(updated);
  };

  const deleteSelected = () => {
    if (!activeSlide || !activeSlide.objects || activeSlide.objects.length === 0) return;
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [activeSlide.objects[0].id];
    const targetSet = new Set(targetIds);
    handleUpdateActiveSlideObjects(activeSlide.objects.filter((o) => !targetSet.has(o.id)));
    setSelectedObjectIds([]);
  };

  const rotateSelected = () => {
    const objects = activeSlide?.objects || [];
    if (objects.length === 0) return;
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [objects[0].id];
    if (selectedObjectIds.length === 0) setSelectedObjectIds([objects[0].id]);
    const currentRot = primaryObject?.rotation || 0;
    const nextRot = (currentRot + 90) % 360;
    updateSelectedTransform({ rotation: nextRot });
  };

  const addAnimationToSelected = (type: AnimationType, category: AnimationCategory) => {
    if (!activeSlide || !activeSlide.objects || activeSlide.objects.length === 0) return;
    const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [activeSlide.objects[0].id];
    if (selectedObjectIds.length === 0) setSelectedObjectIds([activeSlide.objects[0].id]);
    const newAnim: ObjectAnimation = {
      id: `anim-${Date.now()}`,
      type,
      category,
      durationMs: 600,
      delayMs: 0,
      order: 1,
      trigger: 'onClick',
    };
    const updated = activeSlide.objects.map((obj) => {
      if (targetIds.includes(obj.id)) {
        const anims = obj.animations || [];
        return { ...obj, animations: [...anims, newAnim] };
      }
      return obj;
    });
    handleUpdateActiveSlideObjects(updated);
  };

  const handleApplyTransitionToAllSlides = () => {
    const currentTransition = activeSlide.transition || { type: 'smooth-fade', durationMs: 500 };
    const updated = slides.map((s) => ({
      ...s,
      transition: { ...currentTransition },
    }));
    updateSlidesWithHistory(updated);
    setAppliedAllTransitionFeedback(true);
    setTimeout(() => setAppliedAllTransitionFeedback(false), 2500);
  };

  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const handleBgFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handleUpdateActiveSlide({ backgroundUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  // Resizable Divider Event Handlers
  const handleLeftDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingLeftDivider(true);
  };

  const handleRightDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRightDivider(true);
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (isDraggingLeftDivider) {
      const newLeft = Math.max(180, Math.min(450, e.clientX));
      setLeftWidth(newLeft);
    } else if (isDraggingRightDivider) {
      const windowWidth = window.innerWidth;
      const newRight = Math.max(220, Math.min(500, windowWidth - e.clientX));
      setRightWidth(newRight);
    }
  };

  const handleContainerMouseUp = () => {
    setIsDraggingLeftDivider(false);
    setIsDraggingRightDivider(false);
  };

  const handleResetDividers = () => {
    setLeftWidth(260);
    setRightWidth(300);
  };

  // Insert Object Actions
  const insertTextObject = () => {
    const newObj: SlideObject = {
      id: `obj-${Date.now()}-text`,
      type: 'text',
      x: 300,
      y: 300,
      width: 800,
      height: 200,
      text: 'Double click to edit text',
      style: {
        fontSize: 40,
        fontColor: '#FFFFFF',
        fontFamily: 'Aptos, Calibri, sans-serif',
        textAlign: 'left',
      },
    };
    const currentObjs = activeSlide.objects || [];
    handleUpdateActiveSlideObjects([...currentObjs, newObj]);
    setSelectedObjectIds([newObj.id]);
  };

  const insertShapeObject = (shapeType: ShapeType = 'rounded-rectangle') => {
    const newObj: SlideObject = {
      id: `obj-${Date.now()}-shape`,
      type: 'shape',
      shapeType,
      x: 400,
      y: 350,
      width: 400,
      height: 200,
      text: 'Shape Label',
      style: {
        backgroundColor: '#0284c7',
        fontColor: '#FFFFFF',
        fontSize: 28,
        borderRadius: shapeType === 'rounded-rectangle' ? 16 : 0,
      },
    };
    const currentObjs = activeSlide.objects || [];
    handleUpdateActiveSlideObjects([...currentObjs, newObj]);
    setSelectedObjectIds([newObj.id]);
  };

  const insertImageObject = () => {
    setImagePickerMode('object');
  };

  const handleSelectImageFromPicker = (imageUrl: string, metadata?: { name?: string }) => {
    if (imagePickerMode === 'object') {
      const newObj: SlideObject = {
        id: `obj-${Date.now()}-img`,
        type: 'image',
        imageUrl,
        x: 360,
        y: 200,
        width: 800,
        height: 480,
        style: {
          borderRadius: 8,
          shadowEnabled: true,
          shadowBlur: 16,
          shadowOffsetY: 6,
        },
      };
      const currentObjs = activeSlide.objects || [];
      handleUpdateActiveSlideObjects([...currentObjs, newObj]);
      setSelectedObjectIds([newObj.id]);
    } else if (imagePickerMode === 'background') {
      handleUpdateActiveSlide({ backgroundUrl: imageUrl });
    }
    setImagePickerMode(null);
  };

  const handlePlayTransitionPreview = () => {
    setIsTransitionPlaying(true);
    setTimeout(() => {
      setIsTransitionPlaying(false);
    }, (activeSlide.transition?.durationMs || 500) + 300);
  };

  const handleLocalImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        const newObj: SlideObject = {
          id: `obj-${Date.now()}-img`,
          type: 'image',
          imageUrl: dataUrl,
          x: 360,
          y: 200,
          width: 800,
          height: 480,
          style: {
            borderRadius: 8,
            shadowEnabled: true,
          },
        };
        const currentObjs = activeSlide.objects || [];
        handleUpdateActiveSlideObjects([...currentObjs, newObj]);
        setSelectedObjectIds([newObj.id]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const insertLineObject = () => {
    const newObj: SlideObject = {
      id: `obj-${Date.now()}-line`,
      type: 'line',
      x: 200,
      y: 540,
      width: 1520,
      height: 10,
      style: {
        borderColor: '#38bdf8',
        borderWidth: 4,
      },
    };
    const currentObjs = activeSlide.objects || [];
    handleUpdateActiveSlideObjects([...currentObjs, newObj]);
    setSelectedObjectIds([newObj.id]);
  };

  // Enterprise Feature: Scripture Verse Block
  const insertScriptureVerseBlock = () => {
    const newObj: SlideObject = {
      id: `obj-${Date.now()}-scripture`,
      type: 'text',
      x: 240,
      y: 280,
      width: 1440,
      height: 480,
      text: '“For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.”\n\n— John 3:16 (KJV)',
      style: {
        fontSize: 46,
        fontColor: '#F8FAFC',
        fontFamily: 'Playfair Display, Georgia, serif',
        textAlign: 'center',
        fontWeight: 'bold',
        shadowEnabled: true,
        shadowColor: 'rgba(0,0,0,0.85)',
        shadowBlur: 14,
        shadowOffsetY: 4,
        lineSpacing: 1.4,
      },
    };
    const currentObjs = activeSlide.objects || [];
    handleUpdateActiveSlideObjects([...currentObjs, newObj]);
    setSelectedObjectIds([newObj.id]);
  };

  // Enterprise Feature: Lower Third Broadcast Overlay
  const insertLowerThirdOverlay = () => {
    const currentObjs = activeSlide.objects || [];
    const barObj: SlideObject = {
      id: `obj-${Date.now()}-bar`,
      type: 'shape',
      shapeType: 'rounded-rectangle',
      x: 120,
      y: 840,
      width: 1200,
      height: 140,
      text: '',
      style: {
        backgroundColor: 'rgba(15, 23, 42, 0.90)',
        borderColor: '#38BDF8',
        borderWidth: 3,
        borderRadius: 12,
      },
    };
    const textObj: SlideObject = {
      id: `obj-${Date.now()}-title`,
      type: 'text',
      x: 160,
      y: 855,
      width: 1120,
      height: 110,
      text: 'PASTOR DAVID MILLER\nSenior Pastor • "Walking in Faith"',
      style: {
        fontSize: 34,
        fontColor: '#FFFFFF',
        fontFamily: 'Aptos, Calibri, sans-serif',
        textAlign: 'left',
        fontWeight: 'bold',
        lineSpacing: 1.25,
      },
    };
    handleUpdateActiveSlideObjects([...currentObjs, barObj, textObj]);
    setSelectedObjectIds([textObj.id]);
  };

  // Enterprise Feature: Countdown Timer Widget Card
  const insertCountdownWidget = () => {
    const currentObjs = activeSlide.objects || [];
    const cardObj: SlideObject = {
      id: `obj-${Date.now()}-countdown-card`,
      type: 'shape',
      shapeType: 'rounded-rectangle',
      x: 660,
      y: 340,
      width: 600,
      height: 380,
      text: '',
      style: {
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: '#F59E0B',
        borderWidth: 3,
        borderRadius: 20,
        shadowEnabled: true,
        shadowColor: 'rgba(0,0,0,0.6)',
        shadowBlur: 20,
      },
    };
    const textObj: SlideObject = {
      id: `obj-${Date.now()}-clock-text`,
      type: 'text',
      x: 700,
      y: 375,
      width: 520,
      height: 310,
      text: 'SERVICE STARTS IN\n05:00\nWELCOME HOME',
      style: {
        fontSize: 40,
        fontColor: '#F59E0B',
        fontFamily: 'Aptos, Calibri, sans-serif',
        textAlign: 'center',
        fontWeight: 'bold',
        lineSpacing: 1.4,
      },
    };
    handleUpdateActiveSlideObjects([...currentObjs, cardObj, textObj]);
    setSelectedObjectIds([textObj.id]);
  };

  // Enterprise Feature: Giving / Connect QR Card
  const insertGivingQRCard = () => {
    const currentObjs = activeSlide.objects || [];
    const cardObj: SlideObject = {
      id: `obj-${Date.now()}-giving-card`,
      type: 'shape',
      shapeType: 'rounded-rectangle',
      x: 480,
      y: 260,
      width: 960,
      height: 540,
      text: '',
      style: {
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: '#10B981',
        borderWidth: 3,
        borderRadius: 16,
      },
    };
    const textObj: SlideObject = {
      id: `obj-${Date.now()}-giving-text`,
      type: 'text',
      x: 520,
      y: 300,
      width: 880,
      height: 460,
      text: 'TITHES & OFFERINGS\n\nScan QR Code or Visit:\nsimpleworship.church/give\n\n"God loves a cheerful giver" — 2 Cor 9:7',
      style: {
        fontSize: 38,
        fontColor: '#FFFFFF',
        fontFamily: 'Aptos, Calibri, sans-serif',
        textAlign: 'center',
        fontWeight: 'bold',
        lineSpacing: 1.35,
      },
    };
    handleUpdateActiveSlideObjects([...currentObjs, cardObj, textObj]);
    setSelectedObjectIds([textObj.id]);
  };

  // Enterprise Feature: Worship Lyric Block
  const insertWorshipLyricBlock = () => {
    const currentObjs = activeSlide.objects || [];
    const lyricObj: SlideObject = {
      id: `obj-${Date.now()}-lyric`,
      type: 'text',
      x: 160,
      y: 240,
      width: 1600,
      height: 600,
      text: 'What a beautiful Name it is\nWhat a beautiful Name it is\nThe Name of Jesus Christ my King\nWhat a beautiful Name it is',
      style: {
        fontSize: 54,
        fontColor: '#FFFFFF',
        fontFamily: 'Aptos, Calibri, sans-serif',
        textAlign: 'center',
        fontWeight: 'bold',
        lineSpacing: 1.45,
        shadowEnabled: true,
        shadowColor: 'rgba(0,0,0,0.9)',
        shadowBlur: 16,
        shadowOffsetY: 6,
      },
    };
    handleUpdateActiveSlideObjects([...currentObjs, lyricObj]);
    setSelectedObjectIds([lyricObj.id]);
  };

  // Duplicate selected slide objects
  const handleDuplicateSelectedObjects = () => {
    if (!activeSlide || selectedObjectIds.length === 0) return;
    const currentObjs = activeSlide.objects || [];
    const selectedSet = new Set(selectedObjectIds);
    const duplicated = currentObjs
      .filter((o) => selectedSet.has(o.id))
      .map((o) => ({
        ...o,
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        x: o.x + 30,
        y: o.y + 30,
      }));

    if (duplicated.length > 0) {
      handleUpdateActiveSlideObjects([...currentObjs, ...duplicated]);
      setSelectedObjectIds(duplicated.map((o) => o.id));
    }
  };

  // Add Slide Action
  const handleAddSlide = (layoutType: string) => {
    let newSlide: Slide = {
      id: `slide-${Date.now()}-${slides.length}`,
      title: layoutType === 'title' ? 'New Presentation Title' : layoutType === 'scripture-focus' ? 'Scripture Verse' : 'New Slide Title',
      subtitle: layoutType === 'title' ? 'Subtitle goes here' : '',
      text: '',
      bullets: layoutType === 'title-content' ? ['Point number one', 'Point number two', 'Point number three'] : [],
      notes: '',
      isTitleSlide: layoutType === 'title',
      backgroundColor: '#12141a',
      fontColor: '#cbd5e1',
      titleColor: '#FFFFFF',
      fontFamily: 'Aptos, Calibri, sans-serif',
      titleFontFamily: 'Aptos, Calibri, sans-serif',
      fontSize: 22,
      titleFontSize: layoutType === 'title' ? 56 : 36,
      textAlign: layoutType === 'title' ? 'center' : 'left',
      accentColor: '#38bdf8',
      headerBarColor: '#0284c7',
    };

    newSlide = ensureObjectsOnSlide(newSlide);
    const updated = [...slides, newSlide];
    updateSlidesWithHistory(updated);
    setActiveSlideIndex(updated.length - 1);
  };

  // Duplicate Slide
  const handleDuplicateSlide = (idx: number) => {
    const target = slides[idx];
    if (!target) return;

    const dup: Slide = {
      ...target,
      id: `slide-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: `${target.title} (Copy)`,
      objects: (target.objects || []).map((o) => ({
        ...o,
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      })),
    };

    const updated = [...slides.slice(0, idx + 1), dup, ...slides.slice(idx + 1)];
    updateSlidesWithHistory(updated);
    setActiveSlideIndex(idx + 1);
  };

  // Delete Slide
  const handleDeleteSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const updated = slides.filter((_, i) => i !== idx);
    updateSlidesWithHistory(updated);
    setActiveSlideIndex(Math.max(0, idx - 1));
  };

  // Move Slide Up / Down
  const handleMoveSlide = (idx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= slides.length) return;

    const updated = [...slides];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;

    updateSlidesWithHistory(updated);
    setActiveSlideIndex(targetIdx);
  };

  // Apply Theme Preset
  const handleApplyTheme = (themeName: string) => {
    let bg = '#12141a';
    let tc = '#FFFFFF';
    let bc = '#cbd5e1';
    let ac = '#38bdf8';

    if (themeName === 'Corporate Blue') {
      bg = '#0f172a';
      ac = '#60a5fa';
    } else if (themeName === 'Emerald Grace') {
      bg = '#064e3b';
      tc = '#ecfdf5';
      bc = '#a7f3d0';
      ac = '#34d399';
    } else if (themeName === 'Royal Purple') {
      bg = '#3b0764';
      ac = '#c084fc';
    } else if (themeName === 'Sunset Warmth') {
      bg = '#451a03';
      ac = '#fbbf24';
    } else if (themeName === 'Clean Light') {
      bg = '#f8fafc';
      tc = '#0f172a';
      bc = '#334155';
      ac = '#2563eb';
    }

    const updated = slides.map((s) => ({
      ...s,
      backgroundColor: bg,
      titleColor: tc,
      fontColor: bc,
      accentColor: ac,
    }));
    updateSlidesWithHistory(updated);
  };

  // Update Aspect Ratio for Presentation
  const handleUpdateAspectRatio = (ratioLabel: string) => {
    let ratio = 16 / 9;
    if (ratioLabel.includes('4:3')) ratio = 4 / 3;
    if (ratioLabel.includes('16:10')) ratio = 16 / 10;
    if (ratioLabel.includes('21:9')) ratio = 21 / 9;
    if (ratioLabel.includes('1:1')) ratio = 1;
    if (ratioLabel.includes('9:16')) ratio = 9 / 16;

    const updated = slides.map((s) => ({
      ...s,
      aspectRatio: ratio,
      aspectRatioLabel: ratioLabel,
    }));
    updateSlidesWithHistory(updated);
  };

  // Save Presentation
  const handleSave = async (): Promise<Asset | null> => {
    setIsSaving(true);
    try {
      const savedAsset = await savePresentation(
        deckName,
        slides as any,
        undefined,
        presentation?.id,
        presentation?.data?.fileBytes
      );
      onSaved?.(savedAsset);
      return savedAsset;
    } catch (err) {
      console.error('Failed to save presentation:', err);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Save & Add to Schedule
  const handleSaveAndAddToSchedule = async () => {
    const saved = await handleSave();
    if (saved) {
      addScheduleItem({
        id: `sched-${Date.now()}`,
        name: saved.name,
        type: 'presentation',
        contentId: saved.id,
        data: saved.data,
      });
      alert(`"${saved.name}" has been saved and added to the active schedule!`);
    }
  };

  // Save & Go Live
  const handleSaveAndGoLive = async () => {
    const saved = await handleSave();
    if (saved) {
      const liveItem = {
        id: `sched-${Date.now()}`,
        name: saved.name,
        type: 'presentation' as const,
        contentId: saved.id,
        data: saved.data,
      };

      // Add to schedule & Go Live
      addScheduleItem(liveItem);
      goLiveItem(liveItem.id, activeSlideIndex, undefined, liveItem);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col select-none overflow-hidden"
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
    >
      {/* TOP HEADER / TITLE BAR */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 text-slate-200">
        <div className="flex items-center gap-3">
          <button className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors" onClick={onClose} title="Close Editor">
            <X size={18} />
          </button>
          <div className="h-4 w-px bg-slate-800" />

          <button
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors border border-slate-700/60"
            onClick={() => setShowTemplateGallery(true)}
            title="Browse Layout & Template Gallery"
          >
            <Sparkles size={14} className="text-amber-400" />
            <span>Template Gallery</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          <input
            type="text"
            className="bg-transparent hover:bg-slate-800/60 focus:bg-slate-800 border border-transparent focus:border-sky-500 rounded px-2 py-1 font-bold text-sm text-slate-100 outline-none w-64 transition-colors"
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Presentation Name..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save size={14} className="text-sky-400" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          <button
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors"
            onClick={handleSaveAndAddToSchedule}
          >
            <Calendar size={14} className="text-amber-400" />
            <span>Add to Schedule</span>
          </button>

          <button
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-md flex items-center gap-1.5 shadow-lg shadow-rose-900/30 transition-all hover:scale-105"
            onClick={handleSaveAndGoLive}
          >
            <Radio size={14} className="animate-pulse" />
            <span>GO LIVE</span>
          </button>
        </div>
      </div>

      {/* RIBBON TOOLBAR */}
      <div className="bg-slate-950 border-b border-slate-800 flex flex-col shrink-0">
        {/* Ribbon Tabs */}
        <div className="flex items-center px-4 border-b border-slate-800/80 text-xs font-medium gap-1">
          {[
            { id: 'home', label: 'Home' },
            { id: 'insert', label: 'Insert Objects' },
            { id: 'design', label: 'Design & Themes' },
            { id: 'transitions', label: 'Transitions' },
            { id: 'animations', label: 'Animations' },
            { id: 'view', label: 'View & Panes' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`py-2 px-3 border-b-2 font-semibold transition-colors ${
                activeRibbonTab === tab.id ? 'border-sky-500 text-sky-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => {
                const tabId = tab.id as RibbonTab;
                setActiveRibbonTab(tabId);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Ribbon Tools Panel */}
        <div className="p-2 px-4 flex items-center justify-between text-xs overflow-x-auto custom-scrollbar">
          {activeRibbonTab === 'home' && (
            <div className="flex items-center gap-3">
              {/* ALWAYS VISIBLE: Transform (X, Y, W, H, Rotation) */}
              <div className="flex items-center gap-2 bg-slate-900/60 p-1 rounded-lg border border-slate-800 shrink-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">Transform</span>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-slate-500 font-medium">X</label>
                  <input
                    type="number"
                    className="w-13 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-100 font-mono text-[10px] focus:border-sky-500 outline-none"
                    value={primaryObject?.x ?? 0}
                    onChange={(e) => updateSelectedTransform({ x: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-slate-500 font-medium">Y</label>
                  <input
                    type="number"
                    className="w-13 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-100 font-mono text-[10px] focus:border-sky-500 outline-none"
                    value={primaryObject?.y ?? 0}
                    onChange={(e) => updateSelectedTransform({ y: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-slate-500 font-medium">W</label>
                  <input
                    type="number"
                    className="w-13 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-100 font-mono text-[10px] focus:border-sky-500 outline-none"
                    value={primaryObject?.width ?? 400}
                    onChange={(e) => updateSelectedTransform({ width: parseInt(e.target.value) || 30 })}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] text-slate-500 font-medium">H</label>
                  <input
                    type="number"
                    className="w-13 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-100 font-mono text-[10px] focus:border-sky-500 outline-none"
                    value={primaryObject?.height ?? 200}
                    onChange={(e) => updateSelectedTransform({ height: parseInt(e.target.value) || 20 })}
                  />
                </div>
                <button
                  type="button"
                  className="p-1 hover:bg-slate-800 rounded text-slate-300 transition-colors"
                  onClick={rotateSelected}
                  title="Rotate 90° Clockwise"
                >
                  <RotateCw size={13} className="text-sky-400" />
                </button>
              </div>

              {/* ALWAYS VISIBLE: Alignment Tools */}
              <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shrink-0">
                <button className="p-1.5 hover:bg-slate-800 rounded text-slate-300" onClick={() => alignObjects('left')} title="Align Left"><AlignLeft size={13} /></button>
                <button className="p-1.5 hover:bg-slate-800 rounded text-slate-300" onClick={() => alignObjects('center')} title="Align Center"><AlignCenter size={13} /></button>
                <button className="p-1.5 hover:bg-slate-800 rounded text-slate-300" onClick={() => alignObjects('right')} title="Align Right"><AlignRight size={13} /></button>
                <div className="h-4 w-px bg-slate-800 mx-0.5" />
                <button className="p-1.5 hover:bg-slate-800 rounded text-slate-300 text-[10px] font-semibold" onClick={() => alignObjects('top')} title="Align Top">Top</button>
                <button className="p-1.5 hover:bg-slate-800 rounded text-slate-300 text-[10px] font-semibold" onClick={() => alignObjects('middle')} title="Align Middle">Mid</button>
                <button className="p-1.5 hover:bg-slate-800 rounded text-slate-300 text-[10px] font-semibold" onClick={() => alignObjects('bottom')} title="Align Bottom">Btm</button>
              </div>

              {/* ALWAYS VISIBLE: Layering & Locking */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shrink-0">
                <button className="px-1.5 py-1 hover:bg-slate-800 rounded text-[10px] text-slate-300 flex items-center gap-1" onClick={bringToFront} title="Bring to Front"><ArrowUp size={12}/> Front</button>
                <button className="px-1.5 py-1 hover:bg-slate-800 rounded text-[10px] text-slate-300 flex items-center gap-1" onClick={sendToBack} title="Send to Back"><ArrowDown size={12}/> Back</button>
                <button className="p-1 hover:bg-slate-800 rounded text-slate-300" onClick={toggleLock} title="Lock / Unlock Object">
                  {selectedObjects.some((o) => o.locked) ? <Lock size={12} className="text-amber-400" /> : <Unlock size={12} />}
                </button>
                <button className="p-1 hover:bg-rose-900/50 rounded text-rose-400" onClick={deleteSelected} title="Delete Object">
                  <Trash2 size={12} />
                </button>
              </div>

              <div className="h-5 w-px bg-slate-800 shrink-0" />

              {/* ALWAYS VISIBLE: Typography Controls */}
              <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-800 shrink-0">
                <select
                  className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-100 text-[10px] outline-none focus:border-sky-500 w-28 truncate"
                  value={primaryObject?.style?.fontFamily || 'Aptos, Calibri, sans-serif'}
                  onChange={(e) => updateSelectedStyle({ fontFamily: e.target.value })}
                  title="Font Family"
                >
                  <option value='Aptos, Calibri, "Segoe UI", sans-serif'>Aptos</option>
                  <option value='Playfair Display, Georgia, serif'>Playfair Display</option>
                  <option value='Plus Jakarta Sans, sans-serif'>Plus Jakarta</option>
                  <option value='Inter, sans-serif'>Inter</option>
                  <option value='Roboto, sans-serif'>Roboto</option>
                  <option value='Georgia, serif'>Georgia</option>
                  <option value='Montserrat, sans-serif'>Montserrat</option>
                </select>
                
                <input
                  type="number"
                  className="w-12 bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-slate-100 font-mono text-[10px] outline-none"
                  value={primaryObject?.style?.fontSize || 40}
                  onChange={(e) => updateSelectedStyle({ fontSize: parseInt(e.target.value) || 24 })}
                  title="Font Size"
                />
                
                <div className="flex items-center gap-0.5 bg-slate-950 border border-slate-800 rounded px-1">
                  <button className={`p-1 rounded ${primaryObject?.style?.fontWeight === 'bold' ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'}`} onClick={() => updateSelectedStyle({ fontWeight: primaryObject?.style?.fontWeight === 'bold' ? 'normal' : 'bold' })} title="Bold"><Bold size={12} /></button>
                  <button className={`p-1 rounded ${primaryObject?.style?.fontStyle === 'italic' ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'}`} onClick={() => updateSelectedStyle({ fontStyle: primaryObject?.style?.fontStyle === 'italic' ? 'normal' : 'italic' })} title="Italic"><Italic size={12} /></button>
                  <button className={`p-1 rounded ${primaryObject?.style?.textDecoration === 'underline' ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'}`} onClick={() => updateSelectedStyle({ textDecoration: primaryObject?.style?.textDecoration === 'underline' ? 'none' : 'underline' })} title="Underline"><Underline size={12} /></button>
                  <button className={`p-1 rounded ${(primaryObject?.style as any)?.textTransform === 'uppercase' ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'}`} onClick={() => updateSelectedStyle({ textTransform: (primaryObject?.style as any)?.textTransform === 'uppercase' ? 'none' : 'uppercase' } as any)} title="Uppercase"><span className="text-[10px] font-bold">TT</span></button>
                  <button className={`p-1 rounded ${primaryObject?.style?.shadowEnabled ? 'bg-amber-900/50 text-amber-300' : 'hover:bg-slate-800 text-slate-400'}`} onClick={() => updateSelectedStyle({ shadowEnabled: !primaryObject?.style?.shadowEnabled, shadowColor: 'rgba(0,0,0,0.85)', shadowBlur: 14, shadowOffsetY: 4 })} title="Drop Shadow"><Sun size={12} /></button>
                </div>

                <div className="flex items-center gap-0.5 bg-slate-950 border border-slate-800 rounded px-1">
                  <button className={`p-1 rounded ${primaryObject?.style?.textAlign === 'left' ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'}`} onClick={() => updateSelectedStyle({ textAlign: 'left' })} title="Align Text Left"><AlignLeft size={12} /></button>
                  <button className={`p-1 rounded ${primaryObject?.style?.textAlign === 'center' ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'}`} onClick={() => updateSelectedStyle({ textAlign: 'center' })} title="Align Text Center"><AlignCenter size={12} /></button>
                  <button className={`p-1 rounded ${primaryObject?.style?.textAlign === 'right' ? 'bg-slate-700 text-white' : 'hover:bg-slate-800 text-slate-400'}`} onClick={() => updateSelectedStyle({ textAlign: 'right' })} title="Align Text Right"><AlignRight size={12} /></button>
                </div>
                
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5" title="Text Color">
                  <input
                    type="color"
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                    value={toHexColor(primaryObject?.style?.fontColor, '#FFFFFF')}
                    onChange={(e) => updateSelectedStyle({ fontColor: e.target.value })}
                  />
                  <div className="flex items-center gap-0.5 pr-0.5">
                    {['#FFFFFF', '#38BDF8', '#F59E0B', '#10B981', '#EF4444'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="w-2.5 h-2.5 rounded-full border border-slate-700 hover:scale-125 transition-transform"
                        style={{ backgroundColor: c }}
                        onClick={() => updateSelectedStyle({ fontColor: c })}
                        title={`Set text color to ${c}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* ALWAYS VISIBLE: Shape Fill & Border */}
              <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-slate-800 shrink-0">
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5" title="Fill Color">
                  <span className="text-[9px] text-slate-400 pl-1 uppercase font-semibold">Fill</span>
                  <input
                    type="color"
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                    value={toHexColor(primaryObject?.style?.backgroundColor, '#0284c7')}
                    onChange={(e) => updateSelectedStyle({ backgroundColor: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-0.5" title="Border Color">
                  <span className="text-[9px] text-slate-400 pl-1 uppercase font-semibold">Line</span>
                  <input
                    type="color"
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent"
                    value={toHexColor(primaryObject?.style?.borderColor, '#38bdf8')}
                    onChange={(e) => updateSelectedStyle({ borderColor: e.target.value })}
                  />
                </div>
                <input
                  type="number"
                  className="w-10 bg-slate-950 border border-slate-800 rounded px-1 py-1 text-slate-100 font-mono text-[10px] outline-none"
                  value={primaryObject?.style?.borderWidth || 0}
                  onChange={(e) => updateSelectedStyle({ borderWidth: parseInt(e.target.value) || 0 })}
                  title="Border Width"
                />
              </div>

              <div className="h-5 w-px bg-slate-800 shrink-0" />

              {/* Undo / Redo */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-300 disabled:opacity-40"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={15} />
                </button>
                <button
                  className="p-1.5 hover:bg-slate-800 rounded text-slate-300 disabled:opacity-40"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 size={15} />
                </button>
              </div>
            </div>
          )}

          {activeRibbonTab === 'insert' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-1">Basic</span>
                <button className="px-2.5 py-1.5 hover:bg-slate-800 rounded flex items-center gap-1.5 text-slate-200 font-medium" onClick={insertTextObject}>
                  <Type size={14} className="text-sky-400" />
                  <span>Text Box</span>
                </button>
                <button className="px-2.5 py-1.5 hover:bg-slate-800 rounded flex items-center gap-1.5 text-slate-200 font-medium" onClick={() => insertShapeObject('rounded-rectangle')}>
                  <Square size={14} className="text-amber-400" />
                  <span>Rectangle</span>
                </button>
                <button className="px-2.5 py-1.5 hover:bg-slate-800 rounded flex items-center gap-1.5 text-slate-200 font-medium" onClick={() => insertShapeObject('ellipse')}>
                  <Circle size={14} className="text-rose-400" />
                  <span>Circle</span>
                </button>
                <button className="px-2.5 py-1.5 hover:bg-slate-800 rounded flex items-center gap-1.5 text-slate-200 font-medium" onClick={() => insertShapeObject('diamond' as ShapeType)}>
                  <Star size={14} className="text-purple-400" />
                  <span>Diamond</span>
                </button>
                <button className="px-2.5 py-1.5 hover:bg-slate-800 rounded flex items-center gap-1.5 text-slate-200 font-medium" onClick={() => insertShapeObject('arrow-right' as ShapeType)}>
                  <ArrowRight size={14} className="text-cyan-400" />
                  <span>Arrow</span>
                </button>
                <button className="px-2.5 py-1.5 hover:bg-slate-800 rounded flex items-center gap-1.5 text-slate-200 font-medium" onClick={() => insertShapeObject('star' as ShapeType)}>
                  <Star size={14} className="text-amber-300" />
                  <span>Star</span>
                </button>
                <button className="px-2.5 py-1.5 hover:bg-slate-800 rounded flex items-center gap-1.5 text-slate-200 font-medium" onClick={insertImageObject}>
                  <ImageIcon size={14} className="text-emerald-400" />
                  <span>Image</span>
                </button>
                <button className="px-2.5 py-1.5 hover:bg-slate-800 rounded flex items-center gap-1.5 text-slate-200 font-medium" onClick={insertLineObject}>
                  <Layout size={14} className="text-indigo-400" />
                  <span>Divider Line</span>
                </button>
              </div>

              <div className="h-5 w-px bg-slate-800" />

              {/* ENTERPRISE PRESENTATION WIDGETS */}
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-sky-900/50">
                <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider px-1">Enterprise Blocks</span>
                <button
                  className="px-2.5 py-1.5 bg-sky-950/60 hover:bg-sky-900/60 border border-sky-700/60 hover:border-sky-500 rounded flex items-center gap-1.5 text-sky-200 font-semibold transition-colors"
                  onClick={insertScriptureVerseBlock}
                  title="Insert Formatted Scripture Verse Card"
                >
                  <BookOpen size={14} className="text-sky-400" />
                  <span>Scripture Verse</span>
                </button>
                <button
                  className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-sky-400 rounded flex items-center gap-1.5 text-slate-200 font-semibold transition-colors"
                  onClick={insertLowerThirdOverlay}
                  title="Insert Speaker Lower-Third Broadcast Overlay"
                >
                  <Tv size={14} className="text-indigo-400" />
                  <span>Lower Third Banner</span>
                </button>
                <button
                  className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-amber-400 rounded flex items-center gap-1.5 text-slate-200 font-semibold transition-colors"
                  onClick={insertCountdownWidget}
                  title="Insert 5-Minute Service Countdown Card"
                >
                  <Timer size={14} className="text-amber-400" />
                  <span>5-Min Countdown</span>
                </button>
                <button
                  className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-emerald-400 rounded flex items-center gap-1.5 text-slate-200 font-semibold transition-colors"
                  onClick={insertGivingQRCard}
                  title="Insert Tithes & Online Giving QR Card"
                >
                  <QrCode size={14} className="text-emerald-400" />
                  <span>Giving & QR Card</span>
                </button>
                <button
                  className="px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-purple-400 rounded flex items-center gap-1.5 text-slate-200 font-semibold transition-colors"
                  onClick={insertWorshipLyricBlock}
                  title="Insert 4-Line Worship Lyric Block"
                >
                  <Quote size={14} className="text-purple-400" />
                  <span>Worship Lyrics</span>
                </button>
              </div>
            </div>
          )}

          {activeRibbonTab === 'design' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Aspect Ratio:</span>
                <select
                  className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1 text-sky-400 font-semibold text-xs outline-none focus:border-sky-500 cursor-pointer"
                  value={activeSlide.aspectRatioLabel || '16:9 Widescreen'}
                  onChange={(e) => handleUpdateAspectRatio(e.target.value)}
                >
                  <option value="16:9 Widescreen">16:9 Widescreen</option>
                  <option value="4:3 Standard">4:3 Standard</option>
                  <option value="16:10 Widescreen">16:10 Widescreen</option>
                  <option value="21:9 Ultrawide">21:9 Ultrawide</option>
                  <option value="1:1 Square">1:1 Square</option>
                  <option value="9:16 Mobile / Vertical">9:16 Vertical</option>
                </select>
              </div>

              <div className="h-5 w-px bg-slate-800" />

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Background:</span>
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5">
                  <input
                    type="color"
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                    value={toHexColor(activeSlide.backgroundColor, '#12141a')}
                    onChange={(e) => handleUpdateActiveSlide({ backgroundColor: e.target.value, backgroundUrl: undefined })}
                  />
                </div>
                <button
                  type="button"
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-sky-300 font-medium rounded border border-slate-800 hover:border-sky-500/50 flex items-center gap-1.5 transition-colors text-[11px]"
                  onClick={() => setImagePickerMode('background')}
                  title="Choose from Curated Church Presets, Media Library, or Upload"
                >
                  <ImageIcon size={12} className="text-sky-400" />
                  <span>Choose Image...</span>
                </button>
                {activeSlide.backgroundUrl && (
                  <button
                    type="button"
                    className="px-2 py-1 bg-rose-950/50 hover:bg-rose-900/50 text-rose-300 font-medium rounded border border-rose-800/60 flex items-center gap-1 transition-colors text-[11px]"
                    onClick={() => handleUpdateActiveSlide({ backgroundUrl: undefined })}
                    title="Remove Slide Background Image"
                  >
                    <X size={11} />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <div className="h-5 w-px bg-slate-800" />

              {/* ENTERPRISE: Stage Background Overlay Dimmer */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Stage Dimmer:</span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
                  {[0, 0.25, 0.5, 0.75].map((dim) => (
                    <button
                      key={dim}
                      type="button"
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        (activeSlide.overlayDimmer || 0) === dim ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => handleUpdateActiveSlide({ overlayDimmer: dim })}
                    >
                      {Math.round(dim * 100)}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-5 w-px bg-slate-800" />

              {/* ENTERPRISE: Safe Margins Toggle */}
              <button
                type="button"
                className={`px-2.5 py-1 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  showSafeMargins ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
                onClick={() => setShowSafeMargins(!showSafeMargins)}
                title="Toggle SMPTE Broadcast Safe Margins (Title & Action Safe Guides)"
              >
                <ShieldAlert size={13} />
                <span>Safe Margins</span>
              </button>

              <div className="h-5 w-px bg-slate-800" />

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Themes:</span>
                {['Obsidian Modern', 'Corporate Blue', 'Emerald Grace', 'Royal Purple', 'Sunset Warmth', 'Clean Light'].map((name) => (
                  <button key={name} className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded text-slate-200 font-medium text-[11px]" onClick={() => handleApplyTheme(name)}>
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeRibbonTab === 'transitions' && (
            <div className="flex items-center gap-3">
              {/* Play Transition Preview */}
              <button
                type="button"
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isTransitionPlaying
                    ? 'bg-sky-500 text-white shadow-lg ring-2 ring-sky-300'
                    : 'bg-sky-950/70 hover:bg-sky-900/80 border border-sky-600/70 text-sky-200'
                }`}
                onClick={handlePlayTransitionPreview}
                title="Preview Current Slide Transition Effect on Canvas"
              >
                <Play size={13} className={isTransitionPlaying ? 'animate-spin text-white' : 'fill-sky-400 text-sky-400'} />
                <span>{isTransitionPlaying ? 'Playing...' : 'Play Preview'}</span>
              </button>

              <div className="h-5 w-px bg-slate-800" />

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Transition Effect:</span>
                <select
                  className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1 text-slate-100 text-xs outline-none focus:border-sky-500 font-medium cursor-pointer"
                  value={activeSlide.transition?.type || 'none'}
                  onChange={(e) =>
                    handleUpdateActiveSlide({
                      transition: {
                        type: e.target.value as SlideTransitionType,
                        durationMs: activeSlide.transition?.durationMs || 500,
                      },
                    })
                  }
                >
                  <option value="none">None (Instant Cut)</option>
                  <optgroup label="Subtle & Fades">
                    <option value="fade">Fade</option>
                    <option value="smooth-fade">Smooth Crossfade</option>
                    <option value="fade-through-black">Fade Through Black</option>
                    <option value="dissolve">Dissolve</option>
                  </optgroup>
                  <optgroup label="Push & Slide">
                    <option value="push-left">Push Left</option>
                    <option value="push-right">Push Right</option>
                    <option value="push-up">Push Up</option>
                    <option value="push-down">Push Down</option>
                  </optgroup>
                  <optgroup label="Wipe & Split">
                    <option value="wipe-left">Wipe Left</option>
                    <option value="wipe-right">Wipe Right</option>
                    <option value="wipe-up">Wipe Up</option>
                    <option value="wipe-down">Wipe Down</option>
                    <option value="split-horizontal">Split Horizontal</option>
                    <option value="split-vertical">Split Vertical</option>
                  </optgroup>
                  <optgroup label="3D & Cinematic">
                    <option value="zoom-in">Zoom In</option>
                    <option value="zoom-out">Zoom Out</option>
                    <option value="flip-left">Flip 3D Left</option>
                    <option value="flip-right">Flip 3D Right</option>
                    <option value="cube-left">Cube 3D Left</option>
                    <option value="cube-right">Cube 3D Right</option>
                    <option value="gallery">Gallery Stage</option>
                    <option value="morph">Morph / Shape</option>
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Speed:</span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
                  {[
                    { label: 'Fast', ms: 300 },
                    { label: 'Normal', ms: 500 },
                    { label: 'Smooth', ms: 800 },
                    { label: 'Slow', ms: 1200 },
                  ].map((speed) => (
                    <button
                      key={speed.ms}
                      type="button"
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        (activeSlide.transition?.durationMs || 500) === speed.ms
                          ? 'bg-sky-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() =>
                        handleUpdateActiveSlide({
                          transition: {
                            type: activeSlide.transition?.type || 'smooth-fade',
                            durationMs: speed.ms,
                          },
                        })
                      }
                    >
                      {speed.label}
                    </button>
                  ))}
                </div>
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  className="w-20 accent-sky-500 cursor-pointer"
                  value={activeSlide.transition?.durationMs || 500}
                  onChange={(e) =>
                    handleUpdateActiveSlide({
                      transition: {
                        type: activeSlide.transition?.type || 'fade',
                        durationMs: parseInt(e.target.value),
                      },
                    })
                  }
                />
                <span className="font-mono text-sky-400 text-xs w-12 text-right">{activeSlide.transition?.durationMs || 500}ms</span>
              </div>

              <div className="h-5 w-px bg-slate-800" />

              {/* ENTERPRISE: Auto-Advance Loop Timer */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider">Auto-Advance:</span>
                <select
                  className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-amber-300 font-semibold text-xs outline-none focus:border-amber-500 cursor-pointer"
                  value={activeSlide.autoAdvanceSeconds || 0}
                  onChange={(e) => handleUpdateActiveSlide({ autoAdvanceSeconds: parseInt(e.target.value) || undefined })}
                >
                  <option value={0}>Manual (Click / Key)</option>
                  <option value={3}>3s Loop</option>
                  <option value={5}>5s Loop</option>
                  <option value={8}>8s Loop</option>
                  <option value={10}>10s Loop</option>
                  <option value={15}>15s Loop</option>
                </select>
              </div>

              <div className="h-5 w-px bg-slate-800" />

              {/* Apply to All Slides */}
              <button
                type="button"
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1 ${
                  appliedAllTransitionFeedback
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-sky-500 text-slate-200'
                }`}
                onClick={handleApplyTransitionToAllSlides}
                title="Apply Current Transition to Every Slide in Deck"
              >
                {appliedAllTransitionFeedback && <Check size={12} />}
                <span>{appliedAllTransitionFeedback ? 'Applied to All Slides!' : 'Apply to All Slides'}</span>
              </button>
            </div>
          )}

          {activeRibbonTab === 'animations' && (
            <div className="flex items-center gap-3">
              {/* Target Indicator */}
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px]">
                <span className="text-slate-500 font-semibold uppercase text-[9px]">Target:</span>
                <span className="text-sky-300 font-semibold truncate max-w-[120px]">
                  {primaryObject ? (primaryObject.text?.slice(0, 15) || primaryObject.type) : 'None'}
                </span>
              </div>

              <div className="h-5 w-px bg-slate-800" />

              {/* ALWAYS VISIBLE ENTRANCE ANIMATIONS */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider block">Entrance:</span>
                <div className="flex gap-1">
                  {[
                    { type: 'fade-in', label: 'Fade In' },
                    { type: 'fly-in', label: 'Fly In' },
                    { type: 'zoom-in', label: 'Zoom In' },
                    { type: 'float-in', label: 'Float In' },
                    { type: 'wipe-in', label: 'Wipe In' },
                  ].map((anim) => (
                    <button
                      key={anim.type}
                      className="px-2 py-1 bg-slate-900 hover:bg-sky-600/20 border border-slate-800 hover:border-sky-500 rounded text-slate-200 transition-colors text-[11px] flex items-center gap-1 font-medium"
                      onClick={() => addAnimationToSelected(anim.type as AnimationType, 'entrance')}
                    >
                      <span>{anim.label}</span>
                      <Plus size={10} className="text-sky-400" />
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="h-5 w-px bg-slate-800" />

              {/* ALWAYS VISIBLE EMPHASIS ANIMATIONS */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Emphasis:</span>
                <div className="flex gap-1">
                  {[
                    { type: 'pulse', label: 'Pulse' },
                    { type: 'grow-shrink', label: 'Grow / Shrink' },
                    { type: 'spin', label: 'Spin' },
                    { type: 'flash', label: 'Flash' },
                  ].map((anim) => (
                    <button
                      key={anim.type}
                      className="px-2 py-1 bg-slate-900 hover:bg-amber-600/20 border border-slate-800 hover:border-amber-500 rounded text-slate-200 transition-colors text-[11px] flex items-center gap-1 font-medium"
                      onClick={() => addAnimationToSelected(anim.type as AnimationType, 'emphasis')}
                    >
                      <span>{anim.label}</span>
                      <Plus size={10} className="text-amber-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-5 w-px bg-slate-800" />

              {/* ALWAYS VISIBLE EXIT ANIMATIONS */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider block">Exit:</span>
                <div className="flex gap-1">
                  {[
                    { type: 'fade-out', label: 'Fade Out' },
                    { type: 'fly-out', label: 'Fly Out' },
                    { type: 'zoom-out', label: 'Zoom Out' },
                  ].map((anim) => (
                    <button
                      key={anim.type}
                      className="px-2 py-1 bg-slate-900 hover:bg-rose-600/20 border border-slate-800 hover:border-rose-500 rounded text-slate-200 transition-colors text-[11px] flex items-center gap-1 font-medium"
                      onClick={() => addAnimationToSelected(anim.type as AnimationType, 'exit')}
                    >
                      <span>{anim.label}</span>
                      <Plus size={10} className="text-rose-400" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Animation Pills */}
              {primaryObject?.animations && primaryObject.animations.length > 0 && (
                <>
                  <div className="h-5 w-px bg-slate-800" />
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mr-1">Active:</span>
                    {primaryObject.animations.map((anim) => (
                      <div key={anim.id} className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded pl-1.5 pr-0.5 py-0.5">
                        <span className="text-[10px] capitalize text-sky-300 font-semibold">{anim.type.replace('-', ' ')}</span>
                        <button
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                          onClick={() => {
                            const updatedAnims = primaryObject.animations!.filter((a) => a.id !== anim.id);
                            handleUpdateActiveSlideObjects((activeSlide?.objects || []).map((o) => (o.id === primaryObject.id ? { ...o, animations: updatedAnims } : o)));
                          }}
                          title="Remove animation"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeRibbonTab === 'view' && (
            <div className="flex items-center gap-3">
              <button
                className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 ${
                  !isLeftCollapsed ? 'bg-sky-600/20 border-sky-500 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
                onClick={() => setIsLeftCollapsed(!isLeftCollapsed)}
              >
                <Layout size={14} />
                <span>{isLeftCollapsed ? 'Show Slide Deck' : 'Hide Slide Deck'}</span>
              </button>

              <button
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-md text-xs font-semibold text-slate-200"
                onClick={handleResetDividers}
              >
                Reset Panel Layout
              </button>

              <button
                type="button"
                className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 ${
                  showSafeMargins ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
                onClick={() => setShowSafeMargins(!showSafeMargins)}
              >
                <ShieldAlert size={14} />
                <span>{showSafeMargins ? 'Hide Safe Margins' : 'Show Broadcast Safe Margins'}</span>
              </button>
            </div>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 shrink-0 ml-auto">
            <button className="p-1 hover:bg-slate-800 rounded text-slate-300" onClick={() => setZoom(Math.max(0.3, zoom - 0.05))} title="Zoom Out">
              <ZoomOut size={14} />
            </button>
            <span className="font-mono text-xs text-sky-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button className="p-1 hover:bg-slate-800 rounded text-slate-300" onClick={() => setZoom(Math.min(2.0, zoom + 0.05))} title="Zoom In">
              <ZoomIn size={14} />
            </button>
            <button className="px-2 py-0.5 hover:bg-slate-800 rounded text-[10px] text-slate-400 font-mono" onClick={() => setZoom(0.55)}>
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE LAYOUT WITH ENTERPRISE RESIZABLE EQUAL DIVIDERS */}
      <div className="flex-1 flex flex-row relative overflow-hidden bg-slate-950">
        {/* LEFT PANE: THUMBNAILS DECK */}
        {!isLeftCollapsed && (
          <div style={{ width: `${leftWidth}px` }} className="h-full shrink-0 overflow-hidden">
            <SlideThumbnailsDeck
              slides={slides}
              activeSlideIndex={activeSlideIndex}
              onSelectSlide={setActiveSlideIndex}
              aspectRatioLabel={activeSlide.aspectRatioLabel || '16:9 Widescreen'}
              onAddSlide={(type) => {
                if (type === 'gallery') {
                  setShowTemplateGallery(true);
                } else {
                  handleAddSlide(type);
                }
              }}
              onDuplicateSlide={handleDuplicateSlide}
              onDeleteSlide={handleDeleteSlide}
              onMoveSlide={handleMoveSlide}
            />
          </div>
        )}

        {/* ENTERPRISE RESIZABLE DIVIDER 1 (LEFT/CENTER) */}
        {!isLeftCollapsed && (
          <div
            className="w-2 bg-slate-950 hover:bg-sky-500 cursor-col-resize active:bg-sky-400 border-x border-slate-800/80 transition-colors flex items-center justify-center shrink-0 z-30 group"
            onMouseDown={handleLeftDividerMouseDown}
            onDoubleClick={handleResetDividers}
            title="Drag to resize panel • Double-click to reset equal balance"
          >
            <GripVertical size={12} className="text-slate-600 group-hover:text-white" />
          </div>
        )}

        {/* CENTER PANE: SLIDE CANVAS & BOTTOM DRAWER */}
        <div className="flex-1 h-full flex flex-col relative overflow-hidden bg-slate-950">
          <div className="flex-1 relative overflow-hidden">
            <SlideCanvas
              slide={activeSlide}
              selectedObjectIds={selectedObjectIds}
              onSelectObjects={setSelectedObjectIds}
              onUpdateObjects={handleUpdateActiveSlideObjects}
              zoom={zoom}
              showSafeMargins={showSafeMargins}
              onUndo={handleUndo}
              onRedo={handleRedo}
              isTransitionPlaying={isTransitionPlaying}
            />
          </div>

          <NotesAndTimelineDrawer
            slide={activeSlide}
            onUpdateNotes={(notes) => handleUpdateActiveSlide({ notes })}
            onUpdateObjects={handleUpdateActiveSlideObjects}
          />
        </div>
      </div>

      {/* Hidden Native Computer File Picker Input for Ribbon Image Asset Button */}
      <input
        type="file"
        ref={localImageInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleLocalImageSelected}
      />

      {/* TEMPLATE GALLERY MODAL */}
      {showTemplateGallery && (
        <TemplateGalleryModal
          onClose={() => setShowTemplateGallery(false)}
          onSelectTemplate={handleSelectTemplate}
        />
      )}

      {/* IMAGE PICKER MODAL (Upload, Media Library, Curated Church Wallpapers, URL) */}
      <ImagePickerModal
        isOpen={imagePickerMode !== null}
        onClose={() => setImagePickerMode(null)}
        onSelectImage={handleSelectImageFromPicker}
        title={imagePickerMode === 'background' ? 'Select Slide Background Image' : 'Insert Image Object'}
      />
    </div>
  );
}
