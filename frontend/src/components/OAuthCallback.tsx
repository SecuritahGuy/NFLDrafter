import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircleIcon, ExclamationTriangleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useToast } from './Toast'

export const OAuthCallback: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    handleOAuthCallback()
  }, [])

  const handleOAuthCallback = async () => {
    try {
      const code = searchParams.get('code')
      const error = searchParams.get('error')

      if (error) {
        setStatus('error')
        setError(error === 'access_denied' ? 'Authentication was cancelled' : error)
        return
      }

      if (!code) {
        setStatus('error')
        setError('No authorization code received')
        return
      }

      // Exchange code for tokens
      const response = await fetch('/api/yahoo/exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })

      if (!response.ok) {
        throw new Error('Failed to exchange authorization code')
      }

      const data = await response.json()
      
      // Store tokens
      localStorage.setItem('yahoo_access_token', data.access_token)
      localStorage.setItem('yahoo_refresh_token', data.refresh_token)

      setStatus('success')
      
      addToast({
        type: 'success',
        title: 'Connected Successfully!',
        message: 'Your Yahoo Fantasy Football account has been connected',
        duration: 5000
      })

      // Redirect back to draft room after a short delay
      setTimeout(() => {
        navigate('/draft', { replace: true })
      }, 2000)

    } catch (err) {
      console.error('OAuth callback error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Authentication failed')
    }
  }

  const handleRetry = () => {
    setStatus('processing')
    setError(null)
    handleOAuthCallback()
  }

  const handleBackToDraft = () => {
    navigate('/draft', { replace: true })
  }

  if (status === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Completing Authentication</h2>
          <p className="text-gray-600">
            Please wait while we complete your Yahoo Fantasy Football connection...
          </p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Successfully Connected!</h2>
          <p className="text-gray-600 mb-6">
            Your Yahoo Fantasy Football account has been connected successfully. You'll be redirected to the draft room shortly.
          </p>
          <button
            onClick={handleBackToDraft}
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Go to Draft Room
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
        <p className="text-gray-600 mb-6">
          {error || 'There was an error connecting your Yahoo Fantasy Football account.'}
        </p>
        
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Try Again
          </button>
          
          <button
            onClick={handleBackToDraft}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Back to Draft Room
          </button>
        </div>
      </div>
    </div>
  )
}
