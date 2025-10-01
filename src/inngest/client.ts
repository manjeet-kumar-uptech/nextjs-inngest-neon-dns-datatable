import { Inngest } from "inngest";

// Create a client to send and receive events
export const inngest = new Inngest({
  id: "nextjs-app",
  name: "Next.js Inngest App",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
  // In development, use local dev server
  // In production, use Inngest's cloud service
  baseUrl: process.env.NODE_ENV === 'development'
    ? 'http://localhost:8288'
    : process.env.INNGEST_BASE_URL,
});
