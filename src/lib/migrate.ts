import { sql } from './db'
import fs from 'fs'
import path from 'path'

export async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...')

    // First, let's check what tables exist
    const existingTables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    console.log('📋 Existing tables:', existingTables.map(t => t.table_name))

    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')
    console.log('📄 Schema file length:', schema.length)

    // Execute the schema
    await sql.unsafe(schema)

    console.log('✅ Database migrations completed successfully')

    // Verify the table was created
    const tablesAfter = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    console.log('📋 Tables after migration:', tablesAfter.map(t => t.table_name))

  } catch (error) {
    console.error('❌ Database migration failed:', error)
    console.error('❌ Error details:', {
      message: error instanceof Error ? error.message : String(error),
      code: error instanceof Error && 'code' in error ? String((error as { code: unknown }).code) : 'unknown',
      severity: error instanceof Error && 'severity' in error ? String((error as { severity: unknown }).severity) : 'unknown',
      detail: error instanceof Error && 'detail' in error ? String((error as { detail: unknown }).detail) : 'unknown',
      hint: error instanceof Error && 'hint' in error ? String((error as { hint: unknown }).hint) : 'unknown'
    })

    // Check if it's a "relation already exists" error
    if (error instanceof Error &&
        (error.message.includes('already exists') ||
         error.message.includes('relation "domains" already exists'))) {
      console.log('✅ Table already exists, skipping migration')
      return
    }

    // For other errors, re-throw
    throw error
  }
}
