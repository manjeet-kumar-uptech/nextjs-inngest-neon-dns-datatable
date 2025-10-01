import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { runMigrations } from '@/lib/migrate'

export async function GET() {
  try {
    console.log('🔍 Health check - checking database connection...')

    // Test database connection first
    let dbStatus = 'unknown'
    try {
      const testResult = await sql`SELECT 1 as test`
      dbStatus = 'connected'
      console.log('✅ Database connection successful:', testResult)
    } catch (dbError) {
      dbStatus = 'failed'
      console.error('❌ Database connection failed:', dbError)
    }

    // Check existing tables
    let tablesStatus = 'unknown'
    try {
      const existingTables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      tablesStatus = 'checked'
      console.log('📋 Existing tables:', existingTables.map(t => t.table_name))
    } catch (tableError) {
      tablesStatus = 'failed'
      console.error('❌ Table check failed:', tableError)
    }

    // Ensure database is initialized
    await runMigrations()

    // Final table check after migration
    let finalTablesStatus = 'unknown'
    try {
      const tablesAfter = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      finalTablesStatus = 'checked'
      console.log('📋 Final tables after migration:', tablesAfter.map(t => t.table_name))
    } catch (finalError) {
      finalTablesStatus = 'failed'
      console.error('❌ Final table check failed:', finalError)
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: {
        connection: dbStatus,
        existingTables: tablesStatus,
        finalTables: finalTablesStatus,
        urlConfigured: !!process.env.DATABASE_URL,
      },
      inngestConfigured: !!process.env.INNGEST_EVENT_KEY,
      blobConfigured: !!process.env.BLOB_READ_WRITE_TOKEN,
      databaseInitialized: true,
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      error: 'Health check failed',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
