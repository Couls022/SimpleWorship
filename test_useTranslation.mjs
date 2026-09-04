import React from 'react';
import { renderToString } from 'react-dom/server';
import { useTranslation } from 'react-i18next';

function Test() {
  const { i18n } = useTranslation();
  console.log("i18n from useTranslation:", i18n);
  return null;
}

renderToString(React.createElement(Test));
