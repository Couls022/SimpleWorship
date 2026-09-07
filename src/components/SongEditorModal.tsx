import { withPortal } from './common/withPortal';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { 
  X, 
  Minus, 
  Square, 
  Copy,
  Type, 
  BookOpen, 
  Shapes, 
  Image as ImageIcon, 
  Sliders, 
  Sparkles, 
  Tv, 
  Plus, 
  Tag as TagIcon, 
  FolderOpen,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Maximize2,
  Layout,
  Layers,
  Palette,
  ZoomIn,
  ZoomOut,
  Scissors,
  Globe,
  Edit3,
  Move,
  RotateCcw,
  Check
} from 'lucide-react';
import { Song, SongSection, ThemeStyles, PresentationItem } from '../types';
import { useStore } from '../store/useStore';
import { ThemeEngine } from '../core/ThemeEngine';
import { SystemFontPicker } from './common/SystemFontPicker';

interface SongEditorModalProps {
  mode?: 'library' | 'schedule-item';
  song?: Song | null;
  scheduleItem?: PresentationItem | null;
  onClose: () => void;
  onSaveScheduleItem?: (updatedFields: Partial<PresentationItem>, updateMasterToo?: boolean) => void;
}


interface SortableSlideItemProps {
  slide: { label: string; text: string };
  idx: number;
  activeSlideIndex: number;
  setActiveSlideIndex: (idx: number) => void;
  id: string;
}

function SortableSlideItem({ slide, idx, activeSlideIndex, setActiveSlideIndex, id }: SortableSlideItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setActiveSlideIndex(idx)}
      className={`p-2.5 rounded cursor-pointer transition-all border ${
        activeSlideIndex === idx
          ? 'bg-[#293245] border-cyan-400 shadow-md ring-1 ring-cyan-400'
          : 'bg-[#141519] border-[#292c36] hover:bg-[#1e222b]'
      }`}
    >
      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
        <span className={`px-1.5 py-0.5 rounded ${
          (() => {
            const t = slide.label.toLowerCase();
            if (t.includes('chorus') || t.includes('koro') || t.includes('refrain')) return 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50';
            if (t.includes('bridge') || t.includes('tulay')) return 'bg-purple-900/50 text-purple-300 border border-purple-700/50';
            if (t.includes('pre-chorus')) return 'bg-amber-900/50 text-amber-300 border border-amber-700/50';
            if (t.includes('tag') || t.includes('ending') || t.includes('coda')) return 'bg-rose-900/50 text-rose-300 border border-rose-700/50';
            if (t.includes('verse') || t.includes('talatâ') || t.match(/^v\d+$/)) return 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50';
            return 'bg-[#293245] text-cyan-300 border border-cyan-700/50';
          })()
        }`}>{slide.label}</span>
        <span className="text-gray-500 text-[10px] font-mono">#{idx + 1}</span>
      </div>
      <p className="text-[11px] text-gray-200 line-clamp-3 font-serif leading-tight">
        {slide.text}
      </p>
    </div>
    
  );
}

