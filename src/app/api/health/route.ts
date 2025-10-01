import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    inngestConfigured: !!process.env.INNGEST_EVENT_KEY,
    databaseConfigured: !!process.env.DATABASE_URL,
    blobConfigured: !!process.env.BLOB_READ_WRITE_TOKEN,
  })
}
