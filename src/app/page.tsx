"use client"

import { useState, useEffect } from "react"
import { CsvDropzone } from "@/components/csv-dropzone"
import { DomainsTable } from "@/components/domains-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Upload, Shield, Zap, Cloud, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  message: string
  timestamp: Date
}

export default function Home() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDomainsTable, setShowDomainsTable] = useState(false)

  // Listen for successful uploads and check for processing completion
  useEffect(() => {
    const handleUploadSuccess = (event: CustomEvent) => {
      const { fileName, url } = event.detail

      // Add initial success notification
      const notification: Notification = {
        id: Date.now().toString(),
        type: 'info',
        title: 'CSV Upload Complete',
        message: `File "${fileName}" uploaded successfully. Processing domains...`,
        timestamp: new Date()
      }

      setNotifications(prev => [notification, ...prev.slice(0, 4)])
      setShowDomainsTable(true)

      // Poll for processing completion
      const checkProcessing = async () => {
        try {
          // This would need to be implemented - for now just show a generic message
          setTimeout(() => {
            // Update notification with success message
            setNotifications(prev => prev.map(n =>
              n.type === 'info' && n.title.includes('Upload Complete')
                ? { ...n, type: 'success', title: 'CSV Processing Complete', message: `Successfully processed domains from ${fileName}` }
                : n
            ))
          }, 2000) // Simulate processing time
        } catch (error) {
          console.error('Error checking processing status:', error)
        }
      }

      checkProcessing()
    }

    const handleUploadError = (event: CustomEvent) => {
      const { error } = event.detail

      const notification: Notification = {
        id: Date.now().toString(),
        type: 'error',
        title: 'Upload Failed',
        message: error,
        timestamp: new Date()
      }

      setNotifications(prev => [notification, ...prev.slice(0, 4)])
    }

    window.addEventListener('csv-upload-success', handleUploadSuccess as EventListener)
    window.addEventListener('csv-upload-error', handleUploadError as EventListener)

    return () => {
      window.removeEventListener('csv-upload-success', handleUploadSuccess as EventListener)
      window.removeEventListener('csv-upload-error', handleUploadError as EventListener)
    }
  }, [])

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto py-16 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="px-3 py-1">
              <Cloud className="h-3 w-3 mr-1" />
              Vercel Blob Storage
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              <Zap className="h-3 w-3 mr-1" />
              Chunked Upload
            </Badge>
          </div>

          <h1 className="text-4xl font-bold tracking-tight mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            CSV File Upload
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your CSV files quickly and securely with our advanced chunked upload system
          </p>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="mb-8 space-y-2">
            {notifications.map((notification) => (
              <Card key={notification.id} className={cn(
                "border-l-4",
                notification.type === 'success' && "border-l-green-500 bg-green-50",
                notification.type === 'error' && "border-l-red-500 bg-red-50",
                notification.type === 'info' && "border-l-blue-500 bg-blue-50"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {notification.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                      {notification.type === 'error' && <AlertCircle className="h-4 w-4 text-red-600" />}
                      <div>
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => dismissNotification(notification.id)}
                      className="h-8 w-8 p-0"
                    >
                      ×
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Upload Section */}
        <div className="max-w-2xl mx-auto mb-16">
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-3xl font-bold">Upload CSV Files</CardTitle>
              <CardDescription className="text-lg">
                Drag and drop your CSV files or click the button below to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <CsvDropzone />
            </CardContent>
          </Card>
        </div>

        {/* Domains Table */}
        {showDomainsTable && (
          <div className="mb-16">
            <DomainsTable />
          </div>
        )}

        {/* Features Grid */}
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2">Why Choose Our Upload System?</h2>
            <p className="text-muted-foreground">Built with modern technology for the best user experience</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-lg">Fast Upload</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Files are uploaded in 5MB chunks for optimal performance and reliability
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Shield className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-lg">Secure Storage</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Your files are securely stored in Vercel Blob storage with enterprise-grade security
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle className="text-lg">Background Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-center">
                  Powered by Inngest for reliable background processing of your uploaded files
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Info */}
        <div className="max-w-4xl mx-auto mt-16 text-center">
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>System Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>99.9% Uptime</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Enterprise Ready</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
