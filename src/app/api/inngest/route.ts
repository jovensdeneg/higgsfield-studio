import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
// Import functions when they exist
export const { GET, POST, PUT } = serve({ client: inngest, functions: [] });
