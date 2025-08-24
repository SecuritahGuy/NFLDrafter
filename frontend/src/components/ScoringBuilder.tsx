import { useState } from 'react'
import { useScoringProfiles } from '../hooks/usePoints'

interface ScoringRule {
  stat_key: string
  multiplier: number
  per?: number
  bonus_min?: number
  bonus_max?: number
  bonus_points?: number
  cap?: number
}

export function ScoringBuilder() {
  const { data: profilesData, isLoading: profilesLoading } = useScoringProfiles()
  const [selectedProfile, setSelectedProfile] = useState<string>('')
  const [rules, setRules] = useState<ScoringRule[]>([
    { stat_key: 'passing_yards', multiplier: 0.04, per: 1 },
    { stat_key: 'passing_touchdowns', multiplier: 4.0 },
    { stat_key: 'rushing_yards', multiplier: 0.1, per: 1 },
    { stat_key: 'rushing_touchdowns', multiplier: 6.0 },
    { stat_key: 'receiving_yards', multiplier: 0.1, per: 1 },
    { stat_key: 'receiving_touchdowns', multiplier: 6.0 },
    { stat_key: 'receptions', multiplier: 0.5 },
  ])

  const addRule = () => {
    setRules([...rules, { stat_key: '', multiplier: 0 }])
  }

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const updateRule = (index: number, field: keyof ScoringRule, value: string | number | undefined) => {
    const newRules = [...rules]
    newRules[index] = { ...newRules[index], [field]: value }
    setRules(newRules)
  }

  const commonStats = [
    'passing_yards', 'passing_touchdowns', 'passing_interceptions',
    'rushing_yards', 'rushing_touchdowns',
    'receiving_yards', 'receiving_touchdowns', 'receptions',
    'fumbles_lost', 'field_goals_made', 'extra_points_made'
  ]

  if (profilesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading scoring profiles...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="text-2xl font-bold text-gray-900">Scoring Profile Builder</h2>
        </div>
        <div className="card-body">
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Existing Profile
          </label>
          <select
            value={selectedProfile}
            onChange={(e) => setSelectedProfile(e.target.value)}
            className="input"
          >
            <option value="">Create New Profile</option>
            {profilesData?.profiles.map((profile) => (
              <option key={profile.profile_id} value={profile.profile_id}>
                {profile.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Scoring Rules</h3>
            <button
              onClick={addRule}
              className="btn btn-primary"
            >
              Add Rule
            </button>
          </div>

          <div className="space-y-4">
            {rules.map((rule, index) => (
              <div key={index} className="grid grid-cols-7 gap-4 items-center p-4 border border-gray-200 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stat</label>
                  <select
                    value={rule.stat_key}
                    onChange={(e) => updateRule(index, 'stat_key', e.target.value)}
                    className="input"
                  >
                    <option value="">Select stat</option>
                    {commonStats.map((stat) => (
                      <option key={stat} value={stat}>
                        {stat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Multiplier</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rule.multiplier}
                    onChange={(e) => updateRule(index, 'multiplier', parseFloat(e.target.value) || 0)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Per</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rule.per || ''}
                    onChange={(e) => updateRule(index, 'per', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="1"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bonus Min</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rule.bonus_min || ''}
                    onChange={(e) => updateRule(index, 'bonus_min', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="100"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Bonus Points</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rule.bonus_points || ''}
                    onChange={(e) => updateRule(index, 'bonus_points', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="2"
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cap</label>
                  <input
                    type="number"
                    step="0.01"
                    value={rule.cap || ''}
                    onChange={(e) => updateRule(index, 'cap', e.target.value ? parseFloat(e.target.value) : undefined)}
                    placeholder="25"
                    className="input"
                  />
                </div>

                <div>
                  <button
                    onClick={() => removeRule(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button className="btn btn-secondary">
            Save Profile
          </button>
          <button className="btn btn-primary">
            Test Profile
          </button>
        </div>
      </div>
    </div>

    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">Profile Preview</h3>
      </div>
      <div className="card-body">
        <div className="bg-gray-50 p-4 rounded-lg">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap">
            {JSON.stringify(rules, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  </div>
  )
}