function SongEditorModal({ 
  mode = 'library',
  song, 
  scheduleItem,
  onClose,
  onSaveScheduleItem
}: SongEditorModalProps) {
  const store = useStore();
  const { assetsList, songsList, themesList } = store;

  // Match master song if editing schedule item
  const matchedMasterSong = useMemo(() => {
    if (song) return song;
    if (scheduleItem?.contentId) {
      return songsList.find(s => s.id === scheduleItem.contentId);
    }
    if (scheduleItem?.name) {
      return songsList.find(s => s.title.toLowerCase() === scheduleItem.name.toLowerCase());
    }
    return null;
  }, [song, scheduleItem, songsList]);

  // Content type (Song vs Scripture vs Presentation vs Announcement)
  const contentType = scheduleItem?.type || (song ? 'song' : 'song');

  // Header & Title
  const [title, setTitle] = useState(() => {
    if (scheduleItem) return scheduleItem.name;
    if (song) return song.title;
    return 'New Presentation Item';
  });

  const [author, setAuthor] = useState(() => {
    if (song) return song.author || '';
    if (matchedMasterSong) return matchedMasterSong.author || '';
    return '';
  });

  const [copyright, setCopyright] = useState(() => {
    if (song) return song.copyright || '';
    if (matchedMasterSong) return matchedMasterSong.copyright || '';
    return '';
  });

  const [ccliNumber, setCCLINumber] = useState(() => {
    if (song) return song.ccliNumber || song.ccli || '';
    if (matchedMasterSong) return matchedMasterSong.ccliNumber || matchedMasterSong.ccli || '';
    return '';
  });

  const [musicalKey, setMusicalKey] = useState(() => {
    if (song) return song.key || 'G';
    if (matchedMasterSong) return matchedMasterSong.key || 'G';
    return 'G';
  });

  const [category, setCategory] = useState<'Hymns' | 'Special Number' | 'Scripture' | 'Presentation'>(() => {
    if (contentType === 'bible') return 'Scripture';
    if (contentType === 'presentation' || contentType === 'announcement') return 'Presentation';
    const songCat = song?.category || matchedMasterSong?.category;
    if (songCat) {
      const lower = songCat.toLowerCase();
      if (lower === 'special number' || lower === 'special') return 'Special Number';
    }
    return 'Hymns';
  });

  // Active Left Sidebar Tab ('Words' | 'Slides')
  const [activeLeftTab, setActiveLeftTab] = useState<'Words' | 'Slides'>('Words');
  const [showMetadataAccordion, setShowMetadataAccordion] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Active Ribbon Tool ('format' | 'template' | 'media' | 'animate' | null)
  const [activeRibbonTool, setActiveRibbonTool] = useState<string | null>('format');

  // Text content initialization with intelligent fallback
  const [rawLyrics, setRawLyrics] = useState<string>(() => {
    if (scheduleItem?.data?.sections && scheduleItem.data.sections.length > 0) {
      return scheduleItem.data.sections.map((s: any) => `[${s.name}]\n${s.text}`).join('\n\n');
    }
    if (scheduleItem?.data?.lyrics) return scheduleItem.data.lyrics;
    if (scheduleItem?.data?.text) return scheduleItem.data.text;
    if (song?.lyrics) return song.lyrics;
    if (song?.sections && song.sections.length > 0) {
      return song.sections.map(s => `[${s.name}]\n${s.text}`).join('\n\n');
    }
    if (matchedMasterSong?.sections && matchedMasterSong.sections.length > 0) {
      return matchedMasterSong.sections.map(s => `[${s.name}]\n${s.text}`).join('\n\n');
    }
    if (matchedMasterSong?.lyrics) return matchedMasterSong.lyrics;
    
    if (contentType === 'bible') {
      return `[John 3:16]\nFor God so loved the world that he gave his only begotten Son, that whoever believes in him shall not perish but have eternal life.\n\n[John 3:17]\nFor God sent not his Son into the world to condemn the world; but that the world through him might be saved.`;
    }

    return `[Verse 1]\nAmazing grace how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind but now I see\n\n[Chorus 1]\nTwas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed\n\n[Verse 2]\nThrough many dangers toils and snares\nI have already come\nTis grace hath brought me safe thus far\nAnd grace will lead home`;
  });

  // Formatting & Theme overrides
  const initialTheme = scheduleItem?.themeOverride || song?.themeOverride || matchedMasterSong?.themeOverride;
  const [fontFamily, setFontFamily] = useState<string | undefined>(initialTheme?.fontFamily);
  const [fontSize, setFontSize] = useState<number | undefined>(initialTheme?.fontSize);
  const [fontColor, setFontColor] = useState<string | undefined>(initialTheme?.fontColor);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify' | undefined>(initialTheme?.textAlign);
  const [alignVertical, setAlignVertical] = useState<'top' | 'middle' | 'bottom' | undefined>(initialTheme?.alignVertical);
  const [boxStyle, setBoxStyle] = useState<'none' | 'glass' | 'solid' | 'light-glass' | 'border' | undefined>(initialTheme?.boxStyle);
  const [widthPercent, setWidthPercent] = useState<number | undefined>(initialTheme?.widthPercent);
  const [positionX, setPositionX] = useState<number | undefined>(initialTheme?.positionX);
  const [positionY, setPositionY] = useState<number | undefined>(initialTheme?.positionY);
  const [layoutPreset, setLayoutPreset] = useState<'center' | 'lower-third' | 'glass-card' | 'top-header' | 'split-two-column' | 'editorial' | 'border' | undefined>(initialTheme?.layoutPreset);
  
  const [hasOutline, setHasOutline] = useState<boolean | undefined>(initialTheme?.textOutline);
  const [outlineColor, setOutlineColor] = useState<string | undefined>(initialTheme?.outlineColor);
  const [hasShadow, setHasShadow] = useState<boolean | undefined>(initialTheme?.textShadow);
  const [shadowColor, setShadowColor] = useState<string | undefined>(initialTheme?.shadowColor);
  const [lineHeight, setLineHeight] = useState<number | undefined>(initialTheme?.lineHeight);
  const [textTransform, setTextTransform] = useState<'none' | 'uppercase' | 'lowercase' | 'capitalize' | undefined>(initialTheme?.textTransform);

  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3'>('16:9');
  const [transitionType, setTransitionType] = useState('Blend');

  // Active element selection on canvas ('text' | 'header' | 'card')
  const [selectedCanvasElement, setSelectedCanvasElement] = useState<'text' | 'header' | 'card'>('card');
  const [isCanvasEditing, setIsCanvasEditing] = useState(false);

  // Drag and Resize State
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    startXPercent: number;
    startYPercent: number;
    startWidth: number;
  }>({ mouseX: 0, mouseY: 0, startXPercent: 50, startYPercent: 50, startWidth: 88 });

  const handleMouseDownDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (isCanvasEditing) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setIsDragging(true);
    setSelectedCanvasElement('card');

    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startXPercent: positionX ?? 50,
      startYPercent: positionY ?? 50,
      startWidth: widthPercent || 88,
    };
  };

  const handleMouseDownResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setIsResizing(true);
    setSelectedCanvasElement('card');

    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      startXPercent: positionX ?? 50,
      startYPercent: positionY ?? 50,
      startWidth: widthPercent || 88,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!canvasViewportRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const rect = canvasViewportRef.current.getBoundingClientRect();

      if (isDragging) {
        const deltaXPx = clientX - dragStartRef.current.mouseX;
        const deltaYPx = clientY - dragStartRef.current.mouseY;

        const deltaXPercent = (deltaXPx / rect.width) * 100;
        const deltaYPercent = (deltaYPx / rect.height) * 100;

        const newX = Math.min(90, Math.max(10, dragStartRef.current.startXPercent + deltaXPercent));
        const newY = Math.min(90, Math.max(10, dragStartRef.current.startYPercent + deltaYPercent));

        setPositionX(Math.round(newX));
        setPositionY(Math.round(newY));
      } else if (isResizing) {
        const deltaXPx = clientX - dragStartRef.current.mouseX;
        const deltaXPercent = (deltaXPx / rect.width) * 100;

        const newWidth = Math.min(100, Math.max(25, dragStartRef.current.startWidth + deltaXPercent * 2));
        setWidthPercent(Math.round(newWidth));
      }
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
      if (isResizing) setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return (
    ) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, isResizing]);

  const defaultTypeBg = themesList?.find(t => t.type === (contentType === 'bible' ? 'bible' : 'song'))?.styles?.backgroundImageUrl;

  // Background Media selection
  const [backgroundUrl, setBackgroundUrl] = useState<string>(
    scheduleItem?.customBackgroundUrl || 
    song?.defaultBackgroundUrl || 
    matchedMasterSong?.defaultBackgroundUrl || 
    defaultTypeBg ||
    assetsList[0]?.url ||
    ''
    
  );

  // Selected Slide Index
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Canvas Zoom control
  const [zoomPercent, setZoomPercent] = useState<number>(35);

  // Scope selection
  const [applyToSchedule, setApplyToSchedule] = useState(true);
  const [updateMasterToo, setUpdateMasterToo] = useState(false);

  // Smart Slide Parser: parses raw lyrics, scriptures, or presentations into distinct structured slides
  const parsedSlides = useMemo(() => {
    const rawText = rawLyrics.trim();
    if (!rawText) return [{ label: 'Slide 1', text: 'Enter presentation text or scripture...' }];

    const slides: { label: string; text: string }[] = [];
    
    // Normalize lines: Convert implicit text-based tags like "Verse 1:" or "Chorus:" on their own line into bracketed tags
    const normalizedLines = rawText.split('\n').map(line => {
      const trimmed = line.trim();
      // Match something like "Verse 1:", "Chorus", "Refrain:" when it's the whole line
      const implicitTagMatch = trimmed.match(/^(Verse(?:\s+\d+)?|Chorus(?:\s+\d+)?|Refrain|Bridge|Pre-Chorus|Tag|Ending|Talatâ(?:\s+\d+)?|Koro|Tulay):?$/i);
      if (implicitTagMatch && !trimmed.startsWith('[')) {
        return `[${implicitTagMatch[1]}]`;
      }
      return line;
    });
    const normalizedText = normalizedLines.join('\n');

    // Split by explicit tags [Verse 1], [Chorus], [John 3:16], or slide breaks --- / ===
    const sections = normalizedText.split(/(?=\[(?:.*?)\]|\n---|\n===)/g);

    for (let sec of sections) {
      sec = sec.trim();
      if (!sec) continue;

      if (sec.startsWith('---') || sec.startsWith('===')) {
        sec = sec.replace(/^---+|^===+/, '').trim();
      }

      const tagMatch = sec.match(/^\[(.*?)\]\n?([\s\S]*)$/);
      if (tagMatch) {
        const label = tagMatch[1].trim();
        const content = tagMatch[2].trim();
        
        // Check if content itself has double line breaks or verse splits
        const subParts = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        if (subParts.length > 1) {
          subParts.forEach((part, idx) => {
            slides.push({
              label: subParts.length > 1 ? `${label} (${idx + 1})` : label,
              text: part.trim()
            });
          });
        } else {
          slides.push({
            label: label || `Slide ${slides.length + 1}`,
            text: content || 'Enter text here...'
          });
        }
      } else {
        // Un-tagged text: split by double newlines or verse prefixes
        const blocks = sec.split(/\n\s*\n/).filter(b => b.trim().length > 0);
        blocks.forEach((block, idx) => {
          // Check if block starts with implicit tags at the beginning of a paragraph
          const versePrefixMatch = block.match(/^(?:Verse(?:\s+\d+)?|Chorus(?:\s+\d+)?|Refrain|Bridge|Pre-Chorus|Tag|Ending|Talatâ(?:\s+\d+)?|Koro|Tulay|\d+\.|\d+:?\d*|[A-Z][a-z]+\s*\d+:\d+):?\s*/i);
          let label = `${contentType === 'bible' ? 'Verse' : 'Slide'} ${slides.length + 1}`;
          let text = block.trim();

          if (versePrefixMatch) {
            label = versePrefixMatch[0].replace(/:$/, '').trim();
            text = block.substring(versePrefixMatch[0].length).trim();
          }

          slides.push({ label, text });
        });
      }
    }

    return slides.length > 0 ? slides : [{ label: 'Slide 1', text: rawLyrics }];
  }, [rawLyrics, contentType]);

  // Keep activeSlideIndex bounded
  useEffect(() => {
    if (activeSlideIndex >= parsedSlides.length) {
      setActiveSlideIndex(Math.max(0, parsedSlides.length - 1));
    }
  }, [parsedSlides.length, activeSlideIndex]);

  // Quick tag insertion helper (International & Tagalog presets)
  const handleInsertTag = (tag: string) => {
    setRawLyrics((prev) => {
      const cleanPrev = prev.trimEnd();
      return `${cleanPrev}\n\n[${tag}]\n`;
    });
  };

  // Auto-split long scripture/song block into clean 2-3 line slides
  const handleAutoSplitPassage = () => {
    const activeSlide = parsedSlides[activeSlideIndex];
    if (!activeSlide) return;

    const lines = activeSlide.text.split('\n').filter(l => l.trim().length > 0);
    if (lines.length <= 3) {
      alert('This slide is already short and optimal for presentation!');
      return;
    }

    const chunk1 = lines.slice(0, Math.ceil(lines.length / 2)).join('\n');
    const chunk2 = lines.slice(Math.ceil(lines.length / 2)).join('\n');

    const newLyrics = rawLyrics.replace(
      activeSlide.text,
      `${chunk1}\n\n[${activeSlide.label} Part 2]\n${chunk2}`
      
  );

    setRawLyrics(newLyrics);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: 'Passage auto-split into balanced slides!' 
      })
      
  );
  };

  // Apply layout preset shortcuts
  const handleApplyLayoutPreset = (preset: 'center' | 'lower-third' | 'glass-card' | 'top-header' | 'split-two-column' | 'editorial' | 'border') => {
    setLayoutPreset(preset);
    setPositionX(undefined);
    setPositionY(undefined);
    if (preset === 'center') {
      setAlignVertical('middle');
      setTextAlign('center');
      setBoxStyle('none');
      setWidthPercent(88);
    } else if (preset === 'lower-third') {
      setAlignVertical('bottom');
      setTextAlign('center');
      setBoxStyle('glass');
      setWidthPercent(100);
      setFontSize(36);
    } else if (preset === 'glass-card') {
      setAlignVertical('middle');
      setTextAlign('center');
      setBoxStyle('glass');
      setWidthPercent(80);
    } else if (preset === 'top-header') {
      setAlignVertical('top');
      setTextAlign('left');
      setBoxStyle('solid');
      setWidthPercent(90);
    } else if (preset === 'border') {
      setAlignVertical('middle');
      setTextAlign('center');
      setBoxStyle('border');
      setWidthPercent(85);
    }
  };

  // Save changes
  const handleSaveAndApply = async (andClose: boolean) => {
    if (!title.trim()) {
      alert('Please enter a title.');
      return;
    }

    const sections: SongSection[] = parsedSlides.map((s, idx) => ({
      id: `sec-${idx}-${Date.now()}`,
      name: s.label,
      text: s.text
    }));

        const rawThemeOverride: ThemeStyles = {
      fontFamily,
      fontSize,
      fontColor,
      textAlign,
      alignVertical,
      boxStyle,
      widthPercent,
      positionX,
      positionY,
      layoutPreset,
      textOutline: hasOutline,
      outlineColor,
      textShadow: hasShadow,
      shadowColor,
      lineHeight,
      textTransform,
      backgroundImageUrl: backgroundUrl
    };

    const themeOverride = Object.fromEntries(
      Object.entries(rawThemeOverride).filter(([_, v]) => v !== undefined)
    ) as ThemeStyles;

    // Mode 1: SCHEDULE ITEM EDIT
    if (mode === 'schedule-item' && scheduleItem) {
      const updatedFields: Partial<PresentationItem> = {
        name: title.trim(),
        customBackgroundUrl: backgroundUrl,
        themeOverride,
        data: {
          ...scheduleItem.data,
          title: title.trim(),
          sections,
          lyrics: rawLyrics.trim(),
          text: rawLyrics.trim()
        }
      };

      if (onSaveScheduleItem) {
        onSaveScheduleItem(updatedFields, updateMasterToo);
      } else {
        store.updateScheduleItem(scheduleItem.id, updatedFields);
      }

      if (updateMasterToo && matchedMasterSong) {
        const updatedMaster: Song = {
          ...matchedMasterSong,
          title: title.trim(),
          author: author.trim(),
          copyright: copyright.trim(),
          ccli: ccliNumber.trim(),
          ccliNumber: ccliNumber.trim(),
          key: musicalKey.trim(),
          category: category.trim(),
          lyrics: rawLyrics.trim(),
          sections,
          defaultBackgroundUrl: backgroundUrl,
          themeOverride
        };
        await store.addSong(updatedMaster);
      }

      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Schedule item "${title.trim()}" updated successfully!` 
        })
        
  );

      if (andClose) onClose();
      return;
    }

    // Mode 2: LIBRARY SONG / ITEM EDIT
    const updatedSong: Song = {
      id: song?.id || `song-${Date.now()}`,
      title: title.trim(),
      author: author.trim(),
      copyright: copyright.trim(),
      ccli: ccliNumber.trim(),
      ccliNumber: ccliNumber.trim(),
      key: musicalKey.trim(),
      category: category.trim(),
      lyrics: rawLyrics.trim(),
      sections,
      defaultBackgroundUrl: backgroundUrl,
      themeOverride
    };

    await store.addSong(updatedSong);

    if (applyToSchedule && store.activeSchedule) {
      const currentSched = store.activeSchedule;
      const updatedItems = currentSched.items.map(item => {
        if (item.type === 'song' && (item.contentId === updatedSong.id || item.name === updatedSong.title)) {
          return {
            ...item,
            name: updatedSong.title,
            customBackgroundUrl: backgroundUrl,
            themeOverride
          };
        }
        return item;
      });
      store.setActiveSchedule({
        ...currentSched,
        items: updatedItems
      });
    }

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Saved "${updatedSong.title}" to library!` 
      })
      
  );

    if (andClose) {
      onClose();
    }
  };

    const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
    
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = parsedSlides.findIndex((_, i) => `slide-${i}` === active.id);
      const newIndex = parsedSlides.findIndex((_, i) => `slide-${i}` === over.id);
      
      const newSlides = arrayMove(parsedSlides, oldIndex, newIndex);
      
      const newLyrics = newSlides.map(s => `[${s.label}]\n${s.text}`).join('\n\n');
      setRawLyrics(newLyrics);
      
      if (activeSlideIndex === oldIndex) {
         setActiveSlideIndex(newIndex);
      } else if (activeSlideIndex > oldIndex && activeSlideIndex <= newIndex) {
         setActiveSlideIndex(activeSlideIndex - 1);
      } else if (activeSlideIndex < oldIndex && activeSlideIndex >= newIndex) {
         setActiveSlideIndex(activeSlideIndex + 1);
      }
    }
  };

  const activeSlide = parsedSlides[activeSlideIndex] || parsedSlides[0];

  // Active theme styles object for preview canvas
    const itemContentType = mode === 'library' ? 'song' : (scheduleItem?.type || 'song');
  const systemFontOverride = ThemeEngine.getSystemFontForContent(store.systemOptions, itemContentType);
  const typeTheme = store.themesList?.find(t => t.type === itemContentType || (itemContentType === 'song' && t.id === 'theme-song'));
  const baseThemeStyles = ThemeEngine.resolveStyles(
    store.themesList?.find(t => t.type === 'global')?.styles || ThemeEngine.getDefaultGlobalTheme(),
    undefined,
    typeTheme?.styles,
    systemFontOverride,
    initialTheme
    
  );
  const previewThemeStyles: ThemeStyles = ThemeEngine.resolveStyles(
    baseThemeStyles,
    undefined, undefined, undefined, undefined,
    {
      fontFamily,
      fontSize,
      fontColor,
      textAlign,
      alignVertical,
      boxStyle,
      widthPercent,
      positionX,
      positionY,
      layoutPreset,
      textOutline: hasOutline,
      outlineColor,
      textShadow: hasShadow,
      shadowColor,
      lineHeight,
      textTransform
    }
    
  );

  if (isMinimized) {
    return (
    
      <div className="fixed bottom-4 right-4 z-50 bg-[#1f2229] border border-cyan-500/50 shadow-2xl rounded-lg px-4 py-2 flex items-center gap-3 text-gray-200 animate-in slide-in-from-bottom-5">
        <span className="text-xs font-semibold text-cyan-400">Editor Minimized:</span>
        <span className="text-xs text-gray-300 font-medium truncate max-w-[200px]">{title || 'Untitled'}</span>
        <button
          onClick={() => setIsMinimized(false)}
          className="px-2.5 py-1 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition-colors"
        >
          Restore
        </button>
        <button
          onClick={onClose}
          className="p-1 hover:bg-rose-600 rounded text-gray-400 hover:text-white transition-colors"
          title="Close Editor"
        >
          <X size={14} />
        </button>
      </div>
      
  );
  }

  return (
    
    <div className={`fixed inset-0 z-[99999] bg-black/75 flex items-center justify-center select-none animate-in fade-in duration-150 ${isMaximized ? 'p-0' : 'p-2'}`}>
      <div className={`bg-[#1f2229] border border-[#363a47] shadow-2xl flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-150 ${
        isMaximized ? 'w-full h-full rounded-none' : 'w-full max-w-7xl h-[94vh] rounded-md'
      }`}>
        
        {/* 1. Header Title Bar */}
        <div className="h-8 bg-[#292d37] border-b border-[#181a20] px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-bold text-xs">SimpleWorship</span>
            <span className="text-gray-400 text-xs">-</span>
            <span className="font-semibold text-xs text-gray-100 truncate max-w-lg">
              {mode === 'schedule-item' 
                ? `Universal Slide & Template Editor - [${title || 'Untitled'}] (Schedule Item)`
                : `Universal Song & Template Editor - [${title || 'Untitled'}] (Library)`}
            </span>
          </div>
          <div className="flex items-center h-full -mr-3">
            <button 
              id="btn-song-editor-minimize"
              onClick={() => setIsMinimized(true)}
              className="w-9 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#3d4251] active:bg-[#4d5366] transition-colors cursor-pointer" 
              title="Minimize Editor"
              aria-label="Minimize Editor"
            >
              <Minus size={12} strokeWidth={2} />
            </button>
            <button 
              id="btn-song-editor-maximize"
              onClick={() => setIsMaximized(!isMaximized)}
              className="w-9 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#3d4251] active:bg-[#4d5366] transition-colors cursor-pointer" 
              title={isMaximized ? "Restore Down" : "Maximize"}
              aria-label={isMaximized ? "Restore Editor" : "Maximize Editor"}
            >
              {isMaximized ? (
                <Copy size={10} className="rotate-90" strokeWidth={2} />
              ) : (
                <Square size={10} strokeWidth={2} />
              )}
            </button>
            <button 
              id="btn-song-editor-close"
              onClick={onClose}
              className="w-10 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#e81123] active:bg-[#c4101e] transition-colors cursor-pointer" 
              title="Close Editor"
              aria-label="Close Editor"
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* 2. Top Title Input & Toolbar Ribbon */}
        <div className="bg-[#242731] border-b border-[#181a20] px-3 py-2 shrink-0 flex flex-wrap items-center justify-between gap-2">
          {/* Left Title & Category */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Title:</span>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title / Reference..."
                  className="w-56 md:w-64 bg-[#16171c] border border-[#3b3f4f] rounded px-2 py-0.5 text-xs text-gray-100 font-semibold focus:outline-none focus:border-indigo-500"
                />

                {/* Category Selector */}
                <div className="flex items-center gap-1.5 ml-1 bg-[#16181f] px-2 py-0.5 rounded border border-[#373c4d]">
                  <FolderOpen size={12} className="text-cyan-400" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Category:</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="bg-transparent text-cyan-300 font-bold text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="Hymns" className="bg-[#1f2229] text-gray-200">Hymns</option>
                    <option value="Special Number" className="bg-[#1f2229] text-gray-200">Special Number</option>
                    <option value="Presentation" className="bg-[#1f2229] text-gray-200">Presentation</option>
                  </select>
                </div>
              </div>

              {/* Sub-tools beneath title */}
              <div className="flex items-center space-x-2 text-gray-400 mt-0.5">
                <button 
                  onClick={() => setShowMetadataAccordion(!showMetadataAccordion)} 
                  className="px-1.5 py-0.5 bg-[#1a1c22] hover:bg-[#343845] hover:text-emerald-400 rounded transition-colors flex items-center gap-1 text-[10px] border border-[#323644]"
                  title="Author, Key, CCLI & Copyright info"
                >
                  <TagIcon size={11} className="text-emerald-400" />
                  <span>Metadata & CCLI</span>
                </button>
                <span className="text-[10px] text-gray-500 font-mono">
                  {author ? `By ${author}` : ''} {musicalKey ? `• Key of ${musicalKey}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Right Ribbon Toolbar Tabs */}
          <div className="flex items-center gap-1 bg-[#1a1c23] p-1 rounded border border-[#333744]">
            <button
              onClick={() => setActiveRibbonTool(activeRibbonTool === 'format' ? null : 'format')}
              className={`flex flex-col items-center justify-center px-3 py-1 rounded transition-colors ${
                activeRibbonTool === 'format' ? 'bg-[#373c4d] text-cyan-300 font-bold' : 'hover:bg-[#2c303c] text-gray-300 hover:text-white'
              }`}
              title="Font, Text Alignment & Colors"
            >
              <Sliders size={15} className="text-emerald-400 mb-0.5" />
              <span className="text-[10px]">Format Text</span>
            </button>

            <button
              onClick={() => setActiveRibbonTool(activeRibbonTool === 'template' ? null : 'template')}
              className={`flex flex-col items-center justify-center px-3 py-1 rounded transition-colors ${
                activeRibbonTool === 'template' ? 'bg-[#373c4d] text-cyan-300 font-bold' : 'hover:bg-[#2c303c] text-gray-300 hover:text-white'
              }`}
              title="Slide Template Presets & Layout Frames"
            >
              <Layout size={15} className="text-amber-400 mb-0.5" />
              <span className="text-[10px]">Templates</span>
            </button>

            <button
              onClick={() => setActiveRibbonTool(activeRibbonTool === 'media' ? null : 'media')}
              className={`flex flex-col items-center justify-center px-3 py-1 rounded transition-colors ${
                activeRibbonTool === 'media' ? 'bg-[#373c4d] text-cyan-300 font-bold' : 'hover:bg-[#2c303c] text-gray-300 hover:text-white'
              }`}
              title="Background Images & Motion Videos"
            >
              <ImageIcon size={15} className="text-cyan-400 mb-0.5" />
              <span className="text-[10px]">Media</span>
            </button>

            <button
              onClick={handleAutoSplitPassage}
              className="flex flex-col items-center justify-center px-3 py-1 rounded hover:bg-[#2c303c] text-gray-300 hover:text-white transition-colors"
              title="Auto-split long passage into balanced 2-3 line slides"
            >
              <Scissors size={15} className="text-pink-400 mb-0.5" />
              <span className="text-[10px]">Auto-Split</span>
            </button>

            <div className="w-px h-7 bg-[#343845] mx-1"></div>

            <button
              onClick={() => setActiveRibbonTool(activeRibbonTool === 'animate' ? null : 'animate')}
              className={`flex flex-col items-center justify-center px-3 py-1 rounded transition-colors ${
                activeRibbonTool === 'animate' ? 'bg-[#373c4d] text-cyan-300' : 'hover:bg-[#2c303c] text-gray-300 hover:text-white'
              }`}
              title="Slide Transition Effects"
            >
              <Sparkles size={15} className="text-purple-400 mb-0.5" />
              <span className="text-[10px]">Animate</span>
            </button>
          </div>
        </div>

        {/* 2b. Ribbon Popups / Sub-Panels */}
        {/* FORMAT TEXT PANEL */}
        {activeRibbonTool === 'format' && (
          <div className="bg-[#181a20] border-b border-[#2d313d] px-4 py-2 flex flex-wrap items-center gap-4 text-xs animate-in slide-in-from-top-2 duration-100">
            {/* Font Family */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-[11px]">Font:</span>
              <SystemFontPicker
                value={fontFamily || previewThemeStyles.fontFamily || 'Montserrat, sans-serif'}
                onChange={(family) => setFontFamily(family)}
                buttonClassName="bg-[#242732] border-[#3b3f4f] text-xs py-0.5 px-2"
              />
            </div>

            {/* Font Size */}
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-[11px]">Size:</span>
              <input
                type="number"
                min="16"
                max="100"
                value={fontSize || previewThemeStyles.fontSize || 42}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-14 bg-[#242732] border border-[#3b3f4f] rounded px-1.5 py-0.5 text-xs text-white text-center font-bold"
              />
              <span className="text-gray-500 text-[10px]">pt</span>
            </div>

            {/* Font Color + Swatches */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-[11px]">Color:</span>
              <input
                type="color"
                value={fontColor || previewThemeStyles.fontColor || '#FFFFFF'}
                onChange={(e) => setFontColor(e.target.value)}
                className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
              />
              {/* Quick Swatches */}
              <div className="flex items-center gap-1">
                {['#FFFFFF', '#FDE047', '#22D3EE', '#FEF3C7'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setFontColor(c)}
                    className="w-4 h-4 rounded-full border border-gray-600 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Horizontal Alignment */}
            <div className="flex items-center bg-[#242732] p-0.5 rounded border border-[#3b3f4f]">
              <button
                onClick={() => setTextAlign('left')}
                className={`p-1 rounded text-[11px] ${textAlign === 'left' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                title="Align Left"
              >
                <AlignLeft size={13} />
              </button>
              <button
                onClick={() => setTextAlign('center')}
                className={`p-1 rounded text-[11px] ${textAlign === 'center' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                title="Align Center"
              >
                <AlignCenter size={13} />
              </button>
              <button
                onClick={() => setTextAlign('right')}
                className={`p-1 rounded text-[11px] ${textAlign === 'right' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                title="Align Right"
              >
                <AlignRight size={13} />
              </button>
              <button
                onClick={() => setTextAlign('justify')}
                className={`p-1 rounded text-[11px] ${textAlign === 'justify' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}
                title="Justify"
              >
                <AlignJustify size={13} />
              </button>
            </div>

            {/* Vertical Alignment */}
            <div className="flex items-center gap-1 bg-[#242732] p-0.5 rounded border border-[#3b3f4f]">
              <span className="text-[10px] text-gray-400 px-1 font-bold uppercase">Vert:</span>
              <button
                onClick={() => setAlignVertical('top')}
                className={`px-2 py-0.5 rounded text-[10px] ${alignVertical === 'top' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400'}`}
              >
                Top
              </button>
              <button
                onClick={() => setAlignVertical('middle')}
                className={`px-2 py-0.5 rounded text-[10px] ${alignVertical === 'middle' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400'}`}
              >
                Mid
              </button>
              <button
                onClick={() => setAlignVertical('bottom')}
                className={`px-2 py-0.5 rounded text-[10px] ${alignVertical === 'bottom' ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400'}`}
              >
                Bot
              </button>
            </div>

            {/* Outline & Shadow */}
            <div className="flex items-center gap-3 border-l border-[#353948] pl-3">
              <label className="flex items-center gap-1 cursor-pointer text-gray-300">
                <input
                  type="checkbox"
                  checked={hasOutline}
                  onChange={(e) => setHasOutline(e.target.checked)}
                  className="rounded bg-[#242732] border-gray-600 text-indigo-600"
                />
                <span className="text-[11px]">Outline</span>
              </label>

              {hasOutline && (
                <input
                  type="color"
                  value={outlineColor}
                  onChange={(e) => setOutlineColor(e.target.value)}
                  className="w-5 h-5 rounded border-0 cursor-pointer bg-transparent"
                  title="Outline Color"
                />
              )}

              <label className="flex items-center gap-1 cursor-pointer text-gray-300 ml-2">
                <input
                  type="checkbox"
                  checked={hasShadow}
                  onChange={(e) => setHasShadow(e.target.checked)}
                  className="rounded bg-[#242732] border-gray-600 text-indigo-600"
                />
                <span className="text-[11px]">Shadow</span>
              </label>
            </div>
          </div>
        )}

        {/* TEMPLATE PRESETS PANEL */}
        {activeRibbonTool === 'template' && (
          <div className="bg-[#181a20] border-b border-[#2d313d] p-3 flex items-center gap-3 overflow-x-auto custom-scrollbar animate-in slide-in-from-top-2 duration-100">
            <span className="text-[11px] font-bold text-amber-400 shrink-0 uppercase tracking-wider">Presets:</span>
            
            {[
              { id: 'center', label: 'Center Stage', desc: 'Classic centered presentation', icon: '🖥️' },
              { id: 'lower-third', label: 'Lower Third Bar', desc: 'Stream overlay for broadcast', icon: '📺' },
              { id: 'glass-card', label: 'Frosted Glass Card', desc: 'Modern backdrop container', icon: '🧊' },
              { id: 'top-header', label: 'Top Header + Body', desc: 'Header badge + body block', icon: '🏷️' },
              { id: 'border', label: 'Gold Accent Frame', desc: 'Framed card container', icon: '👑' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleApplyLayoutPreset(p.id as any)}
                className={`shrink-0 px-3 py-1.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                  layoutPreset === p.id ? 'bg-[#2d364a] border-cyan-400 ring-1 ring-cyan-400 text-white' : 'bg-[#222530] border-[#363a49] hover:bg-[#2b3040] text-gray-300'
                }`}
              >
                <span className="text-base">{p.icon}</span>
                <div>
                  <div className="text-[11px] font-bold leading-tight">{p.label}</div>
                  <div className="text-[9px] text-gray-400">{p.desc}</div>
                </div>
              </button>
            ))}

            <div className="w-px h-8 bg-[#333748] mx-1 shrink-0"></div>

            {/* Container Box Style Selector */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Backdrop Box:</span>
              <select
                value={boxStyle}
                onChange={(e) => setBoxStyle(e.target.value as any)}
                className="bg-[#242732] border border-[#3b3f4f] rounded px-2 py-1 text-xs text-cyan-300 font-bold"
              >
                <option value="none">None (Full Transparent)</option>
                <option value="glass">Dark Frosted Glass</option>
                <option value="solid">Solid Dark Box</option>
                <option value="light-glass">Light Frosted Glass</option>
                <option value="border">Gold Accent Frame</option>
              </select>
            </div>
          </div>
        )}

        {/* MEDIA PANEL */}
        {activeRibbonTool === 'media' && (
          <div className="bg-[#181a20] border-b border-[#2d313d] p-3 animate-in slide-in-from-top-2 duration-100">
            <div className="text-[11px] font-semibold text-gray-400 mb-2 flex items-center justify-between">
              <span>Select Slide Background Media:</span>
              <span className="text-cyan-400 font-mono text-[10px]">{assetsList.length} items available</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
              {assetsList.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setBackgroundUrl(asset.url)}
                  className={`shrink-0 w-24 h-14 rounded overflow-hidden relative border-2 transition-all group ${
                    backgroundUrl === asset.url ? 'border-cyan-400 scale-105 shadow-md shadow-cyan-500/20' : 'border-transparent hover:border-gray-500'
                  }`}
                >
                  <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-end p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[9px] text-white truncate font-medium">{asset.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ANIMATE PANEL */}
        {activeRibbonTool === 'animate' && (
          <div className="bg-[#181a20] border-b border-[#2d313d] px-4 py-2 flex items-center gap-4 text-xs animate-in slide-in-from-top-2 duration-100">
            <span className="text-gray-400 text-[11px]">Transition:</span>
            {['Blend', 'Wipe Right', 'Push Up', 'Fade to Black', 'Instant'].map((t) => (
              <button
                key={t}
                onClick={() => setTransitionType(t)}
                className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                  transitionType === t ? 'bg-indigo-600 text-white font-semibold' : 'bg-[#242732] text-gray-400 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Metadata Drawer */}
        {showMetadataAccordion && (
          <div className="bg-[#1a1c22] border-b border-[#2c303d] px-4 py-2.5 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in slide-in-from-top-2 duration-100">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">Author / Composer:</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. John Newton"
                className="w-full bg-[#131418] border border-[#373b4a] rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">Musical Key:</label>
              <input
                type="text"
                value={musicalKey}
                onChange={(e) => setMusicalKey(e.target.value)}
                placeholder="e.g. G, C, Dm"
                className="w-full bg-[#131418] border border-[#373b4a] rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">CCLI Song #:</label>
              <input
                type="text"
                value={ccliNumber}
                onChange={(e) => setCCLINumber(e.target.value)}
                placeholder="e.g. 22025"
                className="w-full bg-[#131418] border border-[#373b4a] rounded px-2 py-1 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 mb-1">Copyright Info:</label>
              <input
                type="text"
                value={copyright}
                onChange={(e) => setCopyright(e.target.value)}
                placeholder="e.g. Public Domain"
                className="w-full bg-[#131418] border border-[#373b4a] rounded px-2 py-1 text-xs text-white"
              />
            </div>
          </div>
        )}

        {/* 3. Main Body: Left Editor Sidebar & Right Stage Canvas */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Words vs Slides Tabs */}
          <div className="w-80 md:w-96 bg-[#181a20] border-r border-[#131519] flex flex-col shrink-0 overflow-hidden">
            {/* Tab Headers */}
            <div className="h-8 bg-[#20232a] border-b border-[#131519] flex items-center px-2 space-x-1 shrink-0">
              <button
                onClick={() => setActiveLeftTab('Words')}
                className={`flex-1 py-1 text-xs font-semibold rounded-t transition-colors ${
                  activeLeftTab === 'Words'
                    ? 'bg-[#181a20] text-cyan-300 border-t-2 border-t-cyan-400 font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Text / Words Editor
              </button>
              <button
                onClick={() => setActiveLeftTab('Slides')}
                className={`flex-1 py-1 text-xs font-semibold rounded-t transition-colors ${
                  activeLeftTab === 'Slides'
                    ? 'bg-[#181a20] text-cyan-300 border-t-2 border-t-cyan-400 font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Slides List ({parsedSlides.length})
              </button>
            </div>

            {/* Left Content Area */}
            <div className="flex-1 overflow-hidden p-2 flex flex-col">
              {activeLeftTab === 'Words' ? (
                <div className="flex-1 flex flex-col h-full">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5 px-1">
                    <span className="font-semibold">Format: Use [Verse 1], [John 3:16], etc.</span>
                    <span className="font-mono text-emerald-400">{parsedSlides.length} slides</span>
                  </div>

                  {/* Raw Text Editor */}
                  <textarea
                    value={rawLyrics}
                    onChange={(e) => {
                      let val = e.target.value;
                      const titleMatch = val.match(/^\s*(?:Title\s*:|Title)\s*\n?([^\n]+)(?:\n\s*\n|\n|$)/i);
                      if (titleMatch) {
                        setTitle(titleMatch[1].trim());
                        val = val.replace(titleMatch[0], '').trimStart();
                      }
                      setRawLyrics(val);
                    }}
                    className="flex-1 w-full bg-[#121418] border border-[#2d313f] rounded p-2.5 text-xs text-gray-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed resize-none custom-scrollbar"
                    placeholder="Enter lyrics, scripture passage, or slide text..."
                  />

                  {/* Quick Tag Dock (International & Local Tagalog presets) */}
                  <div className="mt-2 flex flex-wrap gap-1 items-center bg-[#15171d] p-1.5 rounded border border-[#2a2e3a]">
                    <span className="text-[10px] text-gray-400 font-bold uppercase mr-1">Insert Tag:</span>
                    {[
                      'Title',
                      'Verse 1',
                      'Verse 2',
                      'Verse 3',
                      'Chorus',
                      'Refrain',
                      'Bridge',
                      'Pre-Chorus',
                      'Tag',
                      'Ending',
                      'Talatâ 1',
                      'Koro',
                      'Tulay',
                      'Scripture Quote',
                      'Slide Break'
                    ].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          if (tag === 'Slide Break') {
                            setRawLyrics(prev => `${prev}\n---\n`);
                          } else if (tag === 'Title') {
                            setRawLyrics(prev => `[Title]\n${title}\n\n${prev}`);
                          } else {
                            handleInsertTag(tag);
                          }
                        }}
                        className="px-1.5 py-0.5 bg-[#252936] hover:bg-[#343a4d] text-indigo-300 hover:text-white rounded text-[10px] font-semibold transition-colors"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Slides Thumbnail List */
                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={parsedSlides.map((_, i) => `slide-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {parsedSlides.map((slide, idx) => (
                          <SortableSlideItem
                            key={`slide-${idx}`}
                            id={`slide-${idx}`}
                            slide={slide}
                            idx={idx}
                            activeSlideIndex={activeSlideIndex}
                            setActiveSlideIndex={setActiveSlideIndex}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Stage Canvas Preview with Interactive Drag/Resize Frame */}
          <div className="flex-1 bg-[#101216] flex flex-col overflow-hidden relative">
            {/* Canvas Header */}
            <div className="h-7 bg-[#1c1e26] border-b border-[#141518] px-3 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-200">
                  Slide {activeSlideIndex + 1} of {parsedSlides.length}
                </span>
                <span>•</span>
                <span className="text-indigo-300 font-semibold">{activeSlide.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Aspect Ratio:</span>
                <button
                  onClick={() => setAspectRatio('16:9')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${aspectRatio === '16:9' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400'}`}
                >
                  16:9
                </button>
                <button
                  onClick={() => setAspectRatio('4:3')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${aspectRatio === '4:3' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-400'}`}
                >
                  4:3
                </button>
              </div>
            </div>

            {/* Canvas Viewport (Interactive Stage Preview) */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
              <div
                className={`relative rounded-md shadow-2xl overflow-hidden flex flex-col justify-between transition-all duration-150 border border-gray-700 ${
                  aspectRatio === '16:9' ? 'aspect-video w-full max-w-4xl' : 'aspect-4/3 w-full max-w-3xl'
                }`}
                style={{
                  backgroundImage: `url(${backgroundUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {/* Background Dim / Overlay */}
                <div className="absolute inset-0 bg-black/35 pointer-events-none" />

                {/* Top Slide Header Label */}
                <div className="relative z-10 px-4 pt-3 text-right">
                  <span className="text-[10px] font-bold text-amber-300/90 uppercase tracking-widest bg-black/50 px-2.5 py-0.5 rounded backdrop-blur-xs border border-white/10">
                    {activeSlide.label}
                  </span>
                </div>

                {/* Interactive Bounding Frame & Content Area */}
                <div 
                  ref={canvasViewportRef}
                  className="relative z-10 flex-1 w-full h-full overflow-hidden"
                  style={ThemeEngine.getContainerAlignmentStyle(previewThemeStyles)}
                >
                  {/* Readjustable Container Card Frame (Support Hold & Drag) */}
                  <div 
                    onClick={() => setSelectedCanvasElement('card')}
                    onMouseDown={handleMouseDownDrag}
                    onTouchStart={handleMouseDownDrag}
                    className={`relative group ${ThemeEngine.getCardStyle(previewThemeStyles).className} ${
                      selectedCanvasElement === 'card' ? 'ring-2 ring-cyan-400 border-cyan-400/80 shadow-2xl' : ''
                    } ${isDragging ? 'cursor-grabbing ring-2 ring-amber-400 scale-[1.01]' : 'cursor-grab'}`}
                    style={ThemeEngine.getCardStyle(previewThemeStyles).style}
                  >
                    {/* Top Hold & Drag Move Handle Ribbon */}
                    <div className="absolute -top-3 left-3 bg-cyan-950/90 border border-cyan-400/60 text-cyan-200 text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 cursor-grab active:cursor-grabbing opacity-90 group-hover:opacity-100 transition-opacity">
                      <Move size={11} className="text-cyan-400 animate-pulse" />
                      <span>Hold & Drag</span>
                      {positionX !== undefined && (
                        <span className="text-[9px] text-amber-300 font-mono ml-1">({positionX}%, {positionY}%)</span>
                      )}
                    </div>

                    {/* Bounding Resize Corner Handles (Drag Corners to Resize Width) */}
                    <div 
                      onMouseDown={handleMouseDownResize} 
                      onTouchStart={handleMouseDownResize}
                      className="absolute -top-2 -left-2 w-4 h-4 bg-cyan-400 border-2 border-black rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 z-20" 
                      title="Drag corner to resize slide box width"
                    />
                    <div 
                      onMouseDown={handleMouseDownResize} 
                      onTouchStart={handleMouseDownResize}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-cyan-400 border-2 border-black rounded-full cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 z-20" 
                      title="Drag corner to resize slide box width"
                    />
                    <div 
                      onMouseDown={handleMouseDownResize} 
                      onTouchStart={handleMouseDownResize}
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-cyan-400 border-2 border-black rounded-full cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 z-20" 
                      title="Drag corner to resize slide box width"
                    />
                    <div 
                      onMouseDown={handleMouseDownResize} 
                      onTouchStart={handleMouseDownResize}
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-cyan-400 border-2 border-black rounded-full cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 z-20" 
                      title="Drag corner to resize slide box width"
                    />

                    {/* Main Slide Text */}
                    {isCanvasEditing ? (
                      <textarea
                        value={activeSlide.text}
                        onChange={(e) => {
                          const updatedLyrics = rawLyrics.replace(activeSlide.text, e.target.value);
                          setRawLyrics(updatedLyrics);
                        }}
                        onBlur={() => setIsCanvasEditing(false)}
                        autoFocus
                        className="w-full bg-black/60 text-white font-bold p-2 rounded border border-cyan-400 text-center leading-tight focus:outline-none cursor-text"
                        style={{
                          fontFamily,
                          fontSize: `${Math.max(16, fontSize * 0.7)}px`,
                        }}
                      />
                    ) : (
                      <p
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setIsCanvasEditing(true);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCanvasElement('text');
                        }}
                        className="font-bold leading-snug whitespace-pre-line select-none cursor-pointer hover:ring-1 hover:ring-cyan-400/50 rounded p-1 transition-all"
                        style={{
                          ...ThemeEngine.getTextStyle(previewThemeStyles, (zoomPercent / 35)),
                          fontSize: `${ThemeEngine.calculateAutoFitFontSize({
                            text: activeSlide.text,
                            baseFontSize: fontSize,
                            hasHeader: Boolean(activeSlide.label),
                            scale: (zoomPercent / 100) * 1.35,
                            minFontSize: 16,
                            maxFontSize: 160,
                            lineSpacing: lineHeight,
                            isUppercase: textTransform === 'uppercase',
                            margins: useStore.getState().systemOptions.mainOutput.general.margins
                          })}px`,
                        }}
                        title="Double-click to edit text directly on slide"
                      >
                        {activeSlide.text || 'Double click to edit text'}
                      </p>
                    )}

                    {/* Floating Quick Formatting Controls on Hover */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/20 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs shadow-xl z-30">
                      <button
                        onClick={(e) => { e.stopPropagation(); setFontSize(prev => Math.min(100, prev + 4)); }}
                        className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded font-bold"
                        title="Increase Font Size"
                      >
                        A+
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFontSize(prev => Math.max(16, prev - 4)); }}
                        className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded font-bold"
                        title="Decrease Font Size"
                      >
                        A-
                      </button>
                      <div className="w-px h-4 bg-gray-600"></div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPositionX(undefined);
                          setPositionY(undefined);
                        }}
                        className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-[10px] flex items-center gap-1 text-amber-300"
                        title="Reset custom drag position to center alignment"
                      >
                        <RotateCcw size={10} />
                        <span>Center</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setBoxStyle(prev => prev === 'none' ? 'glass' : prev === 'glass' ? 'solid' : prev === 'solid' ? 'border' : 'none'); }}
                        className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-bold"
                        title="Cycle Box Style"
                      >
                        Backdrop
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Slide Copyright Banner */}
                <div className="relative z-10 px-4 py-1.5 text-[9px] text-gray-300 font-sans opacity-80 truncate bg-black/50 backdrop-blur-xs border-t border-white/5">
                  {title} {author ? `• ${author}` : ''} {copyright ? `• © ${copyright}` : ''} {ccliNumber ? `• CCLI #${ccliNumber}` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Bottom Status & Action Bar */}
        <div className="h-10 bg-[#242833] border-t border-[#181a20] px-4 flex items-center justify-between shrink-0 text-xs">
          {/* Left Actions */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleInsertTag(`Verse ${parsedSlides.length + 1}`)}
              className="p-1 hover:bg-[#343a4a] rounded text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
              title="Add New Slide"
            >
              <Plus size={14} />
              <span className="text-[11px]">Add Slide</span>
            </button>

            {mode === 'schedule-item' ? (
              <div className="flex items-center gap-3 pl-2 border-l border-[#3a3f50]">
                <span className="text-[11px] text-amber-300 font-medium">
                  Customizing this schedule item
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-gray-400 hover:text-gray-200">
                  <input
                    type="checkbox"
                    checked={updateMasterToo}
                    onChange={(e) => setUpdateMasterToo(e.target.checked)}
                    className="rounded bg-[#141519] border-gray-600 text-indigo-600 focus:ring-0"
                  />
                  <span className="text-[11px]">Also update master library</span>
                </label>
              </div>
            ) : (
              <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white pl-2 border-l border-[#3a3f50]">
                <input
                  type="checkbox"
                  checked={applyToSchedule}
                  onChange={(e) => setApplyToSchedule(e.target.checked)}
                  className="rounded bg-[#141519] border-gray-600 text-indigo-600 focus:ring-0"
                />
                <span className="text-[11px]">Apply to active schedule items</span>
              </label>
            )}
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {/* Zoom Slider */}
            <div className="flex items-center gap-1.5 text-gray-400 font-mono text-[11px]">
              <ZoomOut size={12} />
              <input
                type="range"
                min="20"
                max="60"
                value={zoomPercent}
                onChange={(e) => setZoomPercent(Number(e.target.value))}
                className="w-20 h-1 bg-[#141519] rounded appearance-none cursor-pointer accent-indigo-500"
              />
              <ZoomIn size={12} />
              <span className="w-8 text-right text-gray-300 font-semibold">{zoomPercent}%</span>
            </div>

            <div className="h-4 w-px bg-[#3a3f50]"></div>

            <button
              onClick={() => handleSaveAndApply(false)}
              className="px-3.5 py-1 bg-[#323746] hover:bg-[#404658] text-gray-200 rounded font-medium transition-colors"
            >
              Apply
            </button>

            <button
              onClick={() => handleSaveAndApply(true)}
              className="px-5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-colors shadow flex items-center gap-1"
            >
              <Check size={13} />
              <span>OK</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-1 bg-[#2c303d] hover:bg-[#3b4052] text-gray-400 hover:text-gray-200 rounded font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

      </div>
    </div>
    
  );
}

export default withPortal(SongEditorModal);
