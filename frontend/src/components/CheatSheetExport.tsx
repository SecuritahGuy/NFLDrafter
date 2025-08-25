import React, { useState } from 'react'
import type { Player } from '../types'

interface CheatSheetExportProps {
  players: Player[]
  scoringProfile?: string
  filters: {
    position?: string
    search?: string
    tier?: string
  }
  onExport: (format: 'csv' | 'pdf') => void
}

export const CheatSheetExport: React.FC<CheatSheetExportProps> = ({
  players,
  scoringProfile,
  filters,
  onExport
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv')
  const [includeFilters, setIncludeFilters] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(true)

  const handleExport = () => {
    onExport(exportFormat)
    setIsOpen(false)
  }

  const getFilterSummary = () => {
    const activeFilters = []
    if (filters.position) activeFilters.push(`Position: ${filters.position}`)
    if (filters.search) activeFilters.push(`Search: "${filters.search}"`)
    if (filters.tier) activeFilters.push(`Tier: ${filters.tier}`)
    return activeFilters.length > 0 ? activeFilters.join(', ') : 'All Players'
  }

  const getExportData = () => {
    return players.map(player => ({
      Rank: player.rank || 'N/A',
      Name: player.name,
      Position: player.position,
      Team: player.team,
      'My Points': player.fantasyPoints?.toFixed(1) || 'N/A',
      'Yahoo Points': player.yahooPoints?.toFixed(1) || 'N/A',
      'Δ': player.delta?.toFixed(1) || 'N/A',
      VORP: player.vorp?.toFixed(1) || 'N/A',
      Tier: player.tier || 'N/A',
      ADP: player.adp || 'N/A',
      'Bye Week': player.byeWeek || 'N/A',
      Notes: player.notes || ''
    } as Record<string, string | number>))
  }

  const exportToCSV = () => {
    const data = getExportData()
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `cheat-sheet-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportToPDF = () => {
    // For now, we'll use a simple approach that can be enhanced later
    // This creates a printable version that users can save as PDF
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const data = getExportData()
    const headers = Object.keys(data[0])
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fantasy Football Cheat Sheet</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .filters { margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .position-group { page-break-inside: avoid; margin-bottom: 20px; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Fantasy Football Cheat Sheet</h1>
            <p>${scoringProfile || 'Custom Scoring'}</p>
            <p>Generated: ${new Date().toLocaleDateString()}</p>
          </div>
          
          ${includeFilters ? `<div class="filters"><strong>Filters:</strong> ${getFilterSummary()}</div>` : ''}
          
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${headers.map(h => `<td>${row[h]}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()">Print / Save as PDF</button>
            <button onclick="window.close()">Close</button>
          </div>
        </body>
      </html>
    `
    
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const handleExportClick = () => {
    if (exportFormat === 'csv') {
      exportToCSV()
    } else {
      exportToPDF()
    }
    setIsOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn btn-primary flex items-center gap-2"
        title="Export Cheat Sheet"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Export Cheat Sheet</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={(e) => setExportFormat(e.target.value as 'csv')}
                      className="mr-2"
                    />
                    CSV
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="pdf"
                      checked={exportFormat === 'pdf'}
                      onChange={(e) => setExportFormat(e.target.value as 'pdf')}
                      className="mr-2"
                    />
                    PDF
                  </label>
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeFilters}
                    onChange={(e) => setIncludeFilters(e.target.checked)}
                    className="mr-2"
                  />
                  Include current filters in export
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="mr-2"
                  />
                  Include player notes
                </label>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Exporting:</strong> {players.length} players
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Filters:</strong> {getFilterSummary()}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsOpen(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExportClick}
                  className="btn btn-primary flex-1"
                >
                  Export {exportFormat.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
