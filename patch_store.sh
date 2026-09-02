sed -i '/if (outputGroups.length < 3) {/,/}/c\
    if (outputGroups.length !== 3) {\
      await Promise.all(outputGroups.map(g => dbApi.deleteOutputGroup(g.id)));\
      defaultOutputGroups.forEach(g => dbApi.saveOutputGroup(g));\
      get().setOutputGroups(defaultOutputGroups);\
    } else {\
      get().setOutputGroups(outputGroups);\
    }' src/store/useStore.ts
