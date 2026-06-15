import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
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
  getAll: () => api.get('/showcases/showcases'),
  getDetail: (id: number) => api.get(`/showcases/showcases/${id}`),
  getSensors: (id: number) => api.get(`/showcases/showcases/${id}/sensors`),
  getProfile: (id: number) => api.get(`/showcases/showcases/${id}/profile`),
  recalculateProfile: (id: number) => api.post(`/showcases/showcases/${id}/profile/recalculate`),
  getDashboardStats: () => api.get('/showcases/dashboard/stats'),
}

export const timeseriesAPI = {
  getSensorReadings: (sensorId: number, params?: any) =>
    api.get(`/timeseries/sensors/${sensorId}/readings`, { params }),
  getShowcaseReadings: (showcaseId: number, params?: any) =>
    api.get(`/timeseries/showcases/${showcaseId}/readings`, { params }),
  getLatestReading: (sensorId: number) =>
    api.get(`/timeseries/sensors/${sensorId}/latest`),
  createReading: (sensorCode: string, value: number) =>
    api.post('/timeseries/sensors/readings', null, { params: { sensor_code: sensorCode, value } }),
  checkAnomaly: (sensorId: number, value: number) =>
    api.get(`/timeseries/sensors/${sensorId}/anomalies/check`, { params: { value } }),
}

export const alertAPI = {
  getAll: (params?: any) => api.get('/alerts/alerts', { params }),
  getDetail: (id: number) => api.get(`/alerts/alerts/${id}`),
  create: (data: any) => api.post('/alerts/alerts', data),
  acknowledge: (id: number, operator: string = '管理员') =>
    api.put(`/alerts/alerts/${id}/acknowledge`, null, { params: { operator } }),
  resolve: (id: number, resolutionNote: string, operator: string = '管理员') =>
    api.put(`/alerts/alerts/${id}/resolve`, null, { params: { resolution_note: resolutionNote, operator } }),
  getSummary: () => api.get('/alerts/alerts/summary'),
  getRecommendations: (alertId: number) =>
    api.get(`/alerts/alerts/${alertId}/interventions/recommend'),
}

export const interventionAPI = {
  getAll: (params?: any) => api.get('/interventions/interventions', { params }),
  getDetail: (id: number) => api.get(`/interventions/interventions/${id}`),
  create: (data: any) => api.post('/interventions/interventions', data),
  start: (id: number, operator: string = '管理员') =>
    api.put(`/interventions/interventions/${id}/start`, null, { params: { operator } }),
  complete: (id: number, resultNote: string, operator: string = '管理员') =>
    api.put(`/interventions/interventions/${id}/complete`, null, { params: { result_note: resultNote, operator } }),
  getStrategies: (params?: any) => api.get('/interventions/strategies', { params }),
  getStrategyDetail: (id: number) => api.get(`/interventions/strategies/${id}`),
  getShowcaseRecommendations: (showcaseId: number) =>
    api.get(`/interventions/showcases/${showcaseId}/interventions/recommend`),
}

export const analyticsAPI = {
  getDispositions: (params?: any) => api.get('/analytics/dispositions', { params }),
  createDisposition: (data: any) => api.post('/analytics/dispositions', data),
  getShowcaseDispositions: (showcaseId: number, params?: any) =>
    api.get(`/analytics/showcases/${showcaseId}/dispositions`, { params }),
  getShowcaseTrends: (showcaseId: number, params?: any) =>
    api.get(`/analytics/trends/showcases/${showcaseId}`, { params }),
  analyzeTrend: (params: any) => api.post('/analytics/trends/analyze', null, { params }),
  getTrendsSummary: (params?: any) => api.get('/analytics/trends/summary', { params }),
  getDispositionsSummary: () => api.get('/analytics/dispositions/summary'),
}

export const sensorAPI = {
  getAll: (params?: any) => api.get('/showcases/sensors', { params }),
  getDetail: (id: number) => api.get(`/showcases/sensors/${id}`),
}

export default api
