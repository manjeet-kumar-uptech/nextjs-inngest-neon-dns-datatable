"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, CheckCircle, XCircle, Shield, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Domain {
  id: number
  raw: string
  domain: string
  has_mx: boolean
  mx: any[]
  spf: string | null
  dmarc: string | null
  created_at: string
}

interface DomainsTableProps {
  onRefresh?: () => void
  isLoading?: boolean
  onDataUpdate?: () => void
}

export function DomainsTable({ onRefresh, isLoading, onDataUpdate }: DomainsTableProps) {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDomains = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/domains?limit=100')
      const data = await response.json()

      if (data.success) {
        setDomains(data.domains)
        onDataUpdate?.() // Notify parent that data was updated
      } else {
        setError(data.error || 'Failed to fetch domains')
      }
    } catch (err) {
      setError('Failed to fetch domains')
      console.error('Error fetching domains:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDomains()
  }, [])

  const handleRefresh = () => {
    fetchDomains()
    onRefresh?.()
  }

  if (loading && domains.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Loading domains...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-red-500 mb-4">⚠️ Error: {error}</div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (domains.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground mb-4">No domains found</div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Processed Domains</CardTitle>
            <CardDescription>
              {domains.length} domains found
            </CardDescription>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Domain</th>
                <th className="text-left p-2 font-medium">MX</th>
                <th className="text-left p-2 font-medium">SPF</th>
                <th className="text-left p-2 font-medium">DMARC</th>
                <th className="text-left p-2 font-medium">Raw</th>
                <th className="text-left p-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => (
                <tr key={domain.id} className="border-b hover:bg-muted/50">
                  <td className="p-2">
                    <div className="font-medium">{domain.domain}</div>
                  </td>
                  <td className="p-2">
                    {domain.has_mx ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Has MX
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="h-3 w-3 mr-1" />
                        No MX
                      </Badge>
                    )}
                  </td>
                  <td className="p-2">
                    {domain.spf ? (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        <Shield className="h-3 w-3 mr-1" />
                        SPF
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-2">
                    {domain.dmarc ? (
                      <Badge variant="default" className="bg-purple-100 text-purple-800">
                        <Shield className="h-3 w-3 mr-1" />
                        DMARC
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="p-2">
                    <span className="text-xs text-muted-foreground max-w-32 truncate block">
                      {domain.raw}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(domain.created_at).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
