import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getUploadChunks, clearUploadChunks } from '../chunk/route'
import { inngest } from '@/inngest/client'

export async function POST(request: NextRequest) {
  try {
    const { uploadId, fileName } = await request.json()

    if (!uploadId || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get all chunks for this upload
    const chunks = getUploadChunks(uploadId)
    if (!chunks) {
      return NextResponse.json(
        { error: 'Upload not found or expired' },
        { status: 404 }
      )
    }

    // Sort chunks by chunk number
    const sortedChunks = Object.entries(chunks)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([, buffer]) => buffer)

    // Combine all chunks into a single buffer
    const totalSize = sortedChunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const combinedBuffer = Buffer.concat(sortedChunks, totalSize)

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const uniqueFileName = `${timestamp}-${fileName}`

    // Upload to Vercel Blob
    const blob = await put(uniqueFileName, combinedBuffer, {
      access: 'public',
      contentType: 'text/csv',
      addRandomSuffix: false
    })

    // Clean up chunks from memory
    clearUploadChunks(uploadId)

    // Send event to Inngest for CSV processing
    try {
      await inngest.send({
        name: 'csv.uploaded',
        data: {
          url: blob.url,
          fileName: uniqueFileName,
          uploadedAt: new Date().toISOString(),
        },
      })
      console.log('CSV processing event sent to Inngest')
    } catch (error) {
      console.error('Error sending Inngest event:', error)
      // Don't fail the upload if Inngest event fails
    }
    
    return NextResponse.json({
      success: true,
      url: blob.url,
      fileName: uniqueFileName,
      size: totalSize,
      message: 'File uploaded successfully'
    })

  } catch (error) {
    console.error('Upload completion error:', error)
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    )
  }
}
