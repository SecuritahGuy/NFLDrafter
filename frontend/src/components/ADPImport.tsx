import React, { useState, useCallback } from 'react';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

export interface ADPData {
  player_name: string;
  adp: number;
  team?: string;
  position?: string;
}

export interface ADPImportProps {
  onADPImport: (adpData: ADPData[]) => void;
  currentADP?: Record<string, number>;
  className?: string;
}

export const ADPImport: React.FC<ADPImportProps> = ({
  onADPImport,
  currentADP = {},
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedData, setUploadedData] = useState<ADPData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processCSV = useCallback((csvText: string): ADPData[] => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // Validate required headers
    if (!headers.includes('player_name') || !headers.includes('adp')) {
      throw new Error('CSV must contain "player_name" and "adp" columns');
    }

    const nameIndex = headers.indexOf('player_name');
    const adpIndex = headers.indexOf('adp');
    const teamIndex = headers.includes('team') ? headers.indexOf('team') : -1;
    const positionIndex = headers.includes('position') ? headers.indexOf('position') : -1;

    const data: ADPData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 2) continue;

      const adp = parseFloat(values[adpIndex]);
      if (isNaN(adp) || adp <= 0) continue;

      data.push({
        player_name: values[nameIndex],
        adp: adp,
        team: teamIndex >= 0 ? values[teamIndex] : undefined,
        position: positionIndex >= 0 ? values[positionIndex] : undefined
      });
    }

    return data.sort((a, b) => a.adp - b.adp);
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const text = await file.text();
      const data = processCSV(text);
      
      if (data.length === 0) {
        throw new Error('No valid ADP data found in CSV');
      }
      
      setUploadedData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process CSV file');
    } finally {
      setIsProcessing(false);
    }
  }, [processCSV]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(f => f.type === 'text/csv' || f.name.endsWith('.csv'));
    
    if (csvFile) {
      handleFileUpload(csvFile);
    } else {
      setError('Please upload a valid CSV file');
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleImport = useCallback(() => {
    if (uploadedData.length > 0) {
      onADPImport(uploadedData);
      setUploadedData([]);
    }
  }, [uploadedData, onADPImport]);

  const handleClear = useCallback(() => {
    setUploadedData([]);
    setError(null);
  }, []);

  const getValueVsADP = useCallback((playerName: string, adp: number) => {
    const currentADPValue = currentADP[playerName];
    if (!currentADPValue) return null;
    
    const difference = currentADPValue - adp;
    return {
      value: difference,
      isValue: difference > 0,
      percentage: ((difference / adp) * 100).toFixed(1)
    };
  }, [currentADP]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
        <div className="mt-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Click to upload
            </span>
            <span className="text-gray-500"> or drag and drop</span>
          </label>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={handleFileInput}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          CSV file with columns: player_name, adp (required), team, position (optional)
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <XMarkIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Data Preview */}
      {uploadedData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                ADP Data Preview ({uploadedData.length} players)
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="btn btn-primary btn-sm"
                >
                  Import ADP Data
                </button>
                <button
                  onClick={handleClear}
                  className="btn btn-secondary btn-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>
                    Player
                  </th>
                  <th>
                    ADP
                  </th>
                  <th>
                    Team
                  </th>
                  <th>
                    Position
                  </th>
                  <th>
                    Value vs ADP
                  </th>
                </tr>
              </thead>
              <tbody>
                {uploadedData.slice(0, 10).map((player, index) => {
                  const valueVsADP = getValueVsADP(player.player_name, player.adp);
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {player.player_name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {player.adp}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {player.team || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {player.position || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {valueVsADP ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            valueVsADP.isValue 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {valueVsADP.isValue ? '+' : ''}{valueVsADP.value} ({valueVsADP.percentage}%)
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {uploadedData.length > 10 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-center text-sm text-gray-500">
                      ... and {uploadedData.length - 10} more players
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="text-center py-4">
          <div className="inline-flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm text-gray-600">Processing CSV...</span>
          </div>
        </div>
      )}
    </div>
  );
};
