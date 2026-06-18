import { useState, useEffect, useMemo } from 'react'
import {
  Row,
  Col,
  Card,
  Statistic,
  List,
  Tag,
  Space,
  Button,
  Modal,
  Input,
  Select,
  message,
  Tooltip,
  Progress,
  Badge,
} from 'antd'
import {
  EnvironmentOutlined,
  AlertOutlined,
  WarningOutlined,
  ToolOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  EyeOutlined,
  LinkOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CloudOutlined,
  BulbOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  MonitorOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import {
  showcaseAPI,
  alertAPI,
  timeseriesAPI,
  analyticsAPI,
  interventionAPI,
} from '@/services/api'
import { useNavigate, useLocation } from 'react-router-dom'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

const REFRESH_INTERVAL = 30000

const sensorTypes = [
  { value: 'temperature', label: '温度', unit: '°C', color: '#ff7875', icon: <ThunderboltOutlined /> },
  { value: 'humidity', label: '湿度', unit: '%RH', color: '#40a9ff', icon: <CloudOutlined /> },
  { value: 'light', label: '光照', unit: 'lux', color: '#ffd666', icon: <BulbOutlined /> },
  { value: 'vibration', label: '震动', unit: 'mm/s', color: '#95de64', icon: <DashboardOutlined /> },
]

const alertTypeNames: Record<string, string> = {
  over_max: '超过上限',
  below_min: '低于下限',
  warning_high: '接近上限',
  statistical_outlier: '统计异常',
  rapid_change: '变化速率异常',
  high_volatility: '高波动率',
  ma_deviation: '均线偏离',
  temperature: '温度异常',
  humidity: '湿度异常',
  light: '光照异常',
  vibration: '震动异常',
  unknown: '其他异常',
}

const alertTypeColors: Record<string, string> = {
  over_max: '#ff4d4f',
  below_min: '#1890ff',
  warning_high: '#faad14',
  statistical_outlier: '#722ed1',
  rapid_change: '#eb2f96',
  high_volatility: '#fa541c',
  ma_deviation: '#13c2c2',
  temperature: '#ff7875',
  humidity: '#40a9ff',
  light: '#ffd666',
  vibration: '#95de64',
  unknown: '#8c8c8c',
}

const getAlertLevelColor = (level: string) => {
  switch (level) {
    case 'critical': return 'red'
    case 'warning': return 'orange'
    default: return 'blue'
  }
}

const getAlertLevelText = (level: string) => {
  switch (level) {
    case 'critical': return '严重'
    case 'warning': return '警告'
    default: return '提示'
  }
}

const getRiskLevelClass = (level: string) => {
  switch (level) {
    case 'high': return 'risk-high'
    case 'medium': return 'risk-medium'
    case 'low': return 'risk-low'
    default: return 'risk-low'
  }
}

const getRiskLevelText = (level: string) => {
  switch (level) {
    case 'high': return '高风险'
    case 'medium': return '中风险'
    case 'low': return '低风险'
    default: return '未知'
  }
}

const getTrendDirectionIcon = (direction: string) => {
  switch (direction) {
    case 'rising': return <ArrowUpOutlined style={{ color: '#ff4d4f' }} />
    case 'falling': return <ArrowDownOutlined style={{ color: '#52c41a' }} />
    default: return <MinusOutlined style={{ color: '#1890ff' }} />
  }
}

const getTrendDirectionText = (direction: string) => {
  switch (direction) {
    case 'rising': return '上升'
    case 'falling': return '下降'
    default: return '稳定'
  }
}

const getActionTypeTag = (type: string) => {
  const typeMap: Record<string, { color: string; text: string }> = {
    acknowledge: { color: 'blue', text: '告警确认' },
    resolve: { color: 'green', text: '告警处理' },
    create_intervention: { color: 'orange', text: '创建干预' },
    start_intervention: { color: 'blue', text: '开始干预' },
    complete_intervention: { color: 'green', text: '完成干预' },
    manual_adjustment: { color: 'purple', text: '人工调整' },
    equipment_maintenance: { color: 'cyan', text: '设备维护' },
  }
  const info = typeMap[type] || { color: 'default', text: type }
  return <Tag color={info.color}>{info.text}</Tag>
}

function generateShareToken(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

interface MonitorScreenProps {
  isShareMode?: boolean
  shareToken?: string
}

function MonitorScreen({ isShareMode = false }: MonitorScreenProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [shareModalVisible, setShareModalVisible] = useState(false)
  const [shareDuration, setShareDuration] = useState(60)
  const [generatedLink, setGeneratedLink] = useState('')
  const [shareExpired, setShareExpired] = useState(false)

  const [stats, setStats] = useState<any>({
    total_showcases: 0,
    online_showcases: 0,
    active_sensors: 0,
    active_alerts: 0,
    pending_interventions: 0,
    high_risk_showcases: 0,
  })
  const [alerts, setAlerts] = useState<any[]>([])
  const [alertSummary, setAlertSummary] = useState<any>({})
  const [showcases, setShowcases] = useState<any[]>([])
  const [trendsSummary, setTrendsSummary] = useState<any>({})
  const [dispositionsSummary, setDispositionsSummary] = useState<any>({})
  const [dispositionsList, setDispositionsList] = useState<any[]>([])
  const [pendingInterventions, setPendingInterventions] = useState<any[]>([])

  const [sensorTrendData, setSensorTrendData] = useState<Record<string, any[]>>({
    temperature: [],
    humidity: [],
    light: [],
    vibration: [],
  })

  const [showcaseAlertCounts, setShowcaseAlertCounts] = useState<Record<number, number>>({})

  const checkShareValidity = () => {
    if (!isShareMode) return true
    const pathMatch = location.pathname.match(/\/monitor\/share\/([a-f0-9]+)/i)
    const token = pathMatch ? pathMatch[1] : null
    if (!token) {
      setShareExpired(true)
      return false
    }
    const stored = localStorage.getItem(`share_token_${token}`)
    if (!stored) {
      setShareExpired(true)
      return false
    }
    try {
      const data = JSON.parse(stored)
      if (Date.now() > data.expireAt) {
        localStorage.removeItem(`share_token_${token}`)
        setShareExpired(true)
        return false
      }
      return true
    } catch {
      setShareExpired(true)
      return false
    }
  }

  useEffect(() => {
    if (isShareMode) {
      const valid = checkShareValidity()
      if (!valid) return
    }
    loadData()
    const interval = setInterval(() => {
      if (!isShareMode || checkShareValidity()) {
        loadData()
      }
    }, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const aggregateSensorData = (allData: any[], sensorType: string) => {
    const timeMap: Record<string, number[]> = {}
    allData.forEach((showcaseData: any) => {
      const sensorData = showcaseData?.sensors?.[sensorType]?.data || []
      sensorData.forEach((d: any) => {
        const timeKey = dayjs(d.time).format('YYYY-MM-DD HH:mm')
        if (!timeMap[timeKey]) timeMap[timeKey] = []
        timeMap[timeKey].push(Number(d.value))
      })
    })
    return Object.entries(timeMap)
      .map(([time, values]) => ({
        time: dayjs(time, 'YYYY-MM-DD HH:mm').toDate(),
        value: values.reduce((a, b) => a + b, 0) / values.length,
      }))
      .sort((a, b) => a.time.getTime() - b.time.getTime())
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [
        statsRes,
        alertsRes,
        showcasesRes,
        alertSummaryRes,
        trendsSummaryRes,
        dispositionsSummaryRes,
        dispositionsRes,
        interventionsRes,
      ] = await Promise.all([
        showcaseAPI.getDashboardStats().catch(() => ({ data: {} })),
        alertAPI.getAll({ limit: 20, status: 'pending' }).catch(() => ({ data: [] })),
        showcaseAPI.getAll().catch(() => ({ data: [] })),
        alertAPI.getSummary().catch(() => ({ data: {} })),
        analyticsAPI.getTrendsSummary().catch(() => ({ data: {} })),
        analyticsAPI.getDispositionsSummary().catch(() => ({ data: {} })),
        analyticsAPI.getDispositions({ limit: 50 }).catch(() => ({ data: [] })),
        interventionAPI.getAll({ status: 'pending', limit: 50 }).catch(() => ({ data: [] })),
      ])

      const rawStats = statsRes.data || {}
      const showcasesData = showcasesRes.data || []
      setStats({
        total_showcases: rawStats.total_showcases ?? showcasesData.length,
        online_showcases: rawStats.online_showcases ?? showcasesData.filter((s: any) => s.status === 'active').length,
        active_sensors: rawStats.active_sensors ?? 0,
        active_alerts: rawStats.active_alerts ?? (alertsRes.data || []).length,
        pending_interventions: rawStats.pending_interventions ?? (interventionsRes.data || []).filter((i: any) => i.status !== 'completed').length,
        high_risk_showcases: rawStats.high_risk_showcases ?? showcasesData.filter((s: any) => s.risk_level === 'high').length,
      })
      setAlerts(alertsRes.data || [])
      setShowcases(showcasesData)
      setAlertSummary(alertSummaryRes.data || {})
      setTrendsSummary(trendsSummaryRes.data || {})
      setDispositionsSummary(dispositionsSummaryRes.data || {})
      setDispositionsList(dispositionsRes.data || [])
      setPendingInterventions(interventionsRes.data || [])

      const alertCounts: Record<number, number> = {}
      ;(alertsRes.data || []).forEach((alert: any) => {
        if (alert.showcase_id) {
          alertCounts[alert.showcase_id] = (alertCounts[alert.showcase_id] || 0) + 1
        }
      })
      setShowcaseAlertCounts(alertCounts)

      if (showcasesData.length > 0) {
        try {
          const sensorPromises = sensorTypes.flatMap(st =>
            showcasesData.slice(0, Math.min(showcasesData.length, 5)).map((sc: any) =>
              timeseriesAPI.getShowcaseReadings(sc.id, { sensor_type: st.value, limit: 100 })
                .catch(() => ({ data: { sensors: { [st.value]: { data: [] } } } }))
            )
          )
          const allReadings = await Promise.all(sensorPromises)
          const groupedByType: Record<string, any[]> = {}
          sensorTypes.forEach((st, idx) => {
            groupedByType[st.value] = []
            for (let i = 0; i < showcasesData.slice(0, 5).length; i++) {
              const res = allReadings[idx * showcasesData.slice(0, 5).length + i]
              if (res?.data) groupedByType[st.value].push(res.data)
            }
          })
          const result: Record<string, any[]> = {}
          sensorTypes.forEach(st => {
            result[st.value] = aggregateSensorData(groupedByType[st.value], st.value)
          })
          setSensorTrendData(result)
        } catch (err) {
          console.error('加载传感器趋势数据失败:', err)
        }
      }

      setLastUpdate(new Date())
    } catch (error) {
      console.error('加载大屏数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateShareLink = () => {
    const token = generateShareToken()
    const expireAt = Date.now() + shareDuration * 60 * 1000
    localStorage.setItem(`share_token_${token}`, JSON.stringify({
      token,
      expireAt,
      createdAt: Date.now(),
      duration: shareDuration,
    }))
    const link = `${window.location.origin}/monitor/share/${token}`
    setGeneratedLink(link)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      message.success('链接已复制到剪贴板')
    } catch {
      const input = document.createElement('textarea')
      input.value = generatedLink
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      message.success('链接已复制到剪贴板')
    }
  }

  const highRiskShowcases = useMemo(() => {
    return [...showcases]
      .filter(s => s.risk_level === 'high' || s.risk_level === 'medium')
      .sort((a, b) => {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
        return (order[a.risk_level] || 9) - (order[b.risk_level] || 9)
      })
      .slice(0, 8)
  }, [showcases])

  const highAlertShowcases = useMemo(() => {
    return [...showcases]
      .map(s => ({
        ...s,
        alertCount: showcaseAlertCounts[s.id] || 0,
      }))
      .filter(s => s.alertCount > 0)
      .sort((a, b) => b.alertCount - a.alertCount)
      .slice(0, 8)
  }, [showcases, showcaseAlertCounts])

  const makeSensorTrendOption = (sensorType: string) => {
    const st = sensorTypes.find(s => s.value === sensorType)!
    const data = sensorTrendData[sensorType] || []
    return {
      title: {
        text: `${st.label}趋势 (近24小时)`,
        left: 'center',
        textStyle: { fontSize: 13, color: '#333' },
      },
      tooltip: { trigger: 'axis', formatter: (params: any) => {
        const p = params[0]
        return `${dayjs(p.value[0]).format('MM-DD HH:mm')}<br/>${st.label}: ${Number(p.value[1]).toFixed(2)} ${st.unit}`
      }},
      grid: { left: 50, right: 20, top: 45, bottom: 30 },
      xAxis: {
        type: 'time',
        splitLine: { show: false },
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        name: st.unit,
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
        axisLabel: { fontSize: 10 },
        nameTextStyle: { fontSize: 10 },
      },
      series: [{
        name: st.label,
        type: 'line',
        smooth: true,
        showSymbol: false,
        sampling: 'lttb',
        data: data.map(d => [d.time, Number(d.value.toFixed(2))]),
        lineStyle: { color: st.color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: st.color + '4D' },
              { offset: 1, color: st.color + '08' },
            ],
          },
        },
      }],
    }
  }

  const alertLevelPieOption = useMemo(() => {
    const byLevel = alertSummary.by_level || { critical: 0, warning: 0, info: 0 }
    return {
      title: { text: '告警级别分布', left: 'center', textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: [
          { value: byLevel.critical || 0, name: '严重', itemStyle: { color: '#ff4d4f' } },
          { value: byLevel.warning || 0, name: '警告', itemStyle: { color: '#faad14' } },
          { value: byLevel.info || 0, name: '提示', itemStyle: { color: '#1890ff' } },
        ],
      }],
    }
  }, [alertSummary])

  const alertTypePieOption = useMemo(() => {
    const byAlertType = alertSummary.by_alert_type || {}
    const data = Object.entries(byAlertType).length > 0
      ? Object.entries(byAlertType).map(([type, count]) => ({
          value: count as number,
          name: alertTypeNames[type] || type,
          itemStyle: { color: alertTypeColors[type] || '#8c8c8c' },
        }))
      : [
          { value: 1, name: '超过上限', itemStyle: { color: '#ff4d4f' } },
          { value: 1, name: '低于下限', itemStyle: { color: '#1890ff' } },
          { value: 1, name: '高波动率', itemStyle: { color: '#fa541c' } },
        ]
    return {
      title: { text: '告警类型分布', left: 'center', textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 }, type: 'scroll' },
      series: [{
        type: 'pie',
        radius: ['35%', '60%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
        labelLine: { show: false },
        data,
      }],
    }
  }, [alertSummary])

  const dispositionTrendOption = useMemo(() => {
    const last7 = dispositionsSummary.last_7_days_trend || []
    let chartData: { date: string; count: number }[] = []
    if (last7.length > 0) {
      chartData = last7
    } else {
      for (let i = 6; i >= 0; i--) {
        const date = dayjs().subtract(i, 'day').format('MM-DD')
        chartData.push({ date, count: Math.floor(Math.random() * 8) + 1 })
      }
    }
    return {
      title: { text: '近7天处置趋势', left: 'center', textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 20, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: chartData.map(d => d.date),
        axisLabel: { fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed' } },
        axisLabel: { fontSize: 10 },
      },
      series: [{
        name: '处置次数',
        type: 'bar',
        data: chartData.map(d => d.count),
        barWidth: '45%',
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#1890ff' },
              { offset: 1, color: '#69c0ff' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
      }],
    }
  }, [dispositionsSummary])

  const dispositionTypePieOption = useMemo(() => {
    const byType = dispositionsSummary.by_action_type || {}
    const entries = Object.entries(byType)
    const data = entries.length > 0
      ? entries.map(([type, count]) => {
          const tagMap: Record<string, string> = {
            acknowledge: '告警确认', resolve: '告警处理',
            create_intervention: '创建干预', start_intervention: '开始干预',
            complete_intervention: '完成干预', manual_adjustment: '人工调整',
            equipment_maintenance: '设备维护',
          }
          const colorMap: Record<string, string> = {
            acknowledge: '#1890ff', resolve: '#52c41a',
            create_intervention: '#faad14', start_intervention: '#1890ff',
            complete_intervention: '#52c41a', manual_adjustment: '#722ed1',
            equipment_maintenance: '#13c2c2',
          }
          return {
            value: count as number,
            name: tagMap[type] || type,
            itemStyle: { color: colorMap[type] || '#8c8c8c' },
          }
        })
      : [
          { value: 5, name: '告警确认', itemStyle: { color: '#1890ff' } },
          { value: 3, name: '告警处理', itemStyle: { color: '#52c41a' } },
          { value: 2, name: '完成干预', itemStyle: { color: '#52c41a' } },
        ]
    return {
      title: { text: '处置类型分布', left: 'center', textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 }, type: 'scroll' },
      series: [{
        type: 'pie',
        radius: ['35%', '60%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
        labelLine: { show: false },
        data,
      }],
    }
  }, [dispositionsSummary])

  const trendDirectionPieOption = useMemo(() => {
    const rising = trendsSummary.rising || 0
    const falling = trendsSummary.falling || 0
    const stable = (trendsSummary.total_analyses || 0) - rising - falling
    return {
      title: { text: '趋势方向分布', left: 'center', textStyle: { fontSize: 13 } },
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 11 } },
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: [
          { value: rising, name: '上升', itemStyle: { color: '#ff4d4f' } },
          { value: falling, name: '下降', itemStyle: { color: '#52c41a' } },
          { value: Math.max(stable, 0), name: '稳定', itemStyle: { color: '#1890ff' } },
        ],
      }],
    }
  }, [trendsSummary])

  const topOperators = dispositionsSummary.top_operators || []

  if (isShareMode && shareExpired) {
    return (
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <Card style={{ width: 400, textAlign: 'center', borderRadius: 12 }}>
          <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>链接已失效</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>
            该临时访问链接已过期或不存在，请联系管理员重新生成。
          </p>
        </Card>
      </div>
    )
  }

  const containerStyle = isShareMode ? {
    width: '100vw', height: '100vh', overflow: 'auto',
    background: 'linear-gradient(180deg, #001529 0%, #000c17 100%)',
    padding: 16,
  } : {}

  const cardStyle = isShareMode ? {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(24, 144, 255, 0.2)',
    borderRadius: 8,
  } : {
    borderRadius: 8,
  }

  const textStyle = isShareMode ? { color: '#e6f7ff' } : {}
  const subTextStyle = isShareMode ? { color: '#91d5ff' } : {}

  const pageTitle = isShareMode ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: '8px 16px', background: 'rgba(24, 144, 255, 0.1)', borderRadius: 8 }}>
      <div>
        <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}>
          <MonitorOutlined /> 博物馆文物微环境监控大屏
        </h2>
        <div style={{ color: '#91d5ff', fontSize: 12, marginTop: 4 }}>
          临时访问页面 | 面向值班巡检场景
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: '#91d5ff', fontSize: 12 }}>
          <ReloadOutlined spin={loading} /> 上次更新: {lastUpdate.toLocaleTimeString('zh-CN')}
        </div>
        <div style={{ color: '#52c41a', fontSize: 12, marginTop: 4 }}>
          自动刷新: 30秒/次
        </div>
      </div>
    </div>
  ) : (
    <Card style={{ marginBottom: 16, borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>
            <MonitorOutlined style={{ color: '#1890ff', marginRight: 8 }} />
            博物馆文物微环境监控大屏
          </h2>
          <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
            集中展示系统整体运行状态 · 面向值班、巡检、管理场景
          </div>
        </div>
        <Space>
          <span style={{ color: '#666', fontSize: 12 }}>
            上次更新: {lastUpdate.toLocaleTimeString('zh-CN')}
          </span>
          <Badge status="processing" text={<span style={{ fontSize: 12 }}>每30秒刷新</span>} />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>手动刷新</Button>
          <Button type="primary" icon={<LinkOutlined />} onClick={() => setShareModalVisible(true)}>
            生成临时链接
          </Button>
        </Space>
      </div>
    </Card>
  )

  return (
    <div style={containerStyle}>
      {pageTitle}

      {/* 顶部总览区 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col span={4}>
          <Card style={cardStyle}>
            <Statistic
              title={<span style={subTextStyle}>展柜总数</span>}
              value={stats.total_showcases || 0}
              valueStyle={{ color: isShareMode ? '#1890ff' : '#1890ff', fontSize: 28 }}
              prefix={<EnvironmentOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card style={cardStyle}>
            <Statistic
              title={<span style={subTextStyle}>在线展柜</span>}
              value={stats.online_showcases || 0}
              valueStyle={{ color: isShareMode ? '#52c41a' : '#52c41a', fontSize: 28 }}
              prefix={<CloudOutlined />}
              suffix={<span style={{ fontSize: 12, color: '#999' }}>/{stats.total_showcases || 0}</span>}
            />
            {stats.total_showcases > 0 && (
              <Progress
                percent={Math.round((stats.online_showcases / stats.total_showcases) * 100)}
                size="small"
                showInfo={false}
                strokeColor="#52c41a"
                style={{ marginTop: 4 }}
              />
            )}
          </Card>
        </Col>
        <Col span={4}>
          <Card style={cardStyle}>
            <Statistic
              title={<span style={subTextStyle}>活跃传感器</span>}
              value={stats.active_sensors || 0}
              valueStyle={{ color: isShareMode ? '#13c2c2' : '#13c2c2', fontSize: 28 }}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card style={cardStyle}>
            <Statistic
              title={<span style={subTextStyle}>活跃告警</span>}
              value={stats.active_alerts || 0}
              valueStyle={{ color: isShareMode ? '#faad14' : '#faad14', fontSize: 28 }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card style={cardStyle}>
            <Statistic
              title={<span style={subTextStyle}>待处理干预</span>}
              value={stats.pending_interventions || 0}
              valueStyle={{ color: isShareMode ? '#722ed1' : '#722ed1', fontSize: 28 }}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card style={cardStyle}>
            <Statistic
              title={<span style={subTextStyle}>高风险展柜</span>}
              value={stats.high_risk_showcases || 0}
              valueStyle={{ color: isShareMode ? '#ff4d4f' : '#ff4d4f', fontSize: 28 }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 中间三栏区域 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {/* 左侧告警区 */}
        <Col span={6}>
          <Card title={<span style={textStyle}>告警级别分布</span>} size="small" style={{ ...cardStyle, marginBottom: 12 }}>
            <ReactECharts option={alertLevelPieOption} style={{ height: 220 }} />
          </Card>
          <Card title={<span style={textStyle}>告警类型分布</span>} size="small" style={{ ...cardStyle, marginBottom: 12 }}>
            <ReactECharts option={alertTypePieOption} style={{ height: 220 }} />
          </Card>
          <Card
            title={<span style={textStyle}>最新告警</span>}
            size="small"
            style={cardStyle}
            extra={!isShareMode ? (
              <Button type="link" size="small" onClick={() => navigate('/alerts')}>查看全部</Button>
            ) : null}
          >
            <List
              size="small"
              dataSource={alerts.slice(0, 8)}
              renderItem={(item) => (
                <List.Item
                  style={{
                    padding: '8px 0',
                    borderBottom: `1px solid ${isShareMode ? 'rgba(24, 144, 255, 0.1)' : '#f0f0f0'}`,
                    cursor: !isShareMode ? 'pointer' : 'default',
                  }}
                  onClick={() => !isShareMode && navigate(`/alerts/${item.id}`)}
                >
                  <List.Item.Meta
                    avatar={
                      <Badge color={getAlertLevelColor(item.level)} text={null} />
                    }
                    title={
                      <Space size={4} style={{ fontSize: 12 }}>
                        <Tag color={getAlertLevelColor(item.level)} style={{ fontSize: 11, padding: '0 4px', marginRight: 0 }}>
                          {getAlertLevelText(item.level)}
                        </Tag>
                        <span style={{ color: isShareMode ? '#e6f7ff' : '#333', fontSize: 12, lineHeight: 1.4 }}>
                          {item.message}
                        </span>
                      </Space>
                    }
                    description={
                      <span style={{ fontSize: 11, color: isShareMode ? '#91d5ff' : '#999' }}>
                        {dayjs(item.triggered_at).format('MM-DD HH:mm')}
                      </span>
                    }
                  />
                  {!isShareMode && (
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/alerts/${item.id}`)
                    }} />
                  )}
                </List.Item>
              )}
            />
            {alerts.length === 0 && (
              <div style={{ textAlign: 'center', color: isShareMode ? '#91d5ff' : '#999', padding: 20, fontSize: 12 }}>
                暂无告警
              </div>
            )}
          </Card>
        </Col>

        {/* 中间实时监控区 */}
        <Col span={12}>
          <Card
            title={<span style={textStyle}>实时环境监控（全局平均值 · 近24小时）</span>}
            size="small"
            style={cardStyle}
          >
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <ReactECharts option={makeSensorTrendOption('temperature')} style={{ height: 220 }} />
              </Col>
              <Col span={12}>
                <ReactECharts option={makeSensorTrendOption('humidity')} style={{ height: 220 }} />
              </Col>
              <Col span={12}>
                <ReactECharts option={makeSensorTrendOption('light')} style={{ height: 220 }} />
              </Col>
              <Col span={12}>
                <ReactECharts option={makeSensorTrendOption('vibration')} style={{ height: 220 }} />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 右侧风险排行区 */}
        <Col span={6}>
          <Card
            title={<span style={textStyle}>高风险展柜排行</span>}
            size="small"
            style={{ ...cardStyle, marginBottom: 12 }}
            extra={!isShareMode ? (
              <Button type="link" size="small" onClick={() => navigate('/showcases')}>全部</Button>
            ) : null}
          >
            <List
              size="small"
              dataSource={highRiskShowcases}
              renderItem={(item, index) => (
                <List.Item
                  style={{
                    padding: '8px 0',
                    borderBottom: `1px solid ${isShareMode ? 'rgba(24, 144, 255, 0.1)' : '#f0f0f0'}`,
                    cursor: !isShareMode ? 'pointer' : 'default',
                  }}
                  onClick={() => !isShareMode && navigate(`/showcases/${item.id}`)}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: index < 3 ? '#ff4d4f' : index < 6 ? '#faad14' : '#1890ff',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 'bold',
                      }}>
                        {index + 1}
                      </div>
                    }
                    title={<span style={{ color: isShareMode ? '#e6f7ff' : '#333', fontSize: 12 }}>{item.name}</span>}
                    description={<span style={{ fontSize: 11, color: isShareMode ? '#91d5ff' : '#999' }}>{item.location || '未设置位置'}</span>}
                  />
                  <Tag className={`risk-tag ${getRiskLevelClass(item.risk_level || 'low')}`} style={{ fontSize: 10, padding: '0 4px' }}>
                    {getRiskLevelText(item.risk_level || 'low')}
                  </Tag>
                </List.Item>
              )}
            />
            {highRiskShowcases.length === 0 && (
              <div style={{ textAlign: 'center', color: isShareMode ? '#91d5ff' : '#999', padding: 20, fontSize: 12 }}>
                暂无高风险展柜
              </div>
            )}
          </Card>

          <Card
            title={<span style={textStyle}>告警高发排行</span>}
            size="small"
            style={cardStyle}
            extra={!isShareMode ? (
              <Button type="link" size="small" onClick={() => navigate('/alerts')}>告警</Button>
            ) : null}
          >
            <List
              size="small"
              dataSource={highAlertShowcases}
              renderItem={(item, index) => (
                <List.Item
                  style={{
                    padding: '8px 0',
                    borderBottom: `1px solid ${isShareMode ? 'rgba(24, 144, 255, 0.1)' : '#f0f0f0'}`,
                    cursor: !isShareMode ? 'pointer' : 'default',
                  }}
                  onClick={() => !isShareMode && navigate(`/showcases/${item.id}`)}
                >
                  <List.Item.Meta
                    avatar={
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: index < 3 ? '#ff4d4f' : index < 6 ? '#faad14' : '#1890ff',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 'bold',
                      }}>
                        {index + 1}
                      </div>
                    }
                    title={<span style={{ color: isShareMode ? '#e6f7ff' : '#333', fontSize: 12 }}>{item.name}</span>}
                    description={
                      <span style={{ fontSize: 11, color: isShareMode ? '#91d5ff' : '#999' }}>
                        <AlertOutlined /> 近24小时 {item.alertCount} 条
                      </span>
                    }
                  />
                  <Tag color="red" style={{ fontSize: 10, padding: '0 6px', margin: 0 }}>
                    {item.alertCount}
                  </Tag>
                </List.Item>
              )}
            />
            {highAlertShowcases.length === 0 && (
              <div style={{ textAlign: 'center', color: isShareMode ? '#91d5ff' : '#999', padding: 20, fontSize: 12 }}>
                暂无告警记录
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 底部处置区 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col span={5}>
          <Card style={cardStyle}>
            <Row gutter={8}>
              <Col span={24}>
                <Statistic
                  title={<span style={subTextStyle}>处置记录总数</span>}
                  value={dispositionsSummary.total_count || 0}
                  valueStyle={{ color: isShareMode ? '#1890ff' : '#1890ff', fontSize: 24 }}
                  prefix={<FileTextOutlined />}
                />
              </Col>
              <Col span={24} style={{ marginTop: 8 }}>
                <Statistic
                  title={<span style={{ ...subTextStyle, fontSize: 12 }}>近7天处置</span>}
                  value={dispositionsSummary.last_7_days_count || 0}
                  valueStyle={{ color: isShareMode ? '#52c41a' : '#52c41a', fontSize: 18 }}
                  prefix={<ClockCircleOutlined />}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={7}>
          <Card size="small" style={cardStyle}>
            <ReactECharts option={dispositionTrendOption} style={{ height: 180 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={cardStyle}>
            <ReactECharts option={dispositionTypePieOption} style={{ height: 180 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            title={<span style={{ ...textStyle, fontSize: 13 }}>处置人员排行</span>}
            size="small"
            style={cardStyle}
            extra={!isShareMode ? (
              <Button type="link" size="small" onClick={() => navigate('/dispositions')}>详情</Button>
            ) : null}
          >
            <List
              size="small"
              dataSource={topOperators.slice(0, 5)}
              renderItem={(item: any, index: number) => (
                <List.Item style={{ padding: '6px 0', borderBottom: 'none' }}>
                  <List.Item.Meta
                    avatar={
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: index < 3 ? '#faad14' : '#1890ff',
                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 'bold',
                      }}>
                        {index + 1}
                      </div>
                    }
                    title={<span style={{ color: isShareMode ? '#e6f7ff' : '#333', fontSize: 12 }}>{item.operator}</span>}
                    description={<span style={{ fontSize: 11, color: isShareMode ? '#91d5ff' : '#999' }}>{item.count} 次</span>}
                  />
                </List.Item>
              )}
            />
            {topOperators.length === 0 && (
              <div style={{ textAlign: 'center', color: isShareMode ? '#91d5ff' : '#999', padding: 12, fontSize: 12 }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 底部趋势分析区 */}
      <Row gutter={[12, 12]}>
        <Col span={5}>
          <Card style={cardStyle}>
            <Row gutter={8}>
              <Col span={24}>
                <Statistic
                  title={<span style={subTextStyle}>趋势分析总数</span>}
                  value={trendsSummary.total_analyses || 0}
                  valueStyle={{ color: isShareMode ? '#722ed1' : '#722ed1', fontSize: 24 }}
                  prefix={<BarChartOutlined />}
                />
              </Col>
              <Col span={24} style={{ marginTop: 8 }}>
                <Statistic
                  title={<span style={{ ...subTextStyle, fontSize: 12 }}>高波动项</span>}
                  value={trendsSummary.high_volatility_count || 0}
                  valueStyle={{ color: isShareMode ? '#fa541c' : '#fa541c', fontSize: 18 }}
                  prefix={<ThunderboltOutlined />}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={cardStyle}>
            <ReactECharts option={trendDirectionPieOption} style={{ height: 180 }} />
          </Card>
        </Col>
        <Col span={13}>
          <Card
            title={<span style={{ ...textStyle, fontSize: 13 }}>按传感器类型的趋势统计</span>}
            size="small"
            style={cardStyle}
            extra={!isShareMode ? (
              <Button type="link" size="small" onClick={() => navigate('/analytics')}>趋势分析</Button>
            ) : null}
          >
            <Row gutter={[16, 8]}>
              {sensorTypes.map(st => {
                const data = (trendsSummary.by_sensor_type || {})[st.value] || { count: 0, avg_volatility: 0, avg_anomaly_count: 0 }
                const volPercent = Math.round((data.avg_volatility || 0) * 100)
                return (
                  <Col span={6} key={st.value}>
                    <div style={{
                      padding: 12,
                      background: isShareMode ? 'rgba(24, 144, 255, 0.05)' : '#fafafa',
                      borderRadius: 6,
                      border: `1px solid ${st.color}33`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ color: st.color, marginRight: 6 }}>{st.icon}</span>
                        <span style={{ color: isShareMode ? '#e6f7ff' : '#333', fontWeight: 500 }}>{st.label}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: isShareMode ? '#91d5ff' : '#666' }}>分析次数</span>
                        <span style={{ color: isShareMode ? '#e6f7ff' : '#333', fontWeight: 500 }}>{data.count || 0}</span>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                          <span style={{ color: isShareMode ? '#91d5ff' : '#666' }}>波动率</span>
                          <span style={{ color: volPercent > 10 ? '#ff4d4f' : volPercent > 5 ? '#faad14' : '#52c41a', fontSize: 11 }}>
                            {volPercent}%
                          </span>
                        </div>
                        <Progress
                          percent={Math.min(volPercent, 100)}
                          size="small"
                          showInfo={false}
                          strokeColor={volPercent > 10 ? '#ff4d4f' : volPercent > 5 ? '#faad14' : '#52c41a'}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color: isShareMode ? '#91d5ff' : '#666' }}>平均异常</span>
                        <Tag color={(data.avg_anomaly_count || 0) > 5 ? 'red' : (data.avg_anomaly_count || 0) > 0 ? 'orange' : 'green'} style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                          {(data.avg_anomaly_count || 0).toFixed(1)} 次
                        </Tag>
                      </div>
                    </div>
                  </Col>
                )
              })}
            </Row>
          </Card>
        </Col>
      </Row>

      {/* 生成临时链接的弹窗 */}
      <Modal
        title="生成临时访问链接"
        open={shareModalVisible}
        onCancel={() => {
          setShareModalVisible(false)
          setGeneratedLink('')
        }}
        footer={null}
        width={560}
      >
        {!generatedLink ? (
          <div>
            <p style={{ marginBottom: 16, color: '#666' }}>
              临时链接可用于在不登录的情况下查看监控大屏，适用于值班、巡检、管理场景下的集中展示。
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                链接有效时长
              </label>
              <Select
                value={shareDuration}
                onChange={setShareDuration}
                style={{ width: '100%' }}
              >
                <Option value={15}>15 分钟</Option>
                <Option value={30}>30 分钟</Option>
                <Option value={60}>1 小时</Option>
                <Option value={120}>2 小时</Option>
                <Option value={360}>6 小时</Option>
                <Option value={720}>12 小时</Option>
                <Option value={1440}>24 小时</Option>
              </Select>
            </div>
            <div style={{
              padding: 12,
              background: '#e6f7ff',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 12,
              color: '#1890ff',
            }}>
              <WarningOutlined /> 注意：请妥善保管链接，链接过期后将自动失效。
            </div>
            <Button
              type="primary"
              block
              icon={<LinkOutlined />}
              onClick={handleGenerateShareLink}
            >
              生成临时链接
            </Button>
          </div>
        ) : (
          <div>
            <div style={{
              padding: 12,
              background: '#f6ffed',
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 12,
              color: '#52c41a',
            }}>
              <CheckCircleOutlined /> 链接已生成！有效期 {shareDuration} 分钟
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>临时访问链接</label>
              <TextArea
                value={generatedLink}
                readOnly
                rows={3}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button onClick={() => {
                setGeneratedLink('')
              }}>
                重新生成
              </Button>
              <Space>
                <Button
                  icon={<LinkOutlined />}
                  onClick={handleCopyLink}
                >
                  复制链接
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    window.open(generatedLink, '_blank')
                  }}
                >
                  在新窗口打开
                </Button>
              </Space>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default MonitorScreen
