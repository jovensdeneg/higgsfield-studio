import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "jdn-forge",
  // Event types pra type safety
});

// Tipos de eventos que o sistema dispara
export type ForgeEvents = {
  "forge/dispatch.images": { data: { assetIds: string[]; projectId: string } };
  "forge/dispatch.videos": { data: { assetIds: string[]; projectId: string } };
  "forge/poll.generation": { data: { jobId: string } };
  "forge/export": { data: { projectId: string } };
};
