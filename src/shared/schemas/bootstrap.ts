import { z } from 'zod';

/** Tab snapshot persisted in state.json */
export const TabSchema = z.object({
  id: z.string(),
  method: z.string(),
  url: z.string(),
  isDirty: z.boolean().default(false),
});

export type TabSnapshot = z.infer<typeof TabSchema>;

/** Extended bootstrap result including saved tab state (D-21). */
export const AppBootstrapResultSchema = z.object({
  firstRun: z.boolean(),
  userDataPath: z.string(),
  dataDir: z.string(),
  theme: z.enum(['system', 'dark', 'light']),
  savedTabs: z.array(TabSchema).default([]),
  activeTabId: z.string().nullable().default(null),
});

export type AppBootstrapResult = z.infer<typeof AppBootstrapResultSchema>;
