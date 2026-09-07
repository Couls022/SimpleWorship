import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translationsEn } from 'pptx-react-viewer/i18n';
import { useEffect, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';

// ==========================================
// 1. i18n Global Initialization for Viewer
// ==========================================
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: {
        translation: translationsEn || {}
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
    i18n.addResourceBundle('en', 'translation', translationsEn || {}, true, true);
  }
}
export default i18n;
