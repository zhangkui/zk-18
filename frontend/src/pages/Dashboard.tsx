import { useState, useEffect } from 'react'
import { Row, Col, Card, Statistic, List, Tag, Space, Button } from 'antd'
import {
  EnvironmentOutlined,
  AlertOutlined,
  WarningOutlined,
  ToolOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { showcaseAPI, alertAPI } from '@/services/api'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [showcases, setShowcases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [statsRes, alertsRes, showcasesRes] = await Promise.all([
        showcaseAPI.getDashboardStats(),
        alertAPI.getAll({ status: 'pending', limit: 5 }),
        showcaseAPI.getAll(),
      ])
      setStats(statsRes.data)
      setAlerts(alertsRes.data)
      setShowcases(showcasesRes.data)
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
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

  const temperatureChartOption = {
    title: { text: '温度趋势 (24h)', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'time',
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: '°C',
      splitLine: { lineStyle: { type: 'dashed' } },
    },
    series: [{
      name: '平均温度',
      type: 'line',
      smooth: true,
      data: generateMockTempData(),
      lineStyle: { color: '#ff7875' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(255,120,117,0.3)' },
            { offset: 1, color: 'rgba(255,120,117,0.05)' },
          ],
        },
      },
    }],
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
  }

  const humidityChartOption = {
    title: { text: '湿度趋势 (24h)', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'time', splitLine: { show: false } },
    yAxis: { type: 'value', name: '%RH', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [{
      name: '平均湿度',
      type: 'line',
      smooth: true,
      data: generateMockHumData(),
      lineStyle: { color: '#40a9ff' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(64,169,255,0.3)' },
            { offset: 1, color: 'rgba(64,169,255,0.05)' },
          ],
        },
      },
    }],
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
  }

  const alertDistributionOption = {
    title: { text: '告警类型分布', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, left: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '60%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: [
        { value: 35, name: '温度异常', itemStyle: { color: '#ff7875' } },
        { value: 28, name: '湿度异常', itemStyle: { color: '#40a9ff' } },
        { value: 15, name: '光照异常', itemStyle: { color: '#ffd666' } },
        { value: 8, name: '震动异常', itemStyle: { color: '#95de64' } },
      ],
    }],
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="展柜总数"
              value={stats?.total_showcases || 5}
              prefix={<EnvironmentOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="活跃传感器"
              value={stats?.active_sensors || 20}
              prefix={<AlertOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="活跃告警"
              value={stats?.active_alerts || 3}
              prefix={<WarningOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="待处理干预"
              value={stats?.pending_interventions || 2}
              prefix={<ToolOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="实时环境概览" size="small">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <ReactECharts option={temperatureChartOption} style={{ height: 250 }} />
              </Col>
              <Col span={12}>
                <ReactECharts option={humidityChartOption} style={{ height: 250 }} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title="最新告警"
            size="small"
            extra={<Button type="link" size="small" onClick={() => navigate('/alerts')}>查看全部</Button>}
          >
            <List
              dataSource={alerts}
              loading={loading}
              renderItem={(item) => (
                <List.Item
                  style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}
                  actions={[
                    <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/alerts/${item.id}`)}>
                      详情
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag color={getAlertLevelColor(item.level)}>{getAlertLevelText(item.level)}</Tag>
                        <span style={{ fontSize: 14 }}>{item.message}</span>
                      </Space>
                    }
                    description={new Date(item.triggered_at).toLocaleString('zh-CN')}
                  />
                </List.Item>
              )}
            />
            {alerts.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无告警</div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="告警类型分布" size="small">
            <ReactECharts option={alertDistributionOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="展柜风险概览"
            size="small"
            extra={<Button type="link" size="small" onClick={() => navigate('/showcases')}>管理展柜</Button>}
          >
            <List
              dataSource={showcases}
              renderItem={(item) => (
                <List.Item
                  style={{ padding: '10px 0', cursor: 'pointer' }}
                  onClick={() => navigate(`/showcases/${item.id}`)}
                >
                  <List.Item.Meta
                    avatar={<EnvironmentOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                    title={
                      <Space>
                        <span>{item.name}</span>
                        <Tag color={item.status === 'active' ? 'green' : 'default'}>{item.status === 'active' ? '运行中' : '离线'}</Tag>
                      </Space>
                    }
                    description={item.location || '位置未设置'}
                  />
                  <div>
                    <Tag className={`risk-tag risk-low`}>低风险</Tag>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function generateMockTempData() {
  const data = []
  const now = new Date()
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000)
    const value = 20 + Math.sin(i / 6) * 1.5 + Math.random() * 0.5
    data.push([time, value.toFixed(1)])
  }
  return data
}

function generateMockHumData() {
  const data = []
  const now = new Date()
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000)
    const value = 50 + Math.cos(i / 8) * 3 + Math.random() * 1
    data.push([time, value.toFixed(1)])
  }
  return data
}

export default Dashboard
