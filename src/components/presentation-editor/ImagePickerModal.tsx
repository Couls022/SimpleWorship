import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Globe, 
  Search, 
  Check, 
  FolderOpen, 
  Sparkles,
  Layers,
  ZoomIn
} from 'lucide-react';
import { Asset } from '../../types';
import { dbApi } from '../../db';
import { defaultAssets } from '../../db/seedData';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string, metadata?: { name?: string; width?: number; height?: number }) => void;
  title?: string;
}

// Curated high-resolution presentation and church worship backgrounds
const CURATED_PRESENTATION_IMAGES = [
  {
    id: 'worship-cross',
    name: 'Cross at Sunrise',
    category: 'Worship & Cross',
    url: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'worship-hands',
    name: 'Hands in Praise & Worship',
    category: 'Worship & Cross',
    url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'nature-mountains',
    name: 'Majestic Alpine Mountains',
    category: 'Creation & Nature',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'nature-forest-mist',
    name: 'Sunlight Through Forest Mist',
    category: 'Creation & Nature',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'space-nebula',
    name: 'Cosmic Starry Night Galaxy',
    category: 'Cosmic & Atmospheric',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'space-particles',
    name: 'Golden Worship Particles',
    category: 'Cosmic & Atmospheric',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'minimal-abstract-dark',
    name: 'Dark Slate Geometric Waves',
    category: 'Modern & Minimal',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'minimal-blue-glow',
    name: 'Deep Blue Stage Lighting Flare',
    category: 'Modern & Minimal',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'church-sanctuary',
    name: 'Cathedral Stained Glass Glow',
    category: 'Sanctuary & Sacred',
    url: 'https://images.unsplash.com/photo-1548625361-195fe2109033?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1548625361-195fe2109033?auto=format&fit=crop&w=400&q=80',
  },
  {
    id: 'church-candles',
    name: 'Prayer Candles Reverence',
    category: 'Sanctuary & Sacred',
    url: 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=1920&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=400&q=80',
  },
];

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
  title = 'Select or Upload Image',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'library' | 'curated' | 'url'>('curated');
  
  // Local File Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState<{ url: string; name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Library Assets state
  const [libraryAssets, setLibraryAssets] = useState<Asset[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  // Curated category filter
  const [curatedCategory, setCuratedCategory] = useState<string>('ALL');

  // URL state
  const [urlInput, setUrlInput] = useState('');
  const [urlPreviewValid, setUrlPreviewValid] = useState<boolean | null>(null);

  // Fetch library assets when opening library tab
  useEffect(() => {
    if (isOpen && activeTab === 'library') {
      setIsLoadingLibrary(true);
      dbApi.getAllAssets()
        .then((assets) => {
          const imageAssets = (assets && assets.length > 0 ? assets : defaultAssets).filter(
            (a) => a.type === 'image' || a.type === 'motion' || a.thumbnail
          );
          setLibraryAssets(imageAssets);
        })
        .catch(() => {
          setLibraryAssets(defaultAssets);
        })
        .finally(() => {
          setIsLoadingLibrary(false);
        });
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  // Handle file reading
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setUploadedPreview({
          url: dataUrl,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // Filter library assets
  const filteredLibrary = libraryAssets.filter((a) =>
    a.name.toLowerCase().includes(librarySearch.toLowerCase())
  );

  // Filter curated
  const curatedCategories = ['ALL', 'Worship & Cross', 'Creation & Nature', 'Cosmic & Atmospheric', 'Modern & Minimal', 'Sanctuary & Sacred'];
  const filteredCurated = curatedCategory === 'ALL'
    ? CURATED_PRESENTATION_IMAGES
    : CURATED_PRESENTATION_IMAGES.filter((c) => c.category === curatedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="h-14 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <ImageIcon size={18} />
            </div>
            <div>
              <h2 className="font-semibold text-base text-slate-100">{title}</h2>
              <p className="text-[11px] text-slate-400">High-resolution slide images, wallpapers, and custom uploads</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/30 shrink-0">
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'curated'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            onClick={() => setActiveTab('curated')}
          >
            <Sparkles size={14} className={activeTab === 'curated' ? 'text-white' : 'text-amber-400'} />
            <span>Curated Church & Worship Presets</span>
          </button>

          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'library'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            onClick={() => setActiveTab('library')}
          >
            <FolderOpen size={14} className={activeTab === 'library' ? 'text-white' : 'text-sky-400'} />
            <span>Media Library</span>
          </button>

          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={14} className={activeTab === 'upload' ? 'text-white' : 'text-emerald-400'} />
            <span>Upload From Computer</span>
          </button>

          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'url'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            onClick={() => setActiveTab('url')}
          >
            <Globe size={14} className={activeTab === 'url' ? 'text-white' : 'text-purple-400'} />
            <span>Direct Web URL</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: CURATED WORSHIP & PRESENTATION WALLPAPERS */}
          {activeTab === 'curated' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                {curatedCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCuratedCategory(cat)}
                    className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
                      curatedCategory === cat
                        ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/50'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredCurated.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => {
                      onSelectImage(img.url, { name: img.name });
                      onClose();
                    }}
                    className="group relative rounded-lg overflow-hidden border border-slate-700/80 bg-slate-800 hover:border-sky-500 transition-all cursor-pointer shadow-md hover:shadow-sky-500/20"
                  >
                    <div className="aspect-video w-full overflow-hidden bg-slate-950">
                      <img
                        src={img.thumbnail || img.url}
                        alt={img.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    <div className="p-2.5 bg-slate-900/90">
                      <p className="text-xs font-semibold text-slate-200 truncate">{img.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{img.category}</p>
                    </div>
                    <div className="absolute inset-0 bg-sky-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="bg-sky-600 text-white font-semibold text-xs px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1">
                        <Check size={13} /> Select
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MEDIA LIBRARY ASSETS */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search media assets by title..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 outline-none"
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                />
              </div>

              {isLoadingLibrary ? (
                <div className="py-12 text-center text-slate-400 text-xs">Loading media assets...</div>
              ) : filteredLibrary.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No matching images found in media library.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredLibrary.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => {
                        onSelectImage(asset.url, { name: asset.name });
                        onClose();
                      }}
                      className="group relative rounded-lg overflow-hidden border border-slate-700/80 bg-slate-800 hover:border-sky-500 transition-all cursor-pointer shadow-md"
                    >
                      <div className="aspect-video w-full overflow-hidden bg-slate-950">
                        <img
                          src={asset.thumbnail || asset.url}
                          alt={asset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="p-2.5 bg-slate-900/90">
                        <p className="text-xs font-semibold text-slate-200 truncate">{asset.name}</p>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 capitalize">
                          {asset.type}
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-sky-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-sky-600 text-white font-semibold text-xs px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1">
                          <Check size={13} /> Select
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UPLOAD LOCAL FILE */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-sky-500 bg-sky-500/10'
                    : 'border-slate-700 hover:border-sky-500/60 bg-slate-950/40'
                }`}
              >
                <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-sky-400 mb-3 shadow-inner">
                  <Upload size={26} />
                </div>
                <h3 className="font-semibold text-sm text-slate-200 mb-1">
                  Drag & Drop Image Here or Click to Browse
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  Supports PNG, JPEG, WEBP, GIF, and SVG formats up to 4K resolution.
                </p>
              </div>

              {uploadedPreview && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex items-center gap-4">
                  <img
                    src={uploadedPreview.url}
                    alt={uploadedPreview.name}
                    className="w-24 h-16 object-cover rounded border border-slate-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{uploadedPreview.name}</p>
                    <p className="text-[11px] text-slate-400">{uploadedPreview.size}</p>
                  </div>
                  <button
                    onClick={() => {
                      onSelectImage(uploadedPreview.url, { name: uploadedPreview.name });
                      onClose();
                    }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-md shadow-md transition-colors flex items-center gap-1.5"
                  >
                    <Check size={14} /> Insert Selected Image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DIRECT WEB URL */}
          {activeTab === 'url' && (
            <div className="space-y-4 max-w-xl mx-auto py-4">
              <label className="block text-xs font-semibold text-slate-300">
                Image Web Address (URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... or any online image"
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-500 outline-none font-mono"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setUrlPreviewValid(null);
                  }}
                />
              </div>

              {urlInput && (
                <div className="mt-4 border border-slate-800 rounded-lg p-3 bg-slate-950/60 text-center space-y-3">
                  <p className="text-xs text-slate-400">Live Image Preview:</p>
                  <div className="max-h-48 overflow-hidden flex items-center justify-center rounded bg-black/40">
                    <img
                      src={urlInput}
                      alt="URL preview"
                      className="max-h-48 object-contain"
                      onLoad={() => setUrlPreviewValid(true)}
                      onError={() => setUrlPreviewValid(false)}
                    />
                  </div>
                  {urlPreviewValid === false && (
                    <p className="text-xs text-rose-400">Unable to load image from this URL. Please verify the link.</p>
                  )}
                  {urlPreviewValid === true && (
                    <button
                      onClick={() => {
                        onSelectImage(urlInput, { name: 'Web Image' });
                        onClose();
                      }}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-md shadow transition-colors inline-flex items-center gap-1.5"
                    >
                      <Check size={14} /> Insert from URL
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="h-12 px-6 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Click any image thumbnail to insert onto slide</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
