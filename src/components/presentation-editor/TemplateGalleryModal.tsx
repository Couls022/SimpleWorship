import { withPortal } from '../common/withPortal';
import React, { useState } from 'react';
import {
  X,
  Type,
  List,
  BookOpen,
  Quote,
  Split,
  Calendar,
  Layout,
  Music,
  Tv,
  Camera,
  Clock,
  Image as ImageIcon,
  Heart,
  Sparkles,
  Award,
  Layers,
  MessageSquare
} from 'lucide-react';
import { Slide, SlideObject } from '../../types';
import { PresentationSlideView } from '../PresentationSlideView';

interface TemplateGalleryModalProps {
  onClose: () => void;
  onSelectTemplate: (templateId: string, customSlide?: Slide) => void;
}

export interface TemplateDefinition {
  id: string;
  category: 'general' | 'church' | 'media';
  title: string;
  description: string;
  icon: React.ReactNode;
  slide: Slide;
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  // GENERAL CATEGORY
  {
    id: 'title',
    category: 'general',
    title: 'Title Slide',
    description: 'Header presentation slide with prominent title and subtitle',
    icon: <Type size={16} className="text-sky-400" />,
    slide: {
      id: 'template-title',
      title: 'Sunday Worship Service',
      subtitle: 'Faith • Fellowship • Transformation',
      text: 'Welcome to our service',
      isTitleSlide: true,
      backgroundColor: '#0f172a',
      fontColor: '#cbd5e1',
      titleColor: '#ffffff',
      accentColor: '#38bdf8',
      headerBarColor: '#0284c7',
      objects: [
        {
          id: 'obj-title',
          type: 'text',
          x: 160,
          y: 240,
          width: 1600,
          height: 200,
          text: 'Sunday Worship Service',
          style: {
            fontSize: 64,
            fontColor: '#FFFFFF',
            fontFamily: 'Aptos, Calibri, sans-serif',
            fontWeight: 'bold',
            textAlign: 'center',
            alignVertical: 'middle',
          },
        },
        {
          id: 'obj-subtitle',
          type: 'text',
          x: 200,
          y: 480,
          width: 1520,
          height: 180,
          text: 'Faith • Fellowship • Transformation',
          style: {
            fontSize: 32,
            fontColor: '#38bdf8',
            fontFamily: 'Aptos, Calibri, sans-serif',
            fontWeight: 'medium',
            textAlign: 'center',
            alignVertical: 'top',
          },
        },
      ],
    },
  },
  {
    id: 'title-content',
    category: 'general',
    title: 'Title & Content',
    description: 'Standard presentation slide with header title and bullet points',
    icon: <List size={16} className="text-emerald-400" />,
    slide: {
      id: 'template-title-content',
      title: 'Key Message Focus',
      text: '',
      bullets: ['Anchor your heart in eternal truth', 'Walk in daily grace and wisdom', 'Serve others with joyful love'],
      isTitleSlide: false,
      backgroundColor: '#0f172a',
      fontColor: '#cbd5e1',
      titleColor: '#ffffff',
      accentColor: '#38bdf8',
      headerBarColor: '#0284c7',
      objects: [
        {
          id: 'obj-header',
          type: 'text',
          x: 120,
          y: 80,
          width: 1680,
          height: 140,
          text: 'Key Message Focus',
          style: {
            fontSize: 48,
            fontColor: '#FFFFFF',
            fontFamily: 'Aptos, Calibri, sans-serif',
            fontWeight: 'bold',
            textAlign: 'left',
            alignVertical: 'middle',
          },
        },
        {
          id: 'obj-line',
          type: 'line',
          x: 120,
          y: 220,
          width: 1680,
          height: 6,
          style: {
            borderColor: '#0284c7',
            borderWidth: 4,
          },
        },
        {
          id: 'obj-bullets',
          type: 'text',
          x: 120,
          y: 270,
          width: 1680,
          height: 700,
          text: '• Anchor your heart in eternal truth\n\n• Walk in daily grace and wisdom\n\n• Serve others with joyful love',
          style: {
            fontSize: 34,
            fontColor: '#cbd5e1',
            fontFamily: 'Aptos, Calibri, sans-serif',
            textAlign: 'left',
            alignVertical: 'top',
          },
        },
      ],
    },
  },
  {
    id: 'section-header',
    category: 'general',
    title: 'Section Header',
    description: 'Dividing slide for major sermon topics or presentation parts',
    icon: <Layers size={16} className="text-amber-400" />,
    slide: {
      id: 'template-section',
      title: 'PART I: THE CALL TO FAITH',
      subtitle: 'Understanding God\'s Purpose for Our Lives',
      text: '',
      isTitleSlide: true,
      backgroundColor: '#1e1b4b',
      fontColor: '#e0e7ff',
      titleColor: '#a5b4fc',
      accentColor: '#818cf8',
      objects: [
        {
          id: 'obj-sec-badge',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 760,
          y: 280,
          width: 400,
          height: 60,
          text: 'SECTION BREAK',
          style: {
            backgroundColor: '#4338ca',
            fontColor: '#e0e7ff',
            fontSize: 20,
            borderRadius: 30,
          },
        },
        {
          id: 'obj-sec-title',
          type: 'text',
          x: 160,
          y: 380,
          width: 1600,
          height: 200,
          text: 'PART I: THE CALL TO FAITH',
          style: {
            fontSize: 56,
            fontColor: '#FFFFFF',
            fontFamily: 'Aptos, Calibri, sans-serif',
            fontWeight: 'bold',
            textAlign: 'center',
            alignVertical: 'middle',
          },
        },
        {
          id: 'obj-sec-sub',
          type: 'text',
          x: 200,
          y: 600,
          width: 1520,
          height: 140,
          text: 'Understanding God\'s Purpose for Our Lives',
          style: {
            fontSize: 30,
            fontColor: '#a5b4fc',
            fontFamily: 'Aptos, Calibri, sans-serif',
            textAlign: 'center',
          },
        },
      ],
    },
  },
  {
    id: 'two-column',
    category: 'general',
    title: 'Two Column',
    description: 'Side-by-side comparison or two topic blocks',
    icon: <Split size={16} className="text-indigo-400" />,
    slide: {
      id: 'template-two-col',
      title: 'Comparing the Perspectives',
      text: '',
      isTitleSlide: false,
      backgroundColor: '#0f172a',
      titleColor: '#ffffff',
      objects: [
        {
          id: 'obj-col-title',
          type: 'text',
          x: 120,
          y: 80,
          width: 1680,
          height: 120,
          text: 'Comparing the Perspectives',
          style: {
            fontSize: 44,
            fontColor: '#FFFFFF',
            fontWeight: 'bold',
            textAlign: 'left',
          },
        },
        {
          id: 'obj-left-box',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 120,
          y: 240,
          width: 800,
          height: 720,
          text: 'COLUMN A\n\n1. First Principle Focus\n\n2. Direct Practical Steps\n\n3. Community Integration',
          style: {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 2,
            fontColor: '#f1f5f9',
            fontSize: 28,
            borderRadius: 16,
            padding: 20,
            textAlign: 'left',
            alignVertical: 'top',
          },
        },
        {
          id: 'obj-right-box',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 1000,
          y: 240,
          width: 800,
          height: 720,
          text: 'COLUMN B\n\n1. Spiritual Reflection\n\n2. Continuous Learning\n\n3. Long-Term Impact',
          style: {
            backgroundColor: '#1e293b',
            borderColor: '#0284c7',
            borderWidth: 2,
            fontColor: '#f1f5f9',
            fontSize: 28,
            borderRadius: 16,
            padding: 20,
            textAlign: 'left',
            alignVertical: 'top',
          },
        },
      ],
    },
  },
  {
    id: 'quote',
    category: 'general',
    title: 'Quote & Reflection',
    description: 'Featured testimonial, quote, or memorable verse text',
    icon: <Quote size={16} className="text-purple-400" />,
    slide: {
      id: 'template-quote',
      title: 'Key Reflection',
      text: '',
      isTitleSlide: true,
      backgroundColor: '#18181b',
      titleColor: '#fafafa',
      objects: [
        {
          id: 'obj-quote-mark',
          type: 'text',
          x: 160,
          y: 180,
          width: 200,
          height: 200,
          text: '“',
          style: {
            fontSize: 160,
            fontColor: '#a855f7',
            fontWeight: 'bold',
            textAlign: 'center',
          },
        },
        {
          id: 'obj-quote-body',
          type: 'text',
          x: 220,
          y: 320,
          width: 1480,
          height: 380,
          text: 'Faith is taking the first step even when you don\'t see the whole staircase.',
          style: {
            fontSize: 48,
            fontColor: '#f4f4f5',
            fontStyle: 'italic',
            fontWeight: 'medium',
            textAlign: 'center',
            alignVertical: 'middle',
          },
        },
        {
          id: 'obj-quote-author',
          type: 'text',
          x: 400,
          y: 720,
          width: 1120,
          height: 100,
          text: '— Dr. Martin Luther King Jr.',
          style: {
            fontSize: 28,
            fontColor: '#c084fc',
            fontWeight: 'bold',
            textAlign: 'center',
          },
        },
      ],
    },
  },
  {
    id: 'blank',
    category: 'general',
    title: 'Blank Canvas',
    description: 'Empty canvas slide ready for custom design and object insertion',
    icon: <Layout size={16} className="text-slate-400" />,
    slide: {
      id: 'template-blank',
      title: 'Blank Canvas',
      text: '',
      isTitleSlide: false,
      backgroundColor: '#090a0f',
      titleColor: '#ffffff',
      objects: [],
    },
  },

