import React, { useState, useEffect } from 'react'
import { Users, Building2, UserCheck, AlertTriangle, Filter } from 'lucide-react'
import { usersAPI, companiesAPI } from '../services/api'
import toast from 'react-hot-toast'
import DynamicMap from '../components/DynamicMap'

interface Stats {
  totalUsers: number
  verifiedUsers: number
  totalCompanies: number
  activeCompanies: number
  recentUsers: any[]
  recentCompanies: any[]
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    verifiedUsers: 0,
    totalCompanies: 0,
    activeCompanies: 0,
    recentUsers: [],
    recentCompanies: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [usersResponse, companiesResponse] = await Promise.all([
        usersAPI.getAllUsers(1, 50),
        companiesAPI.getAllCompanies()
      ])

      if (usersResponse.data.success && companiesResponse.data.success) {
        const users = usersResponse.data.data.users || []
        const companies = companiesResponse.data.data.companies || []

        setStats({
          totalUsers: users.length,
          verifiedUsers: users.filter((u: any) => u.is_email_verified).length,
          totalCompanies: companies.length,
          activeCompanies: companies.length, // All companies are active in new schema
          recentUsers: users.slice(0, 6),
          recentCompanies: companies.slice(0, 6)
        })
      }
    } catch (error: any) {
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  // safe percent helper to avoid divide-by-zero / NaN
  const percent = (part: number, total: number) =>
    total > 0 ? Math.round((part / total) * 100) : 0

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      change: `${stats.totalUsers} registered`
    },
    {
      title: 'Verified Users',
      value: stats.verifiedUsers,
      icon: UserCheck,
      color: 'bg-green-500',
      change: `${percent(stats.verifiedUsers, stats.totalUsers)}% verified`
    },
    {
      title: 'Total Companies',
      value: stats.totalCompanies,
      icon: Building2,
      color: 'bg-purple-500',
      change: `${stats.totalCompanies} approved`
    },
    {
      title: 'Active Companies',
      value: stats.activeCompanies,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      change: `${percent(stats.activeCompanies, stats.totalCompanies)}% active`
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        {/* changed border-primary-600 -> border-indigo-600 to avoid Tailwind missing custom color error */}
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600 text-lg">Overview of your platform statistics and recent activity</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="btn-secondary"
        >
          <Filter className="w-4 h-4 mr-2" />
          Refresh Data
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.title} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              <div className="flex items-center">
                <div className={`p-3 rounded-xl ${stat.color} shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <span className="text-xs text-gray-500 mt-1 block">{stat.change}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Users */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Users</h3>
          <div className="space-y-3">
            {stats.recentUsers.map((user: any) => (
              <div key={user._id ?? user.email} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center shadow-sm">
                    <span className="text-white font-medium text-xs">
                      {(user.firstName?.[0] ?? '').toUpperCase()}{(user.lastName?.[0] ?? '').toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {user.name ?? ''}
                    </p>
                    <p className="text-xs text-gray-500">{user.email ?? ''}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  {user.is_email_verified ? (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Companies */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Recent Companies</h3>
          <div className="space-y-3">
            {stats.recentCompanies.map((company: any) => (
              <div key={company._id ?? company.name} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-500 rounded-xl flex items-center justify-center shadow-sm">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{company.name ?? ''}</p>
                    <p className="text-xs text-gray-500">
                      {company.domain_name ? '1 domain' : '0 domains'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
      {/* Dynamic Map */}
      <div className="mb-8">
        <DynamicMap />
      </div>

  )
}
