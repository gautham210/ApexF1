import { z } from "zod";
import { api } from "./client";

export const articleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  link: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//.test(value)),
  published: z.string().nullable(),
  ingested_at: z.string(),
  topics: z.array(z.string()),
});
export const newsFeedSchema = z.object({
  status: z.enum(["success", "partial", "stale"]),
  articles: z.array(articleSchema),
  errors: z.record(z.string()),
  ingested_at: z.string(),
});
export type Article = z.infer<typeof articleSchema>;
export async function getNewsFeed() {
  const response = await api.get<never, unknown>("/api/news/feed");
  return z.object({ success: z.literal(true), data: newsFeedSchema }).parse(response).data;
}
