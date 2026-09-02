sed -i '1s/^/export interface Profile {\n  id: string;\n  name: string;\n  lastActive?: number;\n}\n\n/' src/types.ts
