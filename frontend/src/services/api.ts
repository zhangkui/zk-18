import axios from 'axios'

function getBaseUrl(): string {
  try {
    return import.meta.env.VITE_API_BASE_URL || '/api'
  } catch {
    return '/api'
  }
}

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: function (username: string, password: string) {
    return api.post('/users/login', { username, password })
  },
  getMe: function () {
    return api.get('/users/me')
  },
}

export const userAPI = {
  getAll: function (params?: Record<string, unknown>) { return api.get('/users/users', { params }) },
  getDetail: function (id: number) { return api.get('/users/users/' + id) },
  create: function (data: Record<string, unknown>) { return api.post('/users/users', data) },
  update: function (id: number, data: Record<string, unknown>) { return api.put('/users/users/' + id, data) },
  disable: function (id: number) { return api.put('/users/users/' + id + '/disable') },
  enable: function (id: number) { return api.put('/users/users/' + id + '/enable') },
  delete: function (id: number) { return api.delete('/users/users/' + id) },
}

export const showcaseAPI = {
  getAll: function () { return api.get('/showcases/showcases') },
  getDetail: function (id: number) { return api.get('/showcases/showcases/' + id) },
  getSensors: function (id: number) { return api.get('/showcases/showcases/' + id + '/sensors') },
  getProfile: function (id: number) { return api.get('/showcases/showcases/' + id + '/profile') },
  recalculateProfile: function (id: number) { return api.post('/showcases/showcases/' + id + '/profile/recalculate') },
  getDashboardStats: function () { return api.get('/showcases/dashboard/stats') },
  create: function (data: Record<string, unknown>) { return api.post('/showcases/showcases', data) },
  update: function (id: number, data: Record<string, unknown>) { return api.put('/showcases/showcases/' + id, data) },
  disable: function (id: number) { return api.put('/showcases/showcases/' + id + '/disable') },
  enable: function (id: number) { return api.put('/showcases/showcases/' + id + '/enable') },
  delete: function (id: number) { return api.delete('/showcases/showcases/' + id) },
}

export const sensorAPI = {
  getAll: function (params?: Record<string, unknown>) { return api.get('/sensors/sensors', { params }) },
  getDetail: function (id: number) { return api.get('/sensors/sensors/' + id) },
  create: function (data: Record<string, unknown>) { return api.post('/sensors/sensors', data) },
  update: function (id: number, data: Record<string, unknown>) { return api.put('/sensors/sensors/' + id, data) },
  disable: function (id: number) { return api.put('/sensors/sensors/' + id + '/disable') },
  enable: function (id: number) { return api.put('/sensors/sensors/' + id + '/enable') },
  delete: function (id: number) { return api.delete('/sensors/sensors/' + id) },
}

export const timeseriesAPI = {
  getSensorReadings: function (sensorId: number, params?: Record<string, unknown>) {
    return api.get('/timeseries/sensors/' + sensorId + '/readings', { params: params })
  },
  getShowcaseReadings: function (showcaseId: number, params?: Record<string, unknown>) {
    return api.get('/timeseries/showcases/' + showcaseId + '/readings', { params: params })
  },
  getLatestReading: function (sensorId: number) {
    return api.get('/timeseries/sensors/' + sensorId + '/latest')
  },
  createReading: function (sensorCode: string, value: number) {
    return api.post('/timeseries/sensors/readings', null, { params: { sensor_code: sensorCode, value: value } })
  },
  checkAnomaly: function (sensorId: number, value: number) {
    return api.get('/timeseries/sensors/' + sensorId + '/anomalies/check', { params: { value: value } })
  },
}