  // CHURCH CATEGORY
  {
    id: 'scripture-focus',
    category: 'church',
    title: 'Scripture Verse Focus',
    description: 'Formatted Bible verse slide with King James Version (KJV) badge & reference text',
    icon: <BookOpen size={16} className="text-amber-400" />,
    slide: {
      id: 'template-scripture',
      title: 'John 3:16 (KJV)',
      text: '',
      isTitleSlide: false,
      backgroundColor: '#0c1017',
      titleColor: '#fbbf24',
      headerBarColor: '#d97706',
      objects: [
        {
          id: 'obj-scrip-badge',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 120,
          y: 100,
          width: 220,
          height: 60,
          text: 'HOLY BIBLE • KJV',
          style: {
            backgroundColor: '#d97706',
            fontColor: '#ffffff',
            fontSize: 18,
            borderRadius: 8,
          },
        },
        {
          id: 'obj-scrip-ref',
          type: 'text',
          x: 370,
          y: 95,
          width: 1430,
          height: 70,
          text: 'JOHN 3:16 (KJV)',
          style: {
            fontSize: 42,
            fontColor: '#fbbf24',
            fontWeight: 'bold',
            textAlign: 'left',
          },
        },
        {
          id: 'obj-scrip-text',
          type: 'text',
          x: 120,
          y: 220,
          width: 1680,
          height: 680,
          text: '“For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.”',
          style: {
            fontSize: 46,
            fontColor: '#fef3c7',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            textAlign: 'left',
            alignVertical: 'middle',
            lineSpacing: 1.4,
          },
        },
      ],
    },
  },
  {
    id: 'song-lyrics',
    category: 'church',
    title: 'Song Lyrics Display',
    description: 'Clean, high-contrast verse or chorus layout for worship lyrics',
    icon: <Music size={16} className="text-rose-400" />,
    slide: {
      id: 'template-song',
      title: 'What A Beautiful Name • Chorus',
      text: '',
      isTitleSlide: false,
      backgroundColor: '#090d16',
      titleColor: '#38bdf8',
      objects: [
        {
          id: 'obj-song-tag',
          type: 'text',
          x: 120,
          y: 80,
          width: 1680,
          height: 60,
          text: 'CHORUS 1 • WHAT A BEAUTIFUL NAME',
          style: {
            fontSize: 22,
            fontColor: '#38bdf8',
            fontWeight: 'bold',
            letterSpacing: 2,
            textAlign: 'center',
          },
        },
        {
          id: 'obj-song-lyrics',
          type: 'text',
          x: 120,
          y: 200,
          width: 1680,
          height: 760,
          text: 'What a beautiful Name it is\nWhat a beautiful Name it is\nThe Name of Jesus Christ my King\n\nWhat a beautiful Name it is\nNothing compares to this\nWhat a beautiful Name it is\nThe Name of Jesus',
          style: {
            fontSize: 52,
            fontColor: '#ffffff',
            fontWeight: 'bold',
            textAlign: 'center',
            alignVertical: 'middle',
            lineSpacing: 1.3,
          },
        },
      ],
    },
  },
  {
    id: 'announcement',
    category: 'church',
    title: 'Church Announcement',
    description: 'Event invitation card with date, venue, and call-to-action details',
    icon: <Calendar size={16} className="text-cyan-400" />,
    slide: {
      id: 'template-announcement',
      title: 'Midweek Fellowship & Prayer',
      text: '',
      isTitleSlide: false,
      backgroundColor: '#061a2e',
      objects: [
        {
          id: 'obj-ann-badge',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 140,
          y: 120,
          width: 320,
          height: 60,
          text: 'SPECIAL EVENT',
          style: {
            backgroundColor: '#0284c7',
            fontColor: '#ffffff',
            fontSize: 20,
            borderRadius: 30,
          },
        },
        {
          id: 'obj-ann-title',
          type: 'text',
          x: 140,
          y: 220,
          width: 1640,
          height: 160,
          text: 'MIDWEEK FELLOWSHIP & PRAYER',
          style: {
            fontSize: 56,
            fontColor: '#ffffff',
            fontWeight: 'bold',
            textAlign: 'left',
          },
        },
        {
          id: 'obj-ann-details',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 140,
          y: 420,
          width: 1640,
          height: 480,
          text: '📅  Every Wednesday Evening at 7:00 PM\n📍  Main Sanctuary & Online Live Stream\n\nJoin us as we gather for corporate worship, scripture study, and prayer intercession for our community and world.',
          style: {
            backgroundColor: '#0f2942',
            borderColor: '#38bdf8',
            borderWidth: 2,
            fontColor: '#e0f2fe',
            fontSize: 32,
            padding: 30,
            textAlign: 'left',
            alignVertical: 'top',
          },
        },
      ],
    },
  },
  {
    id: 'giving-offering',
    category: 'church',
    title: 'Giving & Offering',
    description: 'Tithe and offering slide with QR code placeholder and digital options',
    icon: <Heart size={16} className="text-pink-400" />,
    slide: {
      id: 'template-giving',
      title: 'Tithes & Offerings',
      text: '',
      isTitleSlide: false,
      backgroundColor: '#111827',
      objects: [
        {
          id: 'obj-giving-title',
          type: 'text',
          x: 120,
          y: 120,
          width: 1680,
          height: 140,
          text: 'WORSHIP THROUGH GIVING',
          style: {
            fontSize: 56,
            fontColor: '#f472b6',
            fontWeight: 'bold',
            textAlign: 'center',
          },
        },
        {
          id: 'obj-giving-sub',
          type: 'text',
          x: 200,
          y: 280,
          width: 1520,
          height: 100,
          text: '“Honor the Lord with your wealth, with the firstfruits of all your crops.” — Proverbs 3:9',
          style: {
            fontSize: 26,
            fontColor: '#e5e7eb',
            fontStyle: 'italic',
            textAlign: 'center',
          },
        },
        {
          id: 'obj-giving-card',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 240,
          y: 420,
          width: 1440,
          height: 520,
          text: 'DIGITAL GIVING OPTIONS\n\n• Mobile App: Search "SimpleWorship Church"\n• Online: www.simpleworship.church/give\n• Bank Transfer: Account 1234-5678-90',
          style: {
            backgroundColor: '#1f2937',
            borderColor: '#ec4899',
            borderWidth: 2,
            fontColor: '#f9fafb',
            fontSize: 32,
            padding: 30,
            textAlign: 'left',
            alignVertical: 'top',
          },
        },
      ],
    },
  },

