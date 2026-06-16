import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Row,
  Col,
  Descriptions,
  Tag,
  Button,
  Space,
  Tabs,
  List,
  Progress,
  Statistic,
  Divider,
  Alert as AntAlert,
} from 'antd'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  WarningOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { showcaseAPI, timeseriesAPI, alertAPI, interventionAPI } from '@/services/api'
import dayjs from 'dayjs'

const { TabPane } = Tabs

function ShowcaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showcase, setShowcase] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [sensors, setSensors] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [interventions, setInterventions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [sensorReadings, setSensorReadings] = useState<Record<number, any[]>>({})

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  const loadData = async () => {
    setLoading(true)
    try {
      const [detailRes, profileRes, alertsRes, interventionsRes] = await Promise.all([
        showcaseAPI.getDetail(Number(id)),
        showcaseAPI.getProfile(Number(id)),
        alertAPI.getAll({ showcase_id: Number(id), limit: 10 }),
        interventionAPI.getAll({ showcase_id: Number(id), limit: 10 }),
      ])
      setShowcase(detailRes.data.showcase)
      setSensors(detailRes.data.sensors)
      setProfile(profileRes.data)
      setAlerts(alertsRes.data)
      setInterventions(interventionsRes.data)

      const readingsMap: Record<number, any[]> = {}
      for (const sensor of detailRes.data.sensors || []) {
        try {
          const res = await timeseriesAPI.getSensorReadings(sensor.id, { limit: 100 })
          readingsMap[sensor.id] = res.data.data || []
        } catch (err) {
          console.error(`加载传感器 ${sensor.id} 读数失败:`, err)
          readingsMap[sensor.id] = []
        }
      }
      setSensorReadings(readingsMap)
    } catch (error) {
      console.error('加载展柜详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const recalculateProfile = async () => {
    try {
      await showcaseAPI.recalculateProfile(Number(id))
      loadData()
    } catch (error) {
      console.error('重新计算画像失败:', error)
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

  const getStabilityColor = (value: number) => {
    if (value >= 0.9) return '#52c41a'
    if (value >= 0.75) return '#faad14'
    return '#ff4d4f'
  }

  const getSensorTypeChart = (sensor: any, color: string) => {
    const readings = sensorReadings[sensor.id] || []
    const chartData = readings.map(r => [new Date(r.time), Number(r.value).toFixed(2)])

    return {
      title: { text: sensor.name, left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'time', splitLine: { show: false } },
      yAxis: { type: 'value', name: sensor.unit, splitLine: { lineStyle: { type: 'dashed' } } },
      series: [{
        name: sensor.name,
        type: 'line',
        smooth: true,
        data: chartData,
        lineStyle: { color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${color}4D` },
              { offset: 1, color: `${color}0D` },
            ],
          },
        },
      }],
      grid: { left: 50, right: 20, top: 40, bottom: 30 },
    }
  }

  const sensorTypeColorMap: Record<string, string> = {
    temperature: '#ff7875',
    humidity: '#40a9ff',
    light: '#ffd666',
    vibration: '#95de64',
  }

  const renderOverview = () => (
    <Row gutter={[16, 16]}>
      <Col span={8}>
        <Card title="基本信息" size="small">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="展柜编号">{showcase?.code}</Descriptions.Item>
            <Descriptions.Item label="展柜名称">{showcase?.name}</Descriptions.Item>
            <Descriptions.Item label="所在位置">{showcase?.location}</Descriptions.Item>
            <Descriptions.Item label="运行状态">
              <Tag color={showcase?.status === 'active' ? 'green' : 'default'}>
                {showcase?.status === 'active' ? '运行中' : '离线'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="传感器数量">{sensors.length} 个</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card
          title="环境风险评估"
          size="small"
          style={{ marginTop: 16 }}
          extra={<Button type="link" size="small" icon={<ReloadOutlined />} onClick={recalculateProfile}>重新计算</Button>}
        >
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Tag className={`risk-tag ${getRiskLevelClass(profile?.risk_level || 'low')}`} style={{ fontSize: 16, padding: '4px 16px' }}>
              {getRiskLevelText(profile?.risk_level || 'low')}
            </Tag>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <div className="profile-metric">
            <span className="profile-metric-label">温度稳定性</span>
            <div style={{ flex: 1, margin: '0 12px' }}>
              <Progress
                percent={Math.round((profile?.temperature_stability || 0) * 100)}
                size="small"
                strokeColor={getStabilityColor(profile?.temperature_stability || 0)}
                showInfo={false}
              />
            </div>
            <span className="profile-metric-value" style={{ fontSize: 14, minWidth: 50, textAlign: 'right' }}>
              {((profile?.temperature_stability || 0) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="profile-metric">
            <span className="profile-metric-label">湿度稳定性</span>
            <div style={{ flex: 1, margin: '0 12px' }}>
              <Progress
                percent={Math.round((profile?.humidity_stability || 0) * 100)}
                size="small"
                strokeColor={getStabilityColor(profile?.humidity_stability || 0)}
                showInfo={false}
              />
            </div>
            <span className="profile-metric-value" style={{ fontSize: 14, minWidth: 50, textAlign: 'right' }}>
              {((profile?.humidity_stability || 0) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="profile-metric">
            <span className="profile-metric-label">光照稳定性</span>
            <div style={{ flex: 1, margin: '0 12px' }}>
              <Progress
                percent={Math.round((profile?.light_stability || 0) * 100)}
                size="small"
                strokeColor={getStabilityColor(profile?.light_stability || 0)}
                showInfo={false}
              />
            </div>
            <span className="profile-metric-value" style={{ fontSize: 14, minWidth: 50, textAlign: 'right' }}>
              {((profile?.light_stability || 0) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="profile-metric">
            <span className="profile-metric-label">震动稳定性</span>
            <div style={{ flex: 1, margin: '0 12px' }}>
              <Progress
                percent={Math.round((profile?.vibration_stability || 0) * 100)}
                size="small"
                strokeColor={getStabilityColor(profile?.vibration_stability || 0)}
                showInfo={false}
              />
            </div>
            <span className="profile-metric-value" style={{ fontSize: 14, minWidth: 50, textAlign: 'right' }}>
              {((profile?.vibration_stability || 0) * 100).toFixed(1)}%
            </span>
          </div>

          <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
            上次计算: {profile?.last_calculated_at ? dayjs(profile.last_calculated_at).format('YYYY-MM-DD HH:mm:ss') : '暂无'}
          </div>
        </Card>
      </Col>

      <Col span={16}>
        <Card title="环境参数实时监测" size="small">
          <Row gutter={[16, 16]}>
            {sensors.map(sensor => (
              <Col span={12} key={sensor.id}>
                <ReactECharts
                  option={getSensorTypeChart(sensor, sensorTypeColorMap[sensor.sensor_type] || '#8c8c8c')}
                  style={{ height: 220 }}
                />
              </Col>
            ))}
          </Row>
        </Card>
      </Col>
    </Row>
  )

  const renderSensors = () => (
    <Card title="传感器列表" size="small">
      <List
        dataSource={sensors}
        renderItem={(item) => (
          <List.Item key={item.id}>
            <List.Item.Meta
              title={
                <Space>
                  <span style={{ fontWeight: 500 }}>{item.name}</span>
                  <Tag color="blue">{item.sensor_type}</Tag>
                  <Tag color={item.status === 'active' ? 'green' : 'default'}>
                    {item.status === 'active' ? '正常' : '离线'}
                  </Tag>
                </Space>
              }
              description={
                <div>
                  <div>编号: {item.code}</div>
                  <div>阈值: {item.min_threshold} ~ {item.max_threshold} {item.unit}</div>
                </div>
              }
            />
            <Button type="link" onClick={() => setActiveTab('overview')}>查看数据</Button>
          </List.Item>
        )}
      />
    </Card>
  )

  const renderAlerts = () => (
    <Card title="告警记录" size="small">
      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无告警记录</div>
      ) : (
        <List
          dataSource={alerts}
          renderItem={(item) => (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={item.level === 'critical' ? 'red' : 'orange'}>
                      {item.level === 'critical' ? '严重' : '警告'}
                    </Tag>
                    <span>{item.message}</span>
                  </Space>
                }
                description={dayjs(item.triggered_at).format('YYYY-MM-DD HH:mm:ss')}
              />
              <Button type="link" onClick={() => navigate(`/alerts/${item.id}`)}>详情</Button>
            </List.Item>
          )}
        />
      )}
    </Card>
  )

  const renderInterventions = () => (
    <Card title="干预记录" size="small">
      {interventions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无干预记录</div>
      ) : (
        <List
          dataSource={interventions}
          renderItem={(item) => (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={
                  <Space>
                    <span style={{ fontWeight: 500 }}>{item.description}</span>
                    <Tag color={item.status === 'completed' ? 'green' : item.status === 'in_progress' ? 'blue' : 'orange'}>
                      {item.status === 'completed' ? '已完成' : item.status === 'in_progress' ? '进行中' : '待处理'}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <div>类型: {item.action_type}</div>
                    <div>创建时间: {dayjs(item.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                  </div>
                }
              />
              <Button type="link" onClick={() => navigate(`/interventions/${item.id}`)}>详情</Button>
            </List.Item>
          )}
        />
      )}
    </Card>
  )

  return (
    <div>
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 24px' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/showcases')}>返回列表</Button>
          <h2 style={{ margin: 0 }}>{showcase?.name || '展柜详情'}</h2>
          <Tag className={`risk-tag ${getRiskLevelClass(profile?.risk_level || 'low')}`}>
            {getRiskLevelText(profile?.risk_level || 'low')}
          </Tag>
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ padding: '0 24px' }}>
          <TabPane tab="环境概览" key="overview">{renderOverview()}</TabPane>
          <TabPane tab="传感器管理" key="sensors">{renderSensors()}</TabPane>
          <TabPane tab="告警记录" key="alerts">{renderAlerts()}</TabPane>
          <TabPane tab="干预记录" key="interventions">{renderInterventions()}</TabPane>
        </Tabs>
      </Card>
    </div>
  )
}

export default ShowcaseDetail
