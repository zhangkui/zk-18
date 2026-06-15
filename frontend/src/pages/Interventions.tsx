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
  DatePicker,
} from 'antd'
import {
  ToolOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { interventionAPI, showcaseAPI } from '@/services/api'
import dayjs from 'dayjs'

const { Option } = Select
const { TextArea } = Input

function Interventions() {
  const navigate = useNavigate()
  const [interventions, setInterventions] = useState<any[]>([])
  const [strategies, setStrategies] = useState<any[]>([])
  const [showcases, setShowcases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [createModal, setCreateModal] = useState(false)
  const [completeModal, setCompleteModal] = useState(false)
  const [currentItem, setCurrentItem] = useState<any>(null)
  const [createForm] = Form.useForm()
  const [completeForm] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [statusFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [interventionsRes, strategiesRes, showcasesRes] = await Promise.all([
        interventionAPI.getAll({ status: statusFilter, limit: 50 }),
        interventionAPI.getStrategies(),
        showcaseAPI.getAll(),
      ])
      setInterventions(interventionsRes.data)
      setStrategies(strategiesRes.data)
      setShowcases(showcasesRes.data)
    } catch (error) {
      console.error('加载干预数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async (id: number) => {
    try {
      await interventionAPI.start(id)
      message.success('干预已开始')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleComplete = (record: any) => {
    setCurrentItem(record)
    setCompleteModal(true)
  }

  const submitComplete = async (values: any) => {
    try {
      await interventionAPI.complete(currentItem.id, values.result_note)
      message.success('干预已完成')
      setCompleteModal(false)
      completeForm.resetFields()
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleCreate = async (values: any) => {
    try {
      await interventionAPI.create({
        ...values,
        scheduled_at: values.scheduled_at?.toISOString(),
      })
      message.success('干预任务已创建')
      setCreateModal(false)
      createForm.resetFields()
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const getStatusTag = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'orange',
      in_progress: 'blue',
      completed: 'green',
      cancelled: 'default',
    }
    const texts: Record<string, string> = {
      pending: '待处理',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    }
    return <Tag color={colors[status] || 'default'}>{texts[status] || status}</Tag>
  }

  const getActionTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      high: { color: 'red', text: '高级干预' },
      medium: { color: 'orange', text: '中级干预' },
      low: { color: 'green', text: '常规维护' },
      preventive: { color: 'blue', text: '预防性' },
    }
    const info = typeMap[type] || { color: 'default', text: type }
    return <Tag color={info.color}>{info.text}</Tag>
  }

  const pendingCount = interventions.filter(i => i.status === 'pending').length
  const inProgressCount = interventions.filter(i => i.status === 'in_progress').length
  const completedCount = interventions.filter(i => i.status === 'completed').length

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '类型',
      dataIndex: 'action_type',
      key: 'action_type',
      width: 120,
      render: (type: string) => getActionTypeTag(type),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '展柜ID',
      dataIndex: 'showcase_id',
      key: 'showcase_id',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '操作人员',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/interventions/${record.id}`)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStart(record.id)}
            >
              开始
            </Button>
          )}
          {record.status === 'in_progress' && (
            <Button
              type="link"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleComplete(record)}
            >
              完成
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="待处理干预"
              value={pendingCount}
              valueStyle={{ color: '#faad14' }}
              prefix={<ToolOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="进行中干预"
              value={inProgressCount}
              valueStyle={{ color: '#1890ff' }}
              prefix={<PlayCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card className="stat-card">
            <Statistic
              title="已完成干预"
              value={completedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="干预任务列表"
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
              <Option value="in_progress">进行中</Option>
              <Option value="completed">已完成</Option>
            </Select>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
              新建干预
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={interventions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Card title="干预策略库" size="small" style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          {strategies.map((strategy) => (
            <Col span={8} key={strategy.id}>
              <Card size="small" hoverable>
                <Card.Meta
                  title={
                    <Space>
                      <span style={{ fontWeight: 500 }}>{strategy.name}</span>
                      <Tag color={strategy.severity_level === 'high' ? 'red' : strategy.severity_level === 'medium' ? 'orange' : 'green'}>
                        {strategy.severity_level === 'high' ? '高级' : strategy.severity_level === 'medium' ? '中级' : '低级'}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <p style={{ marginBottom: 4 }}>{strategy.description}</p>
                      <div style={{ color: '#999', fontSize: 12 }}>
                        适用传感器: {strategy.applicable_sensor_types?.join(', ') || '全部'}
                      </div>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Modal
        title="新建干预任务"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        footer={null}
        width={500}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="showcase_id"
            label="目标展柜"
            rules={[{ required: true, message: '请选择展柜' }]}
          >
            <Select placeholder="请选择展柜">
              {showcases.map((sc) => (
                <Option key={sc.id} value={sc.id}>{sc.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="description"
            label="任务描述"
            rules={[{ required: true, message: '请输入任务描述' }]}
          >
            <TextArea rows={3} placeholder="请输入任务描述..." />
          </Form.Item>
          <Form.Item
            name="action_type"
            label="干预类型"
            rules={[{ required: true, message: '请输入干预类型' }]}
          >
            <Input placeholder="如：温度调节、湿度调节、设备维护等" />
          </Form.Item>
          <Form.Item name="scheduled_at" label="计划时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="operator" label="操作人员">
            <Input placeholder="请输入操作人员姓名" defaultValue="系统管理员" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="完成干预"
        open={completeModal}
        onCancel={() => setCompleteModal(false)}
        footer={null}
        width={500}
      >
        <Form form={completeForm} layout="vertical" onFinish={submitComplete}>
          <Form.Item
            name="result_note"
            label="完成说明"
            rules={[{ required: true, message: '请输入完成说明' }]}
          >
            <TextArea rows={4} placeholder="请输入完成情况说明..." />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCompleteModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认完成</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Interventions
