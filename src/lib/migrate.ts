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

    // Check user permissions before attempting table creation
    console.log('🔐 Checking database permissions...')
    try {
      const permissionsCheck = await sql`
        SELECT
          current_user as db_user,
          has_table_privilege(current_user, 'domains', 'CREATE') as can_create_table,
          has_schema_privilege(current_user, 'public', 'CREATE') as can_create_in_public,
          has_database_privilege(current_user, current_database(), 'CREATE') as can_create_in_db
      `
      console.log('🔐 User permissions:', permissionsCheck[0])
    } catch (permError) {
      console.error('❌ Permission check failed:', permError)
    }

    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql')
    console.log('📁 Schema file path:', schemaPath)

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`)
    }

    const schema = fs.readFileSync(schemaPath, 'utf8')
    console.log('📄 Schema file length:', schema.length)
    console.log('📄 Schema preview:', schema.substring(0, 150) + '...')

    // Execute the schema with detailed error handling
    console.log('⚡ Executing schema...')
    try {
      console.log('🔍 Executing SQL:', schema)

      // Try individual statements first to isolate issues
      const statements = schema.split(';').filter(stmt => stmt.trim().length > 0)
      console.log('📋 Found', statements.length, 'SQL statements')

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i].trim()
        if (stmt) {
          console.log(`🔄 Executing statement ${i + 1}:`, stmt.substring(0, 100) + '...')
          try {
            await sql.unsafe(stmt + ';')
            console.log(`✅ Statement ${i + 1} executed successfully`)
          } catch (stmtError) {
            console.error(`❌ Statement ${i + 1} failed:`, stmtError)
            console.error(`❌ Statement ${i + 1} error details:`, {
              message: stmtError instanceof Error ? stmtError.message : String(stmtError),
              code: stmtError instanceof Error && 'code' in stmtError ? String((stmtError as { code: unknown }).code) : 'unknown'
            })
            throw stmtError
          }
        }
      }

      console.log('✅ Schema execution completed')
    } catch (schemaError) {
      console.error('❌ Schema execution failed:', schemaError)
      console.error('❌ Schema error details:', {
        message: schemaError instanceof Error ? schemaError.message : String(schemaError),
        code: schemaError instanceof Error && 'code' in schemaError ? String((schemaError as { code: unknown }).code) : 'unknown',
        severity: schemaError instanceof Error && 'severity' in schemaError ? String((schemaError as { severity: unknown }).severity) : 'unknown',
        detail: schemaError instanceof Error && 'detail' in schemaError ? String((schemaError as { detail: unknown }).detail) : 'unknown',
        hint: schemaError instanceof Error && 'hint' in schemaError ? String((schemaError as { hint: unknown }).hint) : 'unknown'
      })

      // Try to create table manually if schema execution fails
      console.log('🔄 Attempting manual table creation...')
      try {
        console.log('🔄 Creating domains table manually...')
        await sql`
          CREATE TABLE IF NOT EXISTS domains (
            id BIGSERIAL PRIMARY KEY,
            raw TEXT NOT NULL,
            domain TEXT NOT NULL,
            has_mx BOOLEAN NOT NULL DEFAULT FALSE,
            mx JSONB NOT NULL DEFAULT '[]'::jsonb,
            spf TEXT,
            dmarc TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
          )
        `
        console.log('✅ Manual table creation successful')

        // Create index manually too
        await sql`CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains (domain)`
        console.log('✅ Manual index creation successful')
      } catch (manualError) {
        console.error('❌ Manual table creation also failed:', manualError)
        console.error('❌ Manual creation error details:', {
          message: manualError instanceof Error ? manualError.message : String(manualError),
          code: manualError instanceof Error && 'code' in manualError ? String((manualError as { code: unknown }).code) : 'unknown'
        })
        throw schemaError // Throw original error
      }
    }

    // Verify the table was created
    const tablesAfter = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    console.log('📋 Tables after migration:', tablesAfter.map(t => t.table_name))

    const domainsExistsAfter = tablesAfter.some(t => t.table_name === 'domains')
    console.log('📋 Domains table exists after migration:', domainsExistsAfter)

    if (!domainsExistsAfter) {
      console.error('❌ CRITICAL: Domains table still does not exist after all attempts!')
      console.error('❌ This indicates a serious database permission or configuration issue')
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