export const alertAPI = {
  getAll: function (params?: Record<string, unknown>) { return api.get('/alerts/alerts', { params: params }) },
  getDetail: function (id: number) { return api.get('/alerts/alerts/' + id) },
  create: function (data: Record<string, unknown>) { return api.post('/alerts/alerts', data) },
  acknowledge: function (id: number, operator?: string) {
    return api.put('/alerts/alerts/' + id + '/acknowledge', null, { params: { operator: operator || '管理员' } })
  },
  resolve: function (id: number, resolutionNote: string, operator?: string) {
    return api.put('/alerts/alerts/' + id + '/resolve', null, { params: { resolution_note: resolutionNote, operator: operator || '管理员' } })
  },
  getSummary: function () { return api.get('/alerts/alerts/summary') },
  getRecommendations: function (alertId: number) {
    return api.get('/alerts/alerts/' + alertId + '/interventions/recommend')
  },
}

export const interventionAPI = {
  getAll: function (params?: Record<string, unknown>) { return api.get('/interventions/interventions', { params: params }) },
  getDetail: function (id: number) { return api.get('/interventions/interventions/' + id) },
  create: function (data: Record<string, unknown>) { return api.post('/interventions/interventions', data) },
  start: function (id: number, operator?: string) {
    return api.put('/interventions/interventions/' + id + '/start', null, { params: { operator: operator || '管理员' } })
  },
  complete: function (id: number, resultNote: string, operator?: string) {
    return api.put('/interventions/interventions/' + id + '/complete', null, { params: { result_note: resultNote, operator: operator || '管理员' } })
  },
  getStrategies: function (params?: Record<string, unknown>) { return api.get('/interventions/strategies', { params: params }) },
  getStrategyDetail: function (id: number) { return api.get('/interventions/strategies/' + id) },
  createStrategy: function (data: Record<string, unknown>) { return api.post('/interventions/strategies', data) },
  updateStrategy: function (id: number, data: Record<string, unknown>) { return api.put('/interventions/strategies/' + id, data) },
  disableStrategy: function (id: number) { return api.put('/interventions/strategies/' + id + '/disable') },
  enableStrategy: function (id: number) { return api.put('/interventions/strategies/' + id + '/enable') },
  deleteStrategy: function (id: number) { return api.delete('/interventions/strategies/' + id) },
  getShowcaseRecommendations: function (showcaseId: number) {
    return api.get('/interventions/showcases/' + showcaseId + '/interventions/recommend')
  },
}

export const analyticsAPI = {
  getDispositions: function (params?: Record<string, unknown>) { return api.get('/analytics/dispositions', { params: params }) },
  createDisposition: function (data: Record<string, unknown>) { return api.post('/analytics/dispositions', data) },
  getShowcaseDispositions: function (showcaseId: number, params?: Record<string, unknown>) {
    return api.get('/analytics/showcases/' + showcaseId + '/dispositions', { params: params })
  },
  getShowcaseTrends: function (showcaseId: number, params?: Record<string, unknown>) {
    return api.get('/analytics/trends/showcases/' + showcaseId, { params: params })
  },
  analyzeTrend: function (params: Record<string, unknown>) {
    return api.post('/analytics/trends/analyze', null, { params: params })
  },
  getTrendsSummary: function (params?: Record<string, unknown>) { return api.get('/analytics/trends/summary', { params: params }) },
  getDispositionsSummary: function () { return api.get('/analytics/dispositions/summary') },
  autoGenerateTrends: function () { return api.post('/analytics/trends/auto-generate') },
  autoGenerateDispositions: function () { return api.post('/analytics/dispositions/auto-generate') },
}

const publicApi = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

publicApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Public API Error:', error)
    return Promise.reject(error)
  }
)

export const monitorAPI = {
  createShareLink: function (durationMinutes: number) {
    return api.post('/monitor/shares', { duration_minutes: durationMinutes })
  },
  validateShareLink: function (token: string) {
    return publicApi.get(`/monitor/shares/${token}/validate`)
  },
  getMonitorDashboardViaShare: function (token: string) {
    return publicApi.get(`/monitor/shares/${token}/dashboard`)
  },
  listShareLinks: function () {
    return api.get('/monitor/shares')
  },
  revokeShareLink: function (token: string) {
    return api.put(`/monitor/shares/${token}/revoke`)
  },
}

export default api
