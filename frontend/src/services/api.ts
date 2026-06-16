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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

export const showcaseAPI = {
  getAll: function () { return api.get('/showcases/showcases') },
  getDetail: function (id: number) { return api.get('/showcases/showcases/' + id) },
  getSensors: function (id: number) { return api.get('/showcases/showcases/' + id + '/sensors') },
  getProfile: function (id: number) { return api.get('/showcases/showcases/' + id + '/profile') },
  recalculateProfile: function (id: number) { return api.post('/showcases/showcases/' + id + '/profile/recalculate') },
  getDashboardStats: function () { return api.get('/showcases/dashboard/stats') },
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
}

export const sensorAPI = {
  getAll: function (params?: Record<string, unknown>) { return api.get('/showcases/sensors', { params: params }) },
  getDetail: function (id: number) { return api.get('/showcases/sensors/' + id) },
}

export default api
