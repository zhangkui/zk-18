import { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Select,
  Modal,
  Form,
  Input,
  message,
  Row,
  Col,
  Statistic,
} from 'antd'
import {
  AlertOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ExclamationCircleOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { alertAPI } from '@/services/api'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

function Alerts() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [levelFilter, setLevelFilter] = useState<string | undefined>()
  const [detailModal, setDetailModal] = useState(false)
  const [currentAlert, setCurrentAlert] = useState<any>(null)
  const [resolveModal, setResolveModal] = useState(false)
  const [resolveForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [statusFilter, levelFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [alertsRes, summaryRes] = await Promise.all([
        alertAPI.getAll({ status: statusFilter, level: levelFilter, limit: 50 }),
        alertAPI.getSummary(),
      ])
      setAlerts(alertsRes.data)
      setSummary(summaryRes.data)
    } catch (error) {
      console.error('加载告警数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledge = async (id: number) => {
    try {
      await alertAPI.acknowledge(id)
      message.success('告警已确认')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleResolve = async (values: any) => {
    try {
      await alertAPI.resolve(currentAlert.id, values.resolution_note)
      message.success('告警已处理')
      setResolveModal(false)
      resolveForm.resetFields()
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const openResolveModal = (record: any) => {
    setCurrentAlert(record)
    setResolveModal(true)
  }

  const viewDetail = async (record: any) => {
    try {
      const res = await alertAPI.getDetail(record.id)
      setCurrentAlert(res.data)
      setDetailModal(true)
    } catch (error) {
      console.error('加载告警详情失败:', error)
    }
  }

  const getLevelTag = (level: string) => {
    const colors: Record<string, string> = {
      critical: 'red',
      warning: 'orange',
      info: 'blue',
    }
    const texts: Record<string, string> = {
      critical: '严重',
      warning: '警告',
      info: '提示',
    }
    return <Tag color={colors[level] || 'default'}>{texts[level] || level}</Tag>
  }

  const getStatusTag = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'red',
      acknowledged: 'orange',
      resolved: 'green',
      closed: 'default',
    }
    const texts: Record<string, string> = {
      pending: '待处理',
      acknowledged: '已确认',
      resolved: '已处理',
      closed: '已关闭',
    }
    return <Tag color={colors[status] || 'default'}>{texts[status] || status}</Tag>
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => getLevelTag(level),
    },
    {
      title: '类型',
      dataIndex: 'alert_type',
      key: 'alert_type',
      width: 120,
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '当前值',
      dataIndex: 'value',
      key: 'value',
      width: 100,
    },
    {
      title: '阈值',
      dataIndex: 'threshold',
      key: 'threshold',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '负责人',
      dataIndex: 'assigned_user_name',
      key: 'assigned_user_name',
      width: 100,
      render: (name: string) => name || '-',
    },
    {
      title: '触发时间',
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/alerts/${record.id}`)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleAcknowledge(record.id)}
            >
              确认
            </Button>
          )}
          {['pending', 'acknowledged'].includes(record.status) && (
            <Button
              type="link"
              size="small"
              icon={<ToolOutlined />}
              onClick={() => openResolveModal(record)}
            >
              处理
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="待处理"
              value={summary.pending || 0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="已确认"
              value={summary.acknowledged || 0}
              valueStyle={{ color: '#faad14' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="已处理"
              value={summary.resolved || 0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="24小时内"
              value={summary.last_24h_count || 0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="告警列表"
        extra={
          <Space>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="pending">待处理</Option>
              <Option value="acknowledged">已确认</Option>
              <Option value="resolved">已处理</Option>
            </Select>
            <Select
              placeholder="级别筛选"
              allowClear
              style={{ width: 120 }}
              value={levelFilter}
              onChange={setLevelFilter}
            >
              <Option value="critical">严重</Option>
              <Option value="warning">警告</Option>
              <Option value="info">提示</Option>
            </Select>
            <Button type="primary" onClick={loadData}>刷新</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={alerts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title="告警详情"
        open={detailModal}
        onCancel={() => setDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModal(false)}>关闭</Button>,
          <Button key="detail" type="primary" onClick={() => {
            setDetailModal(false)
            navigate(`/alerts/${currentAlert?.id}`)
          }}>查看完整详情</Button>,
        ]}
        width={600}
      >
        {currentAlert && (
          <div>
            <p><strong>级别:</strong> {getLevelTag(currentAlert.alert?.level || currentAlert.level)}</p>
            <p><strong>类型:</strong> {currentAlert.alert?.alert_type || currentAlert.alert_type}</p>
            <p><strong>消息:</strong> {currentAlert.alert?.message || currentAlert.message}</p>
            <p><strong>状态:</strong> {getStatusTag(currentAlert.alert?.status || currentAlert.status)}</p>
            <p><strong>触发时间:</strong> {dayjs(currentAlert.alert?.triggered_at || currentAlert.triggered_at).format('YYYY-MM-DD HH:mm:ss')}</p>
          </div>
        )}
      </Modal>

      <Modal
        title="处理告警"
        open={resolveModal}
        onCancel={() => setResolveModal(false)}
        footer={null}
        width={500}
      >
        <Form form={resolveForm} layout="vertical" onFinish={handleResolve}>
          <Form.Item
            name="resolution_note"
            label="处理说明"
            rules={[{ required: true, message: '请输入处理说明' }]}
          >
            <TextArea rows={4} placeholder="请输入处理说明..." />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setResolveModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认处理</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Alerts
