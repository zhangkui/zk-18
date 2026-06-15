import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Row,
  Col,
  List,
  Form,
  Input,
  Modal,
  message,
  Divider,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ToolOutlined,
  EnvironmentOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { alertAPI, interventionAPI } from '@/services/api'
import dayjs from 'dayjs'

const { TextArea } = Input

function AlertDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [resolveModal, setResolveModal] = useState(false)
  const [createInterventionModal, setCreateInterventionModal] = useState(false)
  const [resolveForm] = Form.useForm()
  const [interventionForm] = Form.useForm()

  useEffect(() => {
    if (id) {
      loadDetail()
    }
  }, [id])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const res = await alertAPI.getDetail(Number(id))
      setDetail(res.data)
      if (res.data.recommendations) {
        setRecommendations(res.data.recommendations)
      }
    } catch (error) {
      console.error('加载告警详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAcknowledge = async () => {
    try {
      await alertAPI.acknowledge(Number(id))
      message.success('告警已确认')
      loadDetail()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleResolve = async (values: any) => {
    try {
      await alertAPI.resolve(Number(id), values.resolution_note)
      message.success('告警已处理')
      setResolveModal(false)
      resolveForm.resetFields()
      loadDetail()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleCreateIntervention = async (values: any) => {
    try {
      await interventionAPI.create({
        ...values,
        showcase_id: detail?.showcase?.id,
        alert_id: Number(id),
      })
      message.success('干预任务已创建')
      setCreateInterventionModal(false)
      interventionForm.resetFields()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#52c41a'
    if (confidence >= 0.5) return '#faad14'
    return '#ff4d4f'
  }

  return (
    <div>
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 24px' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/alerts')}>返回列表</Button>
          <h2 style={{ margin: 0 }}>告警详情</h2>
          {detail?.alert && getLevelTag(detail.alert.level)}
          {detail?.alert && getStatusTag(detail.alert.status)}
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="基本信息" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="告警ID">{detail?.alert?.id}</Descriptions.Item>
              <Descriptions.Item label="告警类型">{detail?.alert?.alert_type}</Descriptions.Item>
              <Descriptions.Item label="告警级别" span={2}>
                {detail?.alert && getLevelTag(detail.alert.level)}
              </Descriptions.Item>
              <Descriptions.Item label="告警消息" span={2}>
                {detail?.alert?.message}
              </Descriptions.Item>
              <Descriptions.Item label="当前值">{detail?.alert?.value}</Descriptions.Item>
              <Descriptions.Item label="阈值">{detail?.alert?.threshold}</Descriptions.Item>
              <Descriptions.Item label="触发时间">
                {detail?.alert?.triggered_at && dayjs(detail.alert.triggered_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail?.alert && getStatusTag(detail.alert.status)}
              </Descriptions.Item>
              {detail?.alert?.acknowledged_at && (
                <Descriptions.Item label="确认时间">
                  {dayjs(detail.alert.acknowledged_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {detail?.alert?.acknowledged_by && (
                <Descriptions.Item label="确认人">{detail.alert.acknowledged_by}</Descriptions.Item>
              )}
              {detail?.alert?.resolved_at && (
                <Descriptions.Item label="处理时间">
                  {dayjs(detail.alert.resolved_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {detail?.alert?.resolved_by && (
                <Descriptions.Item label="处理人">{detail.alert.resolved_by}</Descriptions.Item>
              )}
              {detail?.alert?.resolution_note && (
                <Descriptions.Item label="处理说明" span={2}>
                  {detail.alert.resolution_note}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            <Space>
              {detail?.alert?.status === 'pending' && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleAcknowledge}>
                  确认告警
                </Button>
              )}
              {['pending', 'acknowledged'].includes(detail?.alert?.status) && (
                <Button type="primary" icon={<ToolOutlined />} onClick={() => setResolveModal(true)}>
                  处理告警
                </Button>
              )}
              {['pending', 'acknowledged'].includes(detail?.alert?.status) && (
                <Button icon={<BulbOutlined />} onClick={() => setCreateInterventionModal(true)}>
                  创建干预任务
                </Button>
              )}
            </Space>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="关联信息" size="small">
            {detail?.sensor && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>传感器</h4>
                <p>名称: {detail.sensor.name}</p>
                <p>编号: {detail.sensor.code}</p>
                <p>类型: {detail.sensor.sensor_type}</p>
                <p>量程: {detail.sensor.min_threshold} ~ {detail.sensor.max_threshold} {detail.sensor.unit}</p>
              </div>
            )}
            {detail?.showcase && (
              <div>
                <h4 style={{ marginBottom: 8 }}>展柜</h4>
                <p>名称: {detail.showcase.name}</p>
                <p>编号: {detail.showcase.code}</p>
                <p>位置: {detail.showcase.location}</p>
                <Button
                  type="link"
                  icon={<EnvironmentOutlined />}
                  onClick={() => navigate(`/showcases/${detail.showcase.id}`)}
                >
                  查看展柜详情
                </Button>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="干预策略推荐" size="small" style={{ marginTop: 16 }}>
        {recommendations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>暂无推荐策略</div>
        ) : (
          <List
            dataSource={recommendations}
            renderItem={(item) => (
              <List.Item key={item.strategy_id}>
                <List.Item.Meta
                  title={
                    <Space>
                      <span style={{ fontWeight: 500 }}>{item.strategy_name}</span>
                      <Tag color="blue">{item.action_type}</Tag>
                      <span style={{ color: getConfidenceColor(item.confidence), fontWeight: 600 }}>
                        置信度: {(item.confidence * 100).toFixed(0)}%
                      </span>
                    </Space>
                  }
                  description={
                    <div>
                      <p style={{ marginBottom: 4 }}>{item.description}</p>
                      {item.match_reasons && item.match_reasons.length > 0 && (
                        <div>
                          匹配原因:
                          {item.match_reasons.map((reason: string, idx: number) => (
                            <Tag key={idx} color="green">{reason}</Tag>
                          ))}
                        </div>
                      )}
                      {item.action_steps && item.action_steps.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <strong>操作步骤:</strong>
                          <ol style={{ marginLeft: 20, marginTop: 4 }}>
                            {item.action_steps.map((step: string, idx: number) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  }
                />
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    interventionForm.setFieldsValue({
                      description: item.description,
                      action_type: item.action_type,
                      strategy_id: item.strategy_id,
                    })
                    setCreateInterventionModal(true)
                  }}
                >
                  采用此策略
                </Button>
              </List.Item>
            )}
          />
        )}
      </Card>

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

      <Modal
        title="创建干预任务"
        open={createInterventionModal}
        onCancel={() => setCreateInterventionModal(false)}
        footer={null}
        width={500}
      >
        <Form form={interventionForm} layout="vertical" onFinish={handleCreateIntervention}>
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
            rules={[{ required: true, message: '请选择干预类型' }]}
          >
            <Input placeholder="请输入干预类型" />
          </Form.Item>
          <Form.Item name="operator" label="操作人员">
            <Input placeholder="请输入操作人员姓名" defaultValue="系统管理员" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateInterventionModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AlertDetail
