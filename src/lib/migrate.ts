import { sql } from './db'
import fs from 'fs'
import path from 'path'

export async function runMigrations() {
  try {
    console.log('🔄 Running database migrations...')

    // Read the schema file
    const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf8')

    // Execute the schema
    await sql.unsafe(schema)

    console.log('✅ Database migrations completed successfully')
  } catch (error) {
    console.error('❌ Database migration failed:', error)

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
