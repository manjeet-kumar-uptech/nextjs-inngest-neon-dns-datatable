import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { normalizeDomain } from '@/lib/dns'
import { runMigrations } from '@/lib/migrate'

// Helper function to extract domain from various cell formats (same as in parseCsv.ts)
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

export async function POST(request: NextRequest) {
  try {
    // Ensure database is initialized (for consistency, even though test doesn't write to DB)
    await runMigrations()

    const { csvUrl } = await request.json()

    if (!csvUrl || typeof csvUrl !== 'string') {
      return NextResponse.json(
        { error: 'CSV URL is required and must be a string' },
        { status: 400 }
      )
    }

    console.log('🧪 Testing CSV parsing with URL:', csvUrl)

    // Download CSV content from URL
    const response = await fetch(csvUrl)
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download CSV from URL: ${response.statusText}` },
        { status: 400 }
      )
    }

    const csvContent = await response.text()
    console.log('✅ CSV downloaded, content length:', csvContent.length)

    // Parse CSV content with better configuration
    const parsed = Papa.parse<string[]>(csvContent, {
      skipEmptyLines: 'greedy',
      header: false,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim()
    })

    console.log('✅ Papa parsed result:', {
      dataLength: parsed.data.length,
      errors: parsed.errors,
      meta: parsed.meta
    })

    const potentialDomains: string[] = []

    // Extract domains from first column of each row
    for (let i = 0; i < parsed.data.length; i++) {
      const row = parsed.data[i]
      console.log(`📋 Processing row ${i}:`, row)

      if (Array.isArray(row) && row.length > 0) {
        const firstCell = row[0]
        console.log(`📋 First cell in row ${i}:`, firstCell)

        if (firstCell && firstCell.trim()) {
          // Try to extract domain from the cell value
          const potentialDomain = extractDomainFromCell(firstCell.trim())
          if (potentialDomain) {
            console.log(`📋 Extracted domain from row ${i}:`, potentialDomain)
            potentialDomains.push(potentialDomain)
          } else {
            console.log(`📋 No valid domain found in row ${i}:`, firstCell)
          }
        } else {
          console.log(`📋 Empty or invalid first cell in row ${i}`)
        }
      } else {
        console.log(`📋 Invalid row format at index ${i}:`, row)
      }
    }

    console.log('✅ Extracted potential domains:', potentialDomains.length)

    // Normalize and deduplicate domains
    const domains = Array.from(
      new Set(
        potentialDomains
          .map((domainStr) => normalizeDomain(domainStr))
          .filter((domain): domain is string => !!domain)
      )
    ).slice(0, 2000) // guardrail for demo

    console.log('✅ Final normalized domains:', domains.length)

    // Return test results
    return NextResponse.json({
      success: true,
      input: {
        csvUrl,
        csvLength: csvContent.length,
        totalRows: parsed.data.length,
        extractedRows: potentialDomains.length
      },
      output: {
        uniqueDomains: domains.length,
        sampleDomains: domains.slice(0, 10), // Show first 10 domains
        allDomains: domains // Include all for testing
      },
      parsingDetails: {
        papaErrors: parsed.errors,
        papaMeta: parsed.meta
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Test upload error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process CSV',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// Health check for the test endpoint
export async function GET() {
  return NextResponse.json({
    status: 'Test upload endpoint active',
    description: 'POST CSV URL to test parsing logic (mimics parseCsv function)',
    expectedFormat: {
      csvUrl: 'string (URL to CSV file)'
    },
    response: {
      input: '{ csvUrl, csvLength, totalRows, extractedRows }',
      output: '{ uniqueDomains, sampleDomains, allDomains }'
    },
    note: 'This endpoint downloads CSV from the provided URL and processes it exactly like the parseCsv Inngest function',
    timestamp: new Date().toISOString()
  })
}
