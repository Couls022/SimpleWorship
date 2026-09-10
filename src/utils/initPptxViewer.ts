import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Common English fallback translations for pptx-react-viewer
const defaultTranslationsEn: Record<string, string> = {
  'pptx.slideSorter.zoomIn': 'Zoom In',
  'pptx.slideSorter.zoomOut': 'Zoom Out',
  'pptx.slideSorter.fitToScreen': 'Fit to Screen',
  'pptx.presentation.next': 'Next',
  'pptx.presentation.previous': 'Previous',
  'pptx.presentation.first': 'First Slide',
  'pptx.presentation.last': 'Last Slide',
  'pptx.loading': 'Loading presentation...',
  'pptx.error': 'Error loading presentation',
  'pptx.unsupported': 'Unsupported element',
};

// ==========================================
// 1. i18n Global Initialization for Viewer
// ==========================================
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: {
        translation: defaultTranslationsEn
      }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });
} else {
  if (!i18n.hasResourceBundle('en', 'translation')) {
    i18n.addResourceBundle('en', 'translation', defaultTranslationsEn, true, true);
  }
}

export default i18n;