  // MEDIA CATEGORY
  {
    id: 'media-story',
    category: 'media',
    title: 'Image & Text Feature',
    description: 'Side-by-side featured image asset with descriptive content block',
    icon: <ImageIcon size={16} className="text-emerald-400" />,
    slide: {
      id: 'template-media-story',
      title: 'Community Outreach Ministry',
      text: '',
      isTitleSlide: false,
      backgroundColor: '#0f172a',
      objects: [
        {
          id: 'obj-media-title',
          type: 'text',
          x: 120,
          y: 80,
          width: 1680,
          height: 120,
          text: 'Community Outreach Ministry',
          style: {
            fontSize: 48,
            fontColor: '#ffffff',
            fontWeight: 'bold',
          },
        },
        {
          id: 'obj-media-img',
          type: 'image',
          imageUrl: '',
          x: 120,
          y: 220,
          width: 900,
          height: 760,
          style: {
            borderRadius: 16,
            borderColor: '#0284c7',
            borderWidth: 2,
          },
        },
        {
          id: 'obj-media-desc',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 1060,
          y: 220,
          width: 740,
          height: 760,
          text: 'SERVING OUR NEIGHBORS\n\nEvery weekend our teams distribute food packages and provide care support to families in need.\n\nGet Involved:\n• Volunteer on Saturdays\n• Donate food supplies\n• Join the prayer network',
          style: {
            backgroundColor: '#1e293b',
            fontColor: '#e2e8f0',
            fontSize: 28,
            padding: 24,
            textAlign: 'left',
            alignVertical: 'top',
            borderRadius: 16,
          },
        },
      ],
    },
  },
  {
    id: 'camera-overlay',
    category: 'media',
    title: 'Live Camera Stream Layout',
    description: 'Slide layout with live video camera feed box and title lower-third',
    icon: <Camera size={16} className="text-rose-400" />,
    slide: {
      id: 'template-camera',
      title: 'Live Pastor Message',
      text: '',
      isTitleSlide: false,
      backgroundColor: '#000000',
      objects: [
        {
          id: 'obj-cam-box',
          type: 'camera',
          x: 120,
          y: 120,
          width: 1680,
          height: 720,
          text: 'LIVE CAMERA STREAM',
          style: {
            backgroundColor: '#111827',
            borderColor: '#38bdf8',
            borderWidth: 2,
            borderRadius: 16,
          },
        },
        {
          id: 'obj-cam-l3',
          type: 'shape',
          shapeType: 'rounded-rectangle',
          x: 160,
          y: 700,
          width: 900,
          height: 100,
          text: 'PASTOR DAVID SMITH  •  SERMON: RENEWED FAITH',
          style: {
            backgroundColor: '#0284c7',
            fontColor: '#ffffff',
            fontSize: 26,
            borderRadius: 8,
            padding: 16,
          },
        },
      ],
    },
  },
];

