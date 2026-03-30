import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrate: {
    async url() {
      return process.env.DATABASE_URL!;
    },
  },
});
