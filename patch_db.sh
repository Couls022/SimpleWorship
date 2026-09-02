sed -i '/async saveOutputGroup(group: OutputGroup) {/i\  async deleteOutputGroup(id: string) {\n    const db = await getDB();\n    await db.delete('\''outputGroups'\'', id);\n  },' src/db/index.ts
