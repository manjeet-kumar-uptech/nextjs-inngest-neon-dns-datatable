import { NextRequest, NextResponse } from 'next/server'
import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { parseCsv } from '@/inngest/functions/parseCsv'

// Create an Inngest API handler that serves all functions
export const { GET, POST } = serve({
  client: inngest,
  functions: [parseCsv],
  streaming: false,
})

// Optional: Add a separate endpoint for triggering CSV processing
export async function PUT(request: NextRequest) {
  try {
    const { url, fileName } = await request.json()

    if (!url || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields: url and fileName' },
        { status: 400 }
      )
    }

    // Send event to Inngest for CSV processing
    await inngest.send({
      name: 'csv.uploaded',
      data: {
        url,
        fileName,
        uploadedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'CSV processing event sent successfully',
      event: {
        name: 'csv.uploaded',
        data: { url, fileName }
      }
    })

  } catch (error) {
    console.error('Error sending Inngest event:', error)
    return NextResponse.json(
      { error: 'Failed to send CSV processing event' },
      { status: 500 }
    )
  }
}
