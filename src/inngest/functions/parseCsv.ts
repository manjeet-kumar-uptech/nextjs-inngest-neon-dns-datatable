import { inngest } from "../client";
import Papa from "papaparse";
import { sql } from "@/lib/db";
import { lookupDMARC, lookupMX, lookupSPF, normalizeDomain } from "@/lib/dns";
import { runMigrations } from "@/lib/migrate";
import fs from 'fs'
import path from 'path'

// Helper function to extract domain from various cell formats
function extractDomainFromCell(cellValue: string): string | null {
  if (!cellValue || cellValue.trim().length === 0) {
    return null;
  }

  let domain = cellValue.trim().toLowerCase();

  // Handle email format: user@domain.com -> domain.com
  if (domain.includes('@')) {
    const parts = domain.split('@');
    if (parts.length === 2 && parts[1]) {
      domain = parts[1];
    } else {
      return null; // Invalid email format
    }
  }

  // Handle URL format: https://domain.com/path -> domain.com
  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    try {
      const url = new URL(domain.startsWith('http') ? domain : 'https://' + domain);
      domain = url.hostname;
    } catch {
      return null; // Invalid URL format
    }
  }

  // Remove www prefix
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }

  // Remove path/query parameters
  if (domain.includes('/')) {
    domain = domain.split('/')[0];
  }

  // Basic domain validation - must have at least one dot and TLD
  if (!domain.includes('.') || domain.split('.').pop()?.length === 0) {
    return null;
  }

  // Must be at least 3 characters (a.bc)
  if (domain.length < 3) {
    return null;
  }

  return domain;
}

