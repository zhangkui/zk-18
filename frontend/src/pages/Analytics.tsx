import { useState, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Button,
  Space,
  Table,
  Tag,
  Progress,
  message,
} from 'antd'
import {
  BarChartOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  AlertOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { analyticsAPI, showcaseAPI } from '@/services/api'
import dayjs from 'dayjs'

const { Option } = Select
const { RangePicker } = DatePicker

function Analytics() {
  const [trendsSummary, setTrendsSummary] = useState<any>({})
  const [showcases, setShowcases] = useState<any[]>([])
  const [selectedShowcase, setSelectedShowcase] = useState<number | null>(null)
  const [selectedSensorType, setSelectedSensorType] = useState('temperature')
  const [trendData, setTrendData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [autoGenerating, setAutoGenerating] = useState(false)

  useEffect(() => {
    loadSummary()
    loadShowcases()
  }, [])

  useEffect(() => {
    if (selectedShowcase) {
      loadTrends()
    }
  }, [selectedShowcase, selectedSensorType])

  const handleAutoGenerate = async () => {
    setAutoGenerating(true)
    try {
      const res = await analyticsAPI.autoGenerateTrends()
      message.success(res.data.message || '趋势分析生成完成')
      loadSummary()
      if (selectedShowcase) {
        loadTrends()
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '自动生成失败')
    } finally {
      setAutoGenerating(false)
    }
  }

  const loadSummary = async () => {
    try {
      const res = await analyticsAPI.getTrendsSummary()
      setTrendsSummary(res.data)
    } catch (error) {
      console.error('加载趋势摘要失败:', error)
    }
  }

  const loadShowcases = async () => {
    try {
      const res = await showcaseAPI.getAll()
      setShowcases(res.data)
      if (res.data.length > 0) {
        setSelectedShowcase(res.data[0].id)
      }
    } catch (error) {
      console.error('加载展柜列表失败:', error)
    }
  }

  const loadTrends = async () => {
    if (!selectedShowcase) return
    setLoading(true)
    try {
      const res = await analyticsAPI.getShowcaseTrends(selectedShowcase, {
        sensor_type: selectedSensorType,
        limit: 10,
      })
      const trends = res.data.trends || []
      setTrendData(trends)
      if (trends.length === 0) {
        try {
          const genRes = await analyticsAPI.autoGenerateTrends()
          if (genRes.data.generated_count > 0) {
            message.info(`已自动生成 ${genRes.data.generated_count} 条趋势分析`)
            const retryRes = await analyticsAPI.getShowcaseTrends(selectedShowcase, {
              sensor_type: selectedSensorType,
              limit: 10,
            })
            setTrendData(retryRes.data.trends || [])
            loadSummary()
          }
        } catch {
          // auto-generate failed silently
        }
      }
    } catch (error) {
      console.error('加载趋势数据失败:', error)
    } finally {
      setLoading(false)
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

  const sensorTypes = [
    { value: 'temperature', label: '温度', unit: '°C', color: '#ff7875' },
    { value: 'humidity', label: '湿度', unit: '%RH', color: '#40a9ff' },
    { value: 'light', label: '光照', unit: 'lux', color: '#ffd666' },
    { value: 'vibration', label: '震动', unit: 'mm/s', color: '#95de64' },
  ]

  const trendChartOption = {
    title: { text: '历史趋势对比', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    xAxis: {
      type: 'category',
      data: trendData.map(t => dayjs(t.end_date).format('MM-DD')),
      axisLabel: { rotate: 30 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '平均值',
        type: 'line',
        data: trendData.map(t => t.avg_value),
        smooth: true,
        lineStyle: { color: '#1890ff' },
      },
      {
        name: '最高值',
        type: 'line',
        data: trendData.map(t => t.max_value),
        smooth: true,
        lineStyle: { color: '#ff7875', type: 'dashed' },
      },
      {
        name: '最低值',
        type: 'line',
        data: trendData.map(t => t.min_value),
        smooth: true,
        lineStyle: { color: '#95de64', type: 'dashed' },
      },
    ],
    grid: { left: 50, right: 20, top: 40, bottom: 50 },
  }

  const columns = [
    {
      title: '周期',
      key: 'period',
      render: (_: any, record: any) => (
        <span>
          {dayjs(record.start_date).format('YYYY-MM-DD')} ~ {dayjs(record.end_date).format('YYYY-MM-DD')}
        </span>
      ),
    },
    {
      title: '平均值',
      dataIndex: 'avg_value',
      key: 'avg_value',
      render: (val: number) => val?.toFixed(2) || '-',
    },
    {
      title: '最高值',
      dataIndex: 'max_value',
      key: 'max_value',
      render: (val: number) => val?.toFixed(2) || '-',
    },
    {
      title: '最低值',
      dataIndex: 'min_value',
      key: 'min_value',
      render: (val: number) => val?.toFixed(2) || '-',
    },
    {
      title: '趋势方向',
      dataIndex: 'trend_direction',
      key: 'trend_direction',
      render: (direction: string) => (
        <Space>
          {getTrendDirectionIcon(direction)}
          <span>{getTrendDirectionText(direction)}</span>
        </Space>
      ),
    },
    {
      title: '波动率',
      dataIndex: 'volatility',
      key: 'volatility',
      render: (val: number) => (
        <Progress
          percent={Math.round((val || 0) * 100)}
          size="small"
          strokeColor={val > 0.1 ? '#ff4d4f' : val > 0.05 ? '#faad14' : '#52c41a'}
          format={(percent) => `${percent}%`}
        />
      ),
    },
    {
      title: '异常次数',
      dataIndex: 'anomaly_count',
      key: 'anomaly_count',
      render: (count: number) => (
        <Tag color={count > 5 ? 'red' : count > 0 ? 'orange' : 'green'}>
          {count || 0} 次
        </Tag>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="趋势分析总数"
              value={trendsSummary.total_analyses || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="上升趋势"
              value={trendsSummary.rising || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="下降趋势"
              value={trendsSummary.falling || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="高波动项"
              value={trendsSummary.high_volatility_count || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="趋势分析"
        extra={
          <Space>
            <Select
              style={{ width: 200 }}
              value={selectedShowcase}
              onChange={setSelectedShowcase}
              placeholder="选择展柜"
            >
              {showcases.map((sc) => (
                <Option key={sc.id} value={sc.id}>{sc.name}</Option>
              ))}
            </Select>
            <Select
              style={{ width: 120 }}
              value={selectedSensorType}
              onChange={setSelectedSensorType}
            >
              {sensorTypes.map((st) => (
                <Option key={st.value} value={st.value}>{st.label}</Option>
              ))}
            </Select>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleAutoGenerate}
              loading={autoGenerating}
            >
              生成趋势分析
            </Button>
            <Button type="primary" onClick={loadTrends}>刷新</Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col span={16}>
            <ReactECharts option={trendChartOption} style={{ height: 350 }} />
          </Col>
          <Col span={8}>
            <div className="chart-card">
              <div className="chart-card-title">各传感器类型统计</div>
              {trendsSummary.by_sensor_type && Object.entries(trendsSummary.by_sensor_type).map(([type, data]: [string, any]) => {
                const st = sensorTypes.find(s => s.value === type)
                return (
                  <div key={type} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: st?.color, fontWeight: 500 }}>{st?.label || type}</span>
                      <span>分析 {data.count} 次</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      平均波动率: {(data.avg_volatility * 100).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      平均异常次数: {data.avg_anomaly_count.toFixed(1)} 次
                    </div>
                  </div>
                )
              })}
            </div>
          </Col>
        </Row>

        <div style={{ marginTop: 24 }}>
          <h4 style={{ marginBottom: 12 }}>历史趋势记录</h4>
          <Table
            columns={columns}
            dataSource={trendData}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 5 }}
            size="small"
          />
        </div>
      </Card>
    </div>
  )
}

export default Analytics
