import { z } from "zod";
const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  UPLOAD_CONTAINER_DIR: z.string().default("/data/uploads"),
  DATABASE_PATH: z.string().default("/data/database/passthrough.sqlite"),
  CLIPBOARD_DIR: z.string().default("/data/clipboard"),
  AUTH_TOKEN: z.string().min(16),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(52428800),
});
export type Config = z.infer<typeof schema>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config =>
  schema.parse(env);