export const parseCsvFn = inngest.createFunction(
  { id: "parse-csv-and-enrich" },
  { event: "csv.uploaded" },
  async ({ event, step }) => {
    const { url, fileName, uploadedAt } = event.data;

    console.log('🚀 Processing uploaded CSV:', fileName);
    console.log('📁 File URL:', url);

    // Ensure database is initialized before processing
    await step.run('initialize-database', async () => {
      console.log('🔄 Initializing database connection...')

      // Test database connection first
      try {
        const testResult = await sql`SELECT 1 as test`
        console.log('✅ Database connection test:', testResult)
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError)
        console.error('❌ DB Error details:', {
          message: dbError instanceof Error ? dbError.message : String(dbError),
          code: dbError instanceof Error && 'code' in dbError ? String((dbError as { code: unknown }).code) : 'unknown'
        })
        throw dbError
      }

      // Run migrations and verify table creation
      await runMigrations();

      // Double-check table exists after migration
      const tableCheckAfter = await sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'domains')`
      console.log('📋 Domains table exists after migration:', tableCheckAfter[0].exists)

      return { initialized: true };
    });

    // 1) Download and parse CSV from blob URL
    const csvContent = await step.run("download csv", async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download CSV: ${response.statusText}`);
      }
      return await response.text();
    });

    console.log('✅ CSV downloaded, length:', csvContent.length);

    // 2) Parse CSV and extract domains
    const allRows = await step.run("parse csv", async () => {
      // Parse CSV with better configuration
      const parsed = Papa.parse<string[]>(csvContent, {
        skipEmptyLines: 'greedy', // Skip empty lines more aggressively
        header: false, // Don't treat first row as headers
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => value.trim()
      });

      console.log('✅ Papa parsed result:', {
        dataLength: parsed.data.length,
        errors: parsed.errors,
        meta: parsed.meta
      });

      const extractedDomains: string[] = [];

      // Extract domains from first column of each row
      for (let i = 0; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        console.log(`📋 Processing row ${i}:`, row);

        if (Array.isArray(row) && row.length > 0) {
          const firstCell = row[0];
          console.log(`📋 First cell in row ${i}:`, firstCell);

          if (firstCell && firstCell.trim()) {
            // Try to extract domain from the cell value
            // Handle various formats: plain domain, email, URL, etc.
            const potentialDomain = extractDomainFromCell(firstCell.trim());
            if (potentialDomain) {
              console.log(`📋 Extracted domain from row ${i}:`, potentialDomain);
              extractedDomains.push(potentialDomain);
            } else {
              console.log(`📋 No valid domain found in row ${i}:`, firstCell);
            }
          } else {
            console.log(`📋 Empty or invalid first cell in row ${i}`);
          }
        } else {
          console.log(`📋 Invalid row format at index ${i}:`, row);
        }
      }

      console.log('✅ Extracted domains from CSV:', extractedDomains.length);
      return extractedDomains;
    });

    console.log('✅ All extracted potential domains:', allRows.length);

    // 3) Normalize and deduplicate domains
    const domains = Array.from(
      new Set(
        allRows
          .map((domainStr) => normalizeDomain(domainStr))
          .filter((domain): domain is string => !!domain)
      )
    ).slice(0, 2000); // guardrail for demo

    console.log('✅ Final normalized domains:', domains.length);
    console.log('📋 Sample domains:', domains.slice(0, 5));

    if (domains.length === 0) return { success: true, processed: 0, domains: 0 };

    // 3) Enrich with DNS (parallel but with small batch to avoid resolver flood)
    const BATCH = 10;
    const out: { raw: string; domain: string; has_mx: boolean; mx: { exchange: string; priority: number }[]; spf: string | null; dmarc: string | null }[] = [];

    for (let i = 0; i < domains.length; i += BATCH) {
      const slice = domains.slice(i, i + BATCH);
      const results = await Promise.all(
        slice.map(async (domain) => {
          const [mx, spf, dmarc] = await Promise.all([
            lookupMX(domain),
            lookupSPF(domain),
            lookupDMARC(domain),
          ]);
          return {
            raw: domain,
            domain,
            has_mx: mx.hasMX,
            mx: mx.mx,
            spf: spf ?? null,
            dmarc: dmarc ?? null,
          };
        })
      );
      out.push(...results);
      // tiny breath
      await new Promise((r) => setTimeout(r, 50));
    }

    // 4) Bulk insert into Neon using UNNEST
    // Build arrays for each column
    const rawArr = out.map((o) => o.raw);
    const domainArr = out.map((o) => o.domain);
    const hasMxArr = out.map((o) => o.has_mx);
    const mxArr = out.map((o) => JSON.stringify(o.mx));
    const spfArr = out.map((o) => o.spf);
    const dmarcArr = out.map((o) => o.dmarc);

    await step.run("bulk insert", async () => {
      console.log('🔄 Starting bulk insert...')

      // First, ensure migration runs in this step too (in case of isolation)
      await runMigrations();

      // Check if table exists before inserting
      const tableCheck = await sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'domains')`
      console.log('📋 Domains table exists in bulk insert step:', tableCheck[0].exists)

      if (!tableCheck[0].exists) {
        // Try to create table manually if migration didn't work
        console.log('⚠️ Table not found, attempting manual creation...')
        const schemaPath = path.join(process.cwd(), 'src/lib/schema.sql')
        const schema = fs.readFileSync(schemaPath, 'utf8')
        await sql.unsafe(schema)

        // Check again
        const tableCheckAfter = await sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'domains')`
        console.log('📋 Domains table exists after manual creation:', tableCheckAfter[0].exists)

        if (!tableCheckAfter[0].exists) {
          throw new Error('Failed to create domains table even after manual creation attempt')
        }
      }

      console.log('📊 Inserting', rawArr.length, 'domains...')

      // language=PostgreSQL
      const insertResult = await sql`
        INSERT INTO domains (raw, domain, has_mx, mx, spf, dmarc)
        SELECT * FROM unnest(
          ${rawArr}::text[],
          ${domainArr}::text[],
          ${hasMxArr}::boolean[],
          ${mxArr}::jsonb[],
          ${spfArr}::text[],
          ${dmarcArr}::text[]
        )`

      console.log('✅ Bulk insert completed, result:', insertResult)
    });

    console.log('✅ Bulk insert completed');

    return {
      success: true,
      fileName,
      url,
      processed: out.length,
      domains: domains.length
    };
  }
);
