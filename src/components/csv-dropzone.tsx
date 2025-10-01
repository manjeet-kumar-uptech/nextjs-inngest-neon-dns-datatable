"use client"

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface UploadChunk {
  chunkNumber: number
  totalChunks: number
  chunkData: Blob
  fileName: string
  fileSize: number
}

interface UploadProgress {
  fileName: string
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
  uploadedUrl?: string
}

export function CsvDropzone() {
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const csvFiles = acceptedFiles.filter(file => 
      file.type === 'text/csv' || file.name.endsWith('.csv')
    )

    if (csvFiles.length === 0) {
      alert('Please upload CSV files only')
      return
    }

    setIsUploading(true)
    
    for (const file of csvFiles) {
      await uploadFileInChunks(file)
    }
    
    setIsUploading(false)
  }, [])

  const uploadFileInChunks = async (file: File) => {
    const chunkSize = 5 * 1024 * 1024 // 5MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)
    
    // Initialize upload progress
    const uploadId = `${file.name}-${Date.now()}`
    setUploads(prev => [...prev, {
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    }])

    try {
      // First, initiate multipart upload
      const initResponse = await fetch('/api/upload/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          totalChunks,
          mimeType: file.type
        })
      })

      if (!initResponse.ok) {
        throw new Error('Failed to initiate upload')
      }

      const { uploadId: serverUploadId, uploadUrl } = await initResponse.json()

      // Upload chunks in parallel (with limited concurrency)
      const uploadPromises: Promise<void>[] = []
      const maxConcurrent = 3
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, file.size)
        const chunk = file.slice(start, end)

        uploadPromises.push(
          uploadChunk({
            chunkNumber: i + 1,
            totalChunks,
            chunkData: chunk,
            fileName: file.name,
            fileSize: file.size,
          }, serverUploadId, i)
        )

        // Limit concurrent uploads
        if (uploadPromises.length >= maxConcurrent || i === totalChunks - 1) {
          await Promise.all(uploadPromises)
          uploadPromises.length = 0
          
          // Update progress
          const progress = Math.round(((i + 1) / totalChunks) * 100)
          setUploads(prev => prev.map(upload => 
            upload.fileName === file.name && upload.status === 'uploading'
              ? { ...upload, progress }
              : upload
          ))
        }
      }

      // Complete the multipart upload
      const completeResponse = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: serverUploadId,
          fileName: file.name
        })
      })

      if (!completeResponse.ok) {
        throw new Error('Failed to complete upload')
      }

      const { url } = await completeResponse.json()

      // Update status to completed
      setUploads(prev => prev.map(upload =>
        upload.fileName === file.name && upload.status === 'uploading'
          ? { ...upload, progress: 100, status: 'completed', uploadedUrl: url }
          : upload
      ))

      // Emit success event for the page to listen to
      window.dispatchEvent(new CustomEvent('csv-upload-success', {
        detail: {
          fileName: file.name,
          url,
          domains: 'Processing...' // Will be updated when processing completes
        }
      }))

    } catch (error) {
      console.error('Upload error:', error)
      setUploads(prev => prev.map(upload =>
        upload.fileName === file.name && upload.status === 'uploading'
          ? {
              ...upload,
              status: 'error',
              error: error instanceof Error ? error.message : 'Upload failed'
            }
          : upload
      ))

      // Emit error event for the page to listen to
      window.dispatchEvent(new CustomEvent('csv-upload-error', {
        detail: {
          error: error instanceof Error ? error.message : 'Upload failed'
        }
      }))
    }
  }

  const uploadChunk = async (chunk: UploadChunk, uploadId: string, chunkIndex: number) => {
    const formData = new FormData()
    formData.append('chunk', chunk.chunkData)
    formData.append('uploadId', uploadId)
    formData.append('chunkNumber', chunk.chunkNumber.toString())
    formData.append('totalChunks', chunk.totalChunks.toString())
    formData.append('fileName', chunk.fileName)

    const response = await fetch('/api/upload/chunk', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Failed to upload chunk ${chunk.chunkNumber}`)
    }

    return response.json()
  }

  const removeUpload = (fileName: string) => {
    setUploads(prev => prev.filter(upload => upload.fileName !== fileName))
  }

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: true,
    disabled: isUploading,
    noClick: true // Disable clicking on the dropzone area
  })

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300 cursor-pointer min-h-[200px] flex flex-col justify-center",
          isDragActive 
            ? "border-primary bg-primary/5 scale-[1.02] shadow-lg" 
            : "border-gray-200 hover:border-primary/50 hover:bg-muted/30 hover:shadow-md",
          isUploading && "opacity-50 pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-6">
          {/* Icon */}
          <div className={cn(
            "p-6 rounded-full transition-all duration-300",
            isDragActive 
              ? "bg-primary/10 text-primary scale-110" 
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}>
            <FileText className="h-12 w-12" />
          </div>

          {/* Content */}
          <div className="space-y-3">
            <h3 className="text-xl font-semibold">
              {isDragActive ? "Drop CSV file here" : "Upload CSV file"}
            </h3>
            <p className="text-base text-muted-foreground">
              Drag and drop your CSV file into this area
            </p>
          </div>
        </div>

        {/* Drag Overlay */}
        {isDragActive && (
          <div className="absolute inset-0 bg-primary/5 rounded-lg border-2 border-primary border-dashed" />
        )}
      </div>

      {/* Upload Button */}
      <Button
        type="button"
        onClick={open}
        disabled={isUploading}
        className="w-full h-14 text-lg font-medium"
        size="lg"
      >
        <Upload className="h-6 w-6 mr-3" />
        {isUploading ? "Uploading..." : "Choose CSV File"}
      </Button>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold">Uploads</h4>
            <span className="text-sm text-muted-foreground">
              {uploads.length} file{uploads.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="space-y-2">
            {uploads.map((upload) => (
              <div key={upload.fileName} className="border rounded-md p-3 bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <div className={cn(
                      "p-1.5 rounded-full",
                      upload.status === 'completed' ? "bg-green-100 text-green-600" :
                      upload.status === 'error' ? "bg-red-100 text-red-600" :
                      "bg-blue-100 text-blue-600"
                    )}>
                      {upload.status === 'completed' ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : upload.status === 'error' ? (
                        <AlertCircle className="h-3 w-3" />
                      ) : (
                        <FileText className="h-3 w-3" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{upload.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {upload.status === 'completed' && 'Completed'}
                        {upload.status === 'uploading' && 'Uploading...'}
                        {upload.status === 'error' && 'Failed'}
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUpload(upload.fileName)}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                {upload.status === 'uploading' && (
                  <div className="space-y-1">
                    <Progress value={upload.progress} className="h-1.5" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{upload.progress}%</span>
                      <span>Uploading...</span>
                    </div>
                  </div>
                )}

                {upload.error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {upload.error}
                  </div>
                )}

                {upload.uploadedUrl && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-green-700 font-medium">
                        ✅ Uploaded
                      </p>
                      <a 
                        href={upload.uploadedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:text-green-700 underline"
                      >
                        View
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
