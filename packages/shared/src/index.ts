import { z } from "zod";
export const actionSchema = z.enum(["save", "clipboard", "both"]);
export type ShareAction = z.infer<typeof actionSchema>;
export const settingsSchema = z.object({
  defaultAction: actionSchema,
  historyPageSize: z.number().int().min(5).max(100),
});
export type Settings = z.infer<typeof settingsSchema>;
export type ClipboardStatus = "queued" | "skipped" | "not_requested";
export interface ShareResponse {
  success: boolean;
  transferId: string;
  action: ShareAction;
  processedItems: Array<{
    label: string;
    mimeType: string;
    size: number;
    savedPath?: string;
  }>;
  savedPaths: string[];
  clipboardStatus: ClipboardStatus;
  validationErrors: string[];
}
