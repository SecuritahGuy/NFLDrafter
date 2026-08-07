import React, { useState, useEffect } from 'react'
import { CheckCircleIcon, CloudArrowUpIcon, UserIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useToast } from './Toast'

interface YahooOAuthProps {
  onAuthSuccess?: (accessToken: string, refreshToken: string) => void
  onAuthError?: (error: string) => void
  className?: string
}

interface YahooReadiness {
  configured: boolean
  client_id_configured: boolean
  client_secret_configured: boolean
  redirect_uri: string
  frontend_callback_uri: string
}

export const YahooOAuth: React.FC<YahooOAuthProps> = ({
  onAuthSuccess,
  onAuthError,
  className = ''
}) => {
  const { addToast } = useToast()
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [readiness, setReadiness] = useState<YahooReadiness | null>(null)

  // Check if user is already authenticated on component mount
  useEffect(() => {
    const checkReadiness = async () => {
      try {
        const response = await fetch('/api/yahoo/readiness')
        if (!response?.ok) throw new Error('Yahoo readiness check failed')
        setReadiness(await response.json())
      } catch {
        setReadiness(null)
      }
    }
    checkReadiness()
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      // Check if we have stored tokens
      const accessToken = localStorage.getItem('yahoo_access_token')
      const refreshToken = localStorage.getItem('yahoo_refresh_token')
      const expiresAt = Number(localStorage.getItem('yahoo_expires_at') || 0)
      
      if (accessToken && refreshToken) {
        if (expiresAt && Date.now() >= expiresAt - 60_000) {
          await refreshAccessToken(refreshToken)
          return
        }
        // Verify token is still valid
        const isValid = await verifyToken(accessToken)
        if (isValid) {
          setIsAuthenticated(true)
          await fetchUserInfo(accessToken)
          onAuthSuccess?.(accessToken, refreshToken)
        } else {
          // Token expired, try to refresh
          await refreshAccessToken(refreshToken)
        }
      }
    } catch (err) {
      console.error('Error checking auth status:', err)
      setError('Failed to check authentication status')
    }
  }

  const verifyToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/yahoo/verify-token', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      return response.ok
    } catch {
      return false
    }
  }

  const refreshAccessToken = async (refreshToken: string) => {
    try {
      const response = await fetch('/api/yahoo/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('yahoo_access_token', data.access_token)
        localStorage.setItem('yahoo_refresh_token', data.refresh_token)
        localStorage.setItem('yahoo_expires_at', String(Date.now() + data.expires_in * 1000))
        setIsAuthenticated(true)
        await fetchUserInfo(data.access_token)
        onAuthSuccess?.(data.access_token, data.refresh_token)
      } else {
        throw new Error('Failed to refresh token')
      }
    } catch (err) {
      console.error('Error refreshing token:', err)
      setIsAuthenticated(false)
      localStorage.removeItem('yahoo_access_token')
      localStorage.removeItem('yahoo_refresh_token')
      setError('Authentication expired. Please sign in again.')
      onAuthError?.('Authentication expired. Please sign in again.')
    }
  }

  const fetchUserInfo = async (accessToken: string) => {
    try {
      const response = await fetch('/api/yahoo/user-info', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setUserInfo(userData)
      }
    } catch (err) {
      console.error('Error fetching user info:', err)
    }
  }

  const initiateOAuth = async () => {
    setIsAuthenticating(true)
    setError(null)

    try {
      const stateBytes = crypto.getRandomValues(new Uint8Array(24))
      const oauthState = Array.from(stateBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      sessionStorage.setItem('yahoo_oauth_state', oauthState)

      const response = await fetch(`/api/yahoo/authorize-url?state=${encodeURIComponent(oauthState)}`)
      if (!response.ok) {
        throw new Error('Yahoo OAuth is not configured on the server')
      }
      const { authorize_url: authorizeUrl } = await response.json()
      window.location.href = authorizeUrl
    } catch (err) {
      console.error('Error initiating OAuth:', err)
      setError('Failed to start authentication process')
      onAuthError?.('Failed to start authentication process')
      setIsAuthenticating(false)
    }
  }

  const handleDisconnect = () => {
    localStorage.removeItem('yahoo_access_token')
    localStorage.removeItem('yahoo_refresh_token')
    localStorage.removeItem('yahoo_expires_at')
    setIsAuthenticated(false)
    setUserInfo(null)
    setError(null)
    addToast({
      type: 'info',
      title: 'Disconnected',
      message: 'Successfully disconnected from Yahoo Fantasy Football',
      duration: 3000
    })
  }

  if (isAuthenticating) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connecting to Yahoo...</h3>
          <p className="text-gray-600">Please complete the authentication in the new window</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Connected to Yahoo</h3>
              <p className="text-sm text-gray-600">{userInfo?.email || userInfo?.name || 'Fantasy Football Account'}</p>
            </div>
          </div>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Status</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Connected
            </span>
          </div>
          
          {userInfo?.leagues && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">Leagues</span>
              <span className="text-sm font-medium text-gray-900">{userInfo.leagues.length}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CloudArrowUpIcon className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Yahoo Fantasy Football</h3>
        <p className="text-gray-600">
          Import your leagues, rosters, and player data from Yahoo Fantasy Football
        </p>
      </div>

      {readiness && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${readiness.configured ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            {readiness.configured ? (
              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
            )}
            {readiness.configured ? 'Server ready for Yahoo OAuth' : 'Yahoo credentials are incomplete'}
          </div>
          <p className="mt-1 break-all text-xs text-slate-600">
            Registered callback: {readiness.redirect_uri}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      <button
        onClick={initiateOAuth}
        disabled={isAuthenticating || readiness?.configured === false}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        <CloudArrowUpIcon className="w-5 h-5" />
        Connect Yahoo Account
      </button>

      <div className="mt-4 text-xs text-gray-500 text-center">
        By connecting, you authorize NFLDrafter to access your Yahoo Fantasy Football data
      </div>
    </div>
  )
}
