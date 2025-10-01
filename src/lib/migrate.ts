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
      message: error.message,
      code: error.code,
      severity: error.severity,
      detail: error.detail,
      hint: error.hint
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