function TemplateGalleryModalBase({
  onClose,
  onSelectTemplate,
}: TemplateGalleryModalProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'general' | 'church' | 'media'>('all');

  const filtered = TEMPLATE_DEFINITIONS.filter(
    (t) => activeCategory === 'all' || t.category === activeCategory
  );

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Choose Slide Layout & Template</h2>
              <p className="text-xs text-slate-400">Select a pre-designed layout gallery template to add to your deck</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Filters */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/30 flex items-center gap-2 text-xs">
          {[
            { id: 'all', label: 'All Templates' },
            { id: 'general', label: 'General & Business' },
            { id: 'church', label: 'Church & Worship' },
            { id: 'media', label: 'Media & Camera' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                activeCategory === cat.id
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Template Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 custom-scrollbar bg-slate-950/40">
          {filtered.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onSelectTemplate(tmpl.id, tmpl.slide);
                onClose();
              }}
              className="group bg-slate-900 border border-slate-800 hover:border-sky-500/80 rounded-xl p-3 flex flex-col gap-3 cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-sky-950/30 hover:-translate-y-0.5"
            >
              {/* Aspect-16:9 Live Visual Miniature Preview */}
              <div className="w-full aspect-video bg-black rounded-lg border border-slate-800/80 overflow-hidden relative shadow-inner pointer-events-none group-hover:ring-2 group-hover:ring-sky-500/50 transition-all">
                <PresentationSlideView slide={tmpl.slide} slideIndex={0} mode="thumbnail" />
              </div>

              {/* Title & Info */}
              <div className="flex flex-col gap-1 px-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-100 group-hover:text-sky-400 transition-colors">
                    {tmpl.icon}
                    <span>{tmpl.title}</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 px-2 py-0.5 bg-slate-800 rounded">
                    {tmpl.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{tmpl.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Click any slide template card to insert into your active presentation deck.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export const TemplateGalleryModal = withPortal(TemplateGalleryModalBase);
