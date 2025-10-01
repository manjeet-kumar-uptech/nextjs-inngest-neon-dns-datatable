import { NextResponse } from 'next/server'
import { runMigrations } from '@/lib/migrate'

export async function GET() {
  try {
    // Ensure database is initialized
    await runMigrations()

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      inngestConfigured: !!process.env.INNGEST_EVENT_KEY,
      databaseConfigured: !!process.env.DATABASE_URL,
      blobConfigured: !!process.env.BLOB_READ_WRITE_TOKEN,
      databaseInitialized: true,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      error: 'Database initialization failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
