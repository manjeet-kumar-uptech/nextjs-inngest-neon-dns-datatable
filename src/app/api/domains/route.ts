import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get domains data from database
    const domains = await sql`
      SELECT
        id,
        raw,
        domain,
        has_mx,
        mx,
        spf,
        dmarc,
        created_at
      FROM domains
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `

    // Get total count
    const totalCount = await sql`SELECT COUNT(*) as count FROM domains`
    const count = totalCount[0]?.count || 0

    return NextResponse.json({
      success: true,
      domains,
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    })

  } catch (error) {
    console.error('Error fetching domains:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch domains',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
