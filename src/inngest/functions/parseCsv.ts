import { inngest } from '@/inngest/client'
import { sql } from '@/lib/db'
import { normalizeDomain as normalizeDomainUtil, lookupMX, lookupSPF, lookupDMARC } from '@/lib/dns'

// Define the event type for CSV uploads
type CsvUploadedEvent = {
  name: 'csv.uploaded'
  data: {
    url: string
    fileName: string
    uploadedAt: string
  }
}

// Create the CSV parsing function
export const parseCsv = inngest.createFunction(
  {
    id: 'parse-csv',
    retries: 3, // Add retry configuration for production reliability
  },
  { event: 'csv.uploaded' },
  async ({ event, step }) => {
    console.log("🚀 parseCsv function STARTED!")
    console.log("Event received:", JSON.stringify(event, null, 2))
    console.log("Environment:", process.env.NODE_ENV)
    console.log("Event name:", event.name)
    console.log("Event ID:", event.id)

    const { url, fileName, uploadedAt } = event.data as CsvUploadedEvent['data']

    console.log(`Processing CSV file: ${fileName}`)
    console.log(`File URL: ${url}`)
    console.log(`Upload timestamp: ${uploadedAt}`)

    // Step 1: Download and validate the CSV file
    const csvContent = await step.run('download-csv', async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to download CSV: ${response.statusText}`)
        }

        const content = await response.text()
        console.log(`Downloaded CSV content (${content.length} characters)`)

        // Basic CSV validation
        if (!content.trim()) {
          throw new Error('CSV file is empty')
        }

        const lines = content.split('\n').filter(line => line.trim())
        if (lines.length < 2) {
          throw new Error('CSV file must have at least a header and one data row')
        }

        return content
      } catch (error) {
        console.error('Error downloading CSV:', error)
        throw error
      }
    })

    // Step 2: Parse CSV content and identify domain columns
    const { headers, domainColumns } = await step.run('parse-csv-content', async () => {
      try {
        const lines = csvContent.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(header => header.trim().replace(/"/g, '').toLowerCase())

        console.log('CSV Headers:', headers)

        // Identify potential domain columns (common domain-related headers)
        const domainKeywords = ['domain', 'website', 'url', 'site', 'hostname', 'fqdn']
        const domainColumns = headers
          .map((header, index) => ({ header, index }))
          .filter(({ header }) =>
            domainKeywords.some(keyword => header.includes(keyword)) ||
            /\bdomain\b/i.test(header)
          )

        console.log(`Found ${domainColumns.length} potential domain columns:`, domainColumns)

        return { headers, domainColumns }
      } catch (error) {
        console.error('Error parsing CSV headers:', error)
        throw error
      }
    })

    // Step 3: Process CSV data in chunks of 10 rows, ignoring empty rows
    const processingStats = await step.run('process-csv-data', async () => {
      try {
        const lines = csvContent.split('\n').filter(line => line.trim())
        const dataLines = lines.slice(1) // Skip header

        console.log(`Processing ${dataLines.length} data rows in chunks of 10`)

        let processedRows = 0
        let emptyRows = 0
        const uniqueDomains = new Set<string>()

        // Process in chunks of 10 rows
        for (let i = 0; i < dataLines.length; i += 10) {
          const chunk = dataLines.slice(i, i + 10)
          console.log(`Processing chunk ${Math.floor(i / 10) + 1}: ${chunk.length} rows`)

          // Extract domains from this chunk
          const chunkDomains: Array<{raw: string, normalized: string}> = []

          for (const line of chunk) {
            if (!line.trim()) {
              emptyRows++
              continue
            }

            processedRows++

            // Parse the row
            const values = line.split(',').map(value => value.trim().replace(/"/g, ''))

            // Extract domains from identified columns
            for (const { index } of domainColumns) {
              if (values[index] && values[index].trim()) {
                const rawDomain = values[index].trim()

                // Use the existing normalizeDomain function from dns.ts
                const normalizedDomain = normalizeDomainUtil(rawDomain)

                if (normalizedDomain) {
                  uniqueDomains.add(normalizedDomain)
                  chunkDomains.push({ raw: rawDomain, normalized: normalizedDomain })
                }
              }
            }
          }

          // Process domains in chunks of 10 with Promise.all for DNS lookups
          if (chunkDomains.length > 0) {
            await processDomainsChunk(chunkDomains)
          }

          // Yield control to allow other functions to run
          await new Promise(resolve => setTimeout(resolve, 0))
        }

        console.log(`Processed ${processedRows} rows, skipped ${emptyRows} empty rows`)
        console.log(`Found ${uniqueDomains.size} unique domains`)

        return {
          fileName,
          url,
          uploadedAt,
          processedAt: new Date().toISOString(),
          stats: {
            totalRows: dataLines.length,
            processedRows,
            emptyRows,
            uniqueDomainsCount: uniqueDomains.size,
            domainColumns: domainColumns.length
          },
          uniqueDomains: Array.from(uniqueDomains).slice(0, 100), // Return first 100 unique domains
          domainColumns: domainColumns.map(col => col.header)
        }
      } catch (error) {
        console.error('Error processing CSV data:', error)
        throw error
      }
    })

    // Step 4: Final summary and cleanup
    await step.run('finalize-processing', async () => {
      try {
        console.log('CSV processing completed successfully!')
        console.log(`Processed ${processingStats.stats.processedRows} rows`)
        console.log(`Found ${processingStats.stats.uniqueDomainsCount} unique domains`)
        console.log(`Used ${processingStats.stats.domainColumns} domain columns`)

        return {
          success: true,
          message: 'CSV processing completed',
          stats: processingStats.stats
        }
      } catch (error) {
        console.error('Error in finalization:', error)
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    return {
      success: true,
      fileName,
      url,
      processingResult: processingStats
    }
  }
)

// Helper function to process domains in chunks of 10 with Promise.all for DNS lookups
async function processDomainsChunk(domains: Array<{raw: string, normalized: string}>) {
  try {
    console.log(`Processing chunk of ${domains.length} domains with Promise.all`)

    // Process domains in parallel using Promise.all for better performance
    const domainPromises = domains.map(async ({ raw, normalized }) => {
      try {
        // Perform all DNS lookups in parallel for this domain
        const [mxResult, spfRecord, dmarcRecord] = await Promise.all([
          lookupMX(normalized),
          lookupSPF(normalized),
          lookupDMARC(normalized)
        ])

        return {
          raw,
          domain: normalized,
          has_mx: mxResult.hasMX,
          mx: mxResult.mx,
          spf: spfRecord,
          dmarc: dmarcRecord
        }
      } catch (dnsError) {
        console.error(`DNS lookup failed for ${normalized}:`, dnsError)
        // Return domain with default values if DNS lookup fails
        return {
          raw,
          domain: normalized,
          has_mx: false,
          mx: [],
          spf: null,
          dmarc: null
        }
      }
    })

    // Wait for all DNS lookups to complete
    const domainData = await Promise.all(domainPromises)

    // Batch insert into database
    if (domainData.length > 0) {
      // Use a simple approach for batch inserts with Neon
      for (const domain of domainData) {
        await sql`
          INSERT INTO domains (raw, domain, has_mx, mx, spf, dmarc)
          VALUES (${domain.raw}, ${domain.domain}, ${domain.has_mx}, ${JSON.stringify(domain.mx)}, ${domain.spf}, ${domain.dmarc})
          ON CONFLICT (domain) DO UPDATE SET
            raw = EXCLUDED.raw,
            has_mx = EXCLUDED.has_mx,
            mx = EXCLUDED.mx,
            spf = EXCLUDED.spf,
            dmarc = EXCLUDED.dmarc,
            created_at = now()
        `
      }

      console.log(`Successfully processed and stored ${domainData.length} domains in database`)
    }

  } catch (error) {
    console.error('Error processing domain chunk:', error)
    throw error
  }
}

// Legacy function for backward compatibility (no longer used in main flow)
async function processDomainsBatch(domains: string[]) {
  try {
    console.log(`Processing batch of ${domains.length} domains`)

    // Convert string array to the format expected by processDomainsChunk
    const domainObjects = domains
      .map(raw => ({ raw, normalized: normalizeDomainUtil(raw) }))
      .filter(d => d.normalized !== null) as Array<{raw: string, normalized: string}>

    if (domainObjects.length > 0) {
      await processDomainsChunk(domainObjects)
    }

  } catch (error) {
    console.error('Error processing domain batch:', error)
    throw error
  }
}

