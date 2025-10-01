import { NextRequest, NextResponse } from 'next/server'

// In-memory storage for upload chunks (use database in production)
const uploadChunks = new Map<string, { [key: number]: Buffer }>()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const chunk = formData.get('chunk') as File
    const uploadId = formData.get('uploadId') as string
    const chunkNumber = parseInt(formData.get('chunkNumber') as string)
    const totalChunks = parseInt(formData.get('totalChunks') as string)
    const fileName = formData.get('fileName') as string

    if (!chunk || !uploadId || !chunkNumber || !totalChunks || !fileName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Convert chunk to buffer
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())

    // Store chunk in memory
    if (!uploadChunks.has(uploadId)) {
      uploadChunks.set(uploadId, {})
    }
    uploadChunks.get(uploadId)![chunkNumber] = chunkBuffer

    // Check if all chunks are received
    const storedChunks = uploadChunks.get(uploadId)!
    const receivedChunks = Object.keys(storedChunks).length

    return NextResponse.json({
      success: true,
      chunkNumber,
      totalChunks,
      receivedChunks,
      isComplete: receivedChunks === totalChunks
    })

  } catch (error) {
    console.error('Chunk upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload chunk' },
      { status: 500 }
    )
  }
}

// Helper function to get upload chunks (used by complete endpoint)
export function getUploadChunks(uploadId: string) {
  return uploadChunks.get(uploadId)
}

// Helper function to clear upload chunks
export function clearUploadChunks(uploadId: string) {
  uploadChunks.delete(uploadId)
}
