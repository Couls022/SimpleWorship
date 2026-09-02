sed -i '/if (outputGroups.length !== 3) {/,/}/c\
    if (!localStorage.getItem('\''worship_v3_panels_migrated'\'')) {\
      await Promise.all(outputGroups.map(g => dbApi.deleteOutputGroup(g.id)));\
      defaultOutputGroups.forEach(g => dbApi.saveOutputGroup(g));\
      get().setOutputGroups(defaultOutputGroups);\
      localStorage.setItem('\''worship_v3_panels_migrated'\'', '\''true'\'');\
    } else {\
      get().setOutputGroups(outputGroups);\
    }' src/store/useStore.ts
