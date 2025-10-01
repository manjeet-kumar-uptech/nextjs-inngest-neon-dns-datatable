import { NextRequest, NextResponse } from 'next/server'
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { parseCsv } from '@/inngest/functions'

// Test function to verify Inngest is working
const testFunction = inngest.createFunction(
  { id: 'test-function' },
  { event: 'test.event' },
  async ({ event, step }) => {
    console.log('🧪 Test function called!')
    console.log('Test event received:', JSON.stringify(event.data, null, 2))

    await step.run('test-step', async () => {
      console.log('✅ Test step executed successfully')
      return { success: true, message: 'Test completed' }
    })

    return { success: true, message: 'Test function completed' }
  }
)

// Create an Inngest API handler that serves all functions
// This handles webhook calls from Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [parseCsv, testFunction],
  streaming: false,
})
