import { sql } from './db'
import fs from 'fs'
import path from 'path'

export async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...')
    console.log('🔗 Database URL configured:', !!process.env.DATABASE_URL)

    // Test database connection first
    try {
      const connectionTest = await sql`SELECT current_database(), current_user, version()`
      console.log('✅ Database connection successful:', {
        database: connectionTest[0].current_database,
        user: connectionTest[0].current_user,
        version: connectionTest[0].version
      })
    } catch (connError) {
      console.error('❌ Database connection test failed:', connError)
      throw connError
    }

    // First, let's check what tables exist
    const existingTables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    console.log('📋 Existing tables:', existingTables.map(t => t.table_name))

    // Check if domains table already exists
    const domainsExists = existingTables.some(t => t.table_name === 'domains')
    console.log('📋 Domains table already exists:', domainsExists)

    if (domainsExists) {
      console.log('✅ Domains table already exists, skipping migration')
      return
    }

    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql')
    console.log('📁 Schema file path:', schemaPath)

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`)
    }

    const schema = fs.readFileSync(schemaPath, 'utf8')
    console.log('📄 Schema file length:', schema.length)
    console.log('📄 Schema preview:', schema.substring(0, 200) + '...')

    // Execute the schema
    console.log('⚡ Executing schema...')
    await sql.unsafe(schema)
    console.log('✅ Schema execution completed')

    // Verify the table was created
    const tablesAfter = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    console.log('📋 Tables after migration:', tablesAfter.map(t => t.table_name))

    const domainsExistsAfter = tablesAfter.some(t => t.table_name === 'domains')
    console.log('📋 Domains table exists after migration:', domainsExistsAfter)

    if (!domainsExistsAfter) {
      throw new Error('Domains table was not created successfully')
    }

    console.log('✅ Database migrations completed successfully')

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
