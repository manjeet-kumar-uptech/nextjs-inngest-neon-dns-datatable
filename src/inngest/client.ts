import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "nextjs-app",
  name: "Next.js Inngest App",
  eventKey: process.env.INNGEST_EVENT_KEY,
  apiKey: process.env.INNGEST_SIGNING_KEY,
  
  // In development, Inngest will automatically connect to the Inngest Dev Server
  // In production, you'll need to set the INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY environment variables
});
