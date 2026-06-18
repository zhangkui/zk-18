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
  DatePicker,
  Select,
  Table,
  Modal,
} from 'antd'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  WarningOutlined,
  ToolOutlined,
  LineChartOutlined,
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
  const [selectedSensorId, setSelectedSensorId] = useState<number | null>(null)
  const [sensorDetailModalVisible, setSensorDetailModalVisible] = useState(false)
  const [currentSensorData, setCurrentSensorData] = useState<any[]>([])
  const [sensorDetailTimeRange, setSensorDetailTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [sensorDetailLoading, setSensorDetailLoading] = useState(false)
  const [sensorLatestReading, setSensorLatestReading] = useState<any>(null)

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

  const loadSensorDetailData = async (sensorId: number, range?: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    setSensorDetailLoading(true)
    try {
      const params: Record<string, any> = { limit: 1000 }
      if (range && range[0] && range[1]) {
        params.start_time = range[0].toISOString()
        params.end_time = range[1].toISOString()
      }
      const [readingsRes, latestRes] = await Promise.all([
        timeseriesAPI.getSensorReadings(sensorId, params),
        timeseriesAPI.getLatestReading(sensorId),
      ])
      setCurrentSensorData(readingsRes.data.data || [])
      setSensorLatestReading(latestRes.data)
    } catch (error) {
      console.error('加载传感器详情数据失败:', error)
    } finally {
      setSensorDetailLoading(false)
    }
  }

  const handleViewSensorDetail = (sensor: any) => {
    setSelectedSensorId(sensor.id)
    setSensorDetailTimeRange(null)
    setCurrentSensorData([])
    setSensorLatestReading(null)
    setSensorDetailModalVisible(true)
    loadSensorDetailData(sensor.id, null)
  }

  const handleSensorDetailTimeRangeChange = (range: any) => {
    setSensorDetailTimeRange(range)
    if (selectedSensorId) {
      loadSensorDetailData(selectedSensorId, range)
    }
  }

  const handleSensorChange = (sensorId: number) => {
    setSelectedSensorId(sensorId)
    setSensorDetailTimeRange(null)
    setCurrentSensorData([])
    setSensorLatestReading(null)
    loadSensorDetailData(sensorId, null)
  }

  const handleRefreshSensorDetail = () => {
    if (selectedSensorId) {
      loadSensorDetailData(selectedSensorId, sensorDetailTimeRange)
    }
  }

  const getCurrentSensor = () => sensors.find((s) => s.id === selectedSensorId)

  const getSensorDetailChartOption = () => {
    const sensor = getCurrentSensor()
    const chartData = currentSensorData.map((r: any) => [
      new Date(r.time).getTime(),
      Number(r.value).toFixed(3),
    ])

    const color = sensorTypeColorMap[sensor?.sensor_type] || '#1890ff'

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const p = params[0]
          const time = dayjs(p.value[0]).format('YYYY-MM-DD HH:mm:ss')
          return `${time}<br/>${sensor?.name || '数值'}: ${p.value[1]} ${sensor?.unit || ''}`;
        },
      },
      xAxis: {
        type: 'time',
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: sensor?.unit || '',
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          name: sensor?.name || '数据',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: chartData,
          lineStyle: { width: 2, color },
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
        },
      ],
      grid: { left: 60, right: 30, top: 30, bottom: 50 },
    }
  }

  const getSensorDetailReadingColumns = () => {
    const sensor = getCurrentSensor()
    return [
      {
        title: '上报时间',
        dataIndex: 'time',
        key: 'time',
        render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
        width: 200,
      },
      {
        title: '数值',
        dataIndex: 'value',
        key: 'value',
        render: (val: number) => `${Number(val).toFixed(3)} ${sensor?.unit || ''}`,
      },
      {
        title: '质量',
        dataIndex: 'quality',
        key: 'quality',
        render: (val: number) => (
          <Tag color={val === 1 ? 'green' : 'orange'}>{val === 1 ? '正常' : '异常'}</Tag>
        ),
      },
    ]
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

  const sensorTypeMap: Record<string, string> = {
    temperature: '温度',
    humidity: '湿度',
    light: '光照',
    vibration: '震动',
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
    <Card
      title={
        <Space>
          <span>传感器列表</span>
          <Tag color="default">共 {sensors.length} 个传感器</Tag>
        </Space>
      }
      size="small"
    >
      <Row gutter={[16, 16]}>
        {sensors.map((item) => (
          <Col span={12} key={item.id}>
            <Card
              size="small"
              hoverable
              onClick={() => handleViewSensorDetail(item)}
              style={{ cursor: 'pointer' }}
            >
              <Card.Meta
                avatar={
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      backgroundColor: `${sensorTypeColorMap[item.sensor_type]}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: sensorTypeColorMap[item.sensor_type] || '#1890ff',
                      fontSize: 24,
                    }}
                  >
                    <LineChartOutlined />
                  </div>
                }
                title={
                  <Space>
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <Tag color={sensorTypeColorMap[item.sensor_type] || 'blue'}>
                      {sensorTypeMap[item.sensor_type] || item.sensor_type}
                    </Tag>
                    <Tag color={item.status === 'active' ? 'green' : 'default'}>
                      {item.status === 'active' ? '正常' : '离线'}
                    </Tag>
                  </Space>
                }
                description={
                  <div style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 4 }}>编号: {item.code}</div>
                    <div style={{ marginBottom: 4 }}>单位: {item.unit}</div>
                    <div>
                      阈值: <span style={{ color: '#3f8600' }}>{item.min_threshold}</span> ~{' '}
                      <span style={{ color: '#cf1322' }}>{item.max_threshold}</span> {item.unit}
                    </div>
                    {item.warning_threshold && (
                      <div style={{ marginTop: 4, color: '#faad14' }}>
                        预警阈值: {item.warning_threshold} {item.unit}
                      </div>
                    )}
                  </div>
                }
              />
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Button
                  type="primary"
                  size="small"
                  icon={<LineChartOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewSensorDetail(item)
                  }}
                >
                  查看数据
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
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

      <Modal
        title={
          <Space>
            <span>传感器数据详情</span>
            <Select
              value={selectedSensorId}
              onChange={handleSensorChange}
              style={{ width: 200 }}
              placeholder="选择传感器"
              options={sensors.map((s) => ({
                label: `${s.name} (${sensorTypeMap[s.sensor_type] || s.sensor_type})`,
                value: s.id,
              }))}
            />
          </Space>
        }
        open={sensorDetailModalVisible}
        onCancel={() => setSensorDetailModalVisible(false)}
        footer={null}
        destroyOnClose
        width={1200}
      >
        {getCurrentSensor() && (
          <>
            <Space style={{ marginBottom: 16 }} wrap>
              <Tag color={sensorTypeColorMap[getCurrentSensor()?.sensor_type] || 'blue'}>
                {sensorTypeMap[getCurrentSensor()?.sensor_type] || getCurrentSensor()?.sensor_type}
              </Tag>
              <Tag color={getCurrentSensor()?.status === 'active' ? 'green' : 'default'}>
                {getCurrentSensor()?.status === 'active' ? '正常运行' : '离线'}
              </Tag>
              <Tag color="default">编号: {getCurrentSensor()?.code}</Tag>
              <DatePicker.RangePicker
                showTime
                value={sensorDetailTimeRange}
                onChange={handleSensorDetailTimeRangeChange}
                placeholder={['开始时间', '结束时间']}
              />
              <Button icon={<ReloadOutlined />} onClick={handleRefreshSensorDetail} loading={sensorDetailLoading}>
                刷新
              </Button>
              <Tag color="default">共 {currentSensorData.length} 条数据</Tag>
            </Space>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="最新数值"
                    value={sensorLatestReading?.value ?? '-'}
                    suffix={getCurrentSensor()?.unit || ''}
                    precision={3}
                  />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                    {sensorLatestReading?.time
                      ? dayjs(sensorLatestReading.time).format('YYYY-MM-DD HH:mm:ss')
                      : '暂无数据'}
                  </div>
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="平均值"
                    value={
                      currentSensorData.length > 0
                        ? (
                            currentSensorData.reduce((sum: number, r: any) => sum + r.value, 0) /
                            currentSensorData.length
                          ).toFixed(3)
                        : '-'
                    }
                    suffix={getCurrentSensor()?.unit || ''}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="最小值"
                    value={
                      currentSensorData.length > 0
                        ? Math.min(...currentSensorData.map((r: any) => r.value)).toFixed(3)
                        : '-'
                    }
                    suffix={getCurrentSensor()?.unit || ''}
                    valueStyle={{ color: '#3f8600' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="最大值"
                    value={
                      currentSensorData.length > 0
                        ? Math.max(...currentSensorData.map((r: any) => r.value)).toFixed(3)
                        : '-'
                    }
                    suffix={getCurrentSensor()?.unit || ''}
                    valueStyle={{ color: '#cf1322' }}
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Card size="small" title="阈值范围">
                  <Space>
                    <span>正常范围:</span>
                    <Tag color="green">
                      {getCurrentSensor()?.min_threshold} ~ {getCurrentSensor()?.max_threshold}{' '}
                      {getCurrentSensor()?.unit}
                    </Tag>
                    {getCurrentSensor()?.warning_threshold && (
                      <>
                        <span>预警阈值:</span>
                        <Tag color="orange">
                          {getCurrentSensor()?.warning_threshold} {getCurrentSensor()?.unit}
                        </Tag>
                      </>
                    )}
                  </Space>
                </Card>
              </Col>
            </Row>

            <Divider />

            <Tabs defaultActiveKey="chart">
              <Tabs.TabPane tab="趋势曲线" key="chart">
                {currentSensorData.length > 0 ? (
                  <ReactECharts
                    option={getSensorDetailChartOption()}
                    style={{ height: 400 }}
                    notMerge
                    lazyUpdate
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>暂无数据</div>
                )}
              </Tabs.TabPane>
              <Tabs.TabPane tab="数据明细" key="table">
                <Table
                  rowKey={(record: any) => record.time + record.value}
                  columns={getSensorDetailReadingColumns()}
                  dataSource={[...currentSensorData].reverse()}
                  loading={sensorDetailLoading}
                  pagination={{
                    defaultPageSize: 20,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                  scroll={{ y: 400 }}
                />
              </Tabs.TabPane>
            </Tabs>
          </>
        )}
      </Modal>
    </div>
  )
}

export default ShowcaseDetail
