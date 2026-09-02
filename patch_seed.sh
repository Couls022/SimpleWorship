sed -i '/export const defaultOutputGroups: OutputGroup\[\] = \[/,/\];/c\
export const defaultOutputGroups: OutputGroup[] = [\
  {\
    id: '\''group-main'\'',\
    name: '\''Lobby & Overflow'\'',\
    themeId: '\''theme-global'\'',\
    role: '\''primary'\'',\
    displayIds: ['\''Monitor 1 (Primary)'\''],\
    isBlack: false,\
    isClear: false,\
    showLogo: true\
  },\
  {\
    id: '\''group-congregation'\'',\
    name: '\''Congregation Display'\'',\
    themeId: '\''theme-global'\'',\
    role: '\''broadcast'\'',\
    displayIds: ['\''Monitor 2'\''],\
    isBlack: false,\
    isClear: false,\
    showLogo: true\
  },\
  {\
    id: '\''group-stage'\'',\
    name: '\''Stage Confidence Monitor'\'',\
    themeId: '\''theme-stage'\'',\
    role: '\''confidence'\'',\
    displayIds: ['\''Monitor 3'\''],\
    isBlack: false,\
    isClear: false,\
    showLogo: true\
  }\
];' src/db/seedData.ts
