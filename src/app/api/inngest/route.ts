import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { functions } from '@/inngest/functions'

// Create the Inngest webhook handler using the serve function
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
  streaming: false,
})
