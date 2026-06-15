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
  Modal,
  Form,
  Input,
  message,
  Divider,
} from 'antd'
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  AlertOutlined,
} from '@ant-design/icons'
import { interventionAPI } from '@/services/api'
import dayjs from 'dayjs'

const { TextArea } = Input

function InterventionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [completeModal, setCompleteModal] = useState(false)
  const [completeForm] = Form.useForm()

  useEffect(() => {
    if (id) {
      loadDetail()
    }
  }, [id])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const res = await interventionAPI.getDetail(Number(id))
      setDetail(res.data)
    } catch (error) {
      console.error('加载干预详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async () => {
    try {
      await interventionAPI.start(Number(id))
      message.success('干预已开始')
      loadDetail()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleComplete = async (values: any) => {
    try {
      await interventionAPI.complete(Number(id), values.result_note)
      message.success('干预已完成')
      setCompleteModal(false)
      completeForm.resetFields()
      loadDetail()
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

  return (
    <div>
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 24px' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/interventions')}>返回列表</Button>
          <h2 style={{ margin: 0 }}>干预任务详情</h2>
          {detail?.intervention && getStatusTag(detail.intervention.status)}
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col span={16}>
          <Card title="基本信息" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="任务ID">{detail?.intervention?.id}</Descriptions.Item>
              <Descriptions.Item label="干预类型">{detail?.intervention?.action_type}</Descriptions.Item>
              <Descriptions.Item label="状态" span={2}>
                {detail?.intervention && getStatusTag(detail.intervention.status)}
              </Descriptions.Item>
              <Descriptions.Item label="任务描述" span={2}>
                {detail?.intervention?.description}
              </Descriptions.Item>
              <Descriptions.Item label="操作人员">{detail?.intervention?.operator || '-'}</Descriptions.Item>
              <Descriptions.Item label="策略ID">{detail?.intervention?.strategy_id || '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detail?.intervention?.created_at && dayjs(detail.intervention.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="计划时间">
                {detail?.intervention?.scheduled_at
                  ? dayjs(detail.intervention.scheduled_at).format('YYYY-MM-DD HH:mm:ss')
                  : '-'}
              </Descriptions.Item>
              {detail?.intervention?.started_at && (
                <Descriptions.Item label="开始时间">
                  {dayjs(detail.intervention.started_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {detail?.intervention?.completed_at && (
                <Descriptions.Item label="完成时间">
                  {dayjs(detail.intervention.completed_at).format('YYYY-MM-DD HH:mm:ss')}
                </Descriptions.Item>
              )}
              {detail?.intervention?.result_note && (
                <Descriptions.Item label="完成说明" span={2}>
                  {detail.intervention.result_note}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider />

            <Space>
              {detail?.intervention?.status === 'pending' && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>
                  开始执行
                </Button>
              )}
              {detail?.intervention?.status === 'in_progress' && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setCompleteModal(true)}>
                  完成干预
                </Button>
              )}
            </Space>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="关联信息" size="small">
            {detail?.showcase && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>目标展柜</h4>
                <p>名称: {detail.showcase.name}</p>
                <p>编号: {detail.showcase.code}</p>
                <p>位置: {detail.showcase.location}</p>
                <Button
                  type="link"
                  icon={<EnvironmentOutlined />}
                  onClick={() => navigate(`/showcases/${detail.showcase.id}`)}
                >
                  查看展柜
                </Button>
              </div>
            )}
            {detail?.alert && (
              <div>
                <h4 style={{ marginBottom: 8 }}>关联告警</h4>
                <p>告警ID: {detail.alert.id}</p>
                <p>消息: {detail.alert.message}</p>
                <Button
                  type="link"
                  icon={<AlertOutlined />}
                  onClick={() => navigate(`/alerts/${detail.alert.id}`)}
                >
                  查看告警
                </Button>
              </div>
            )}
            {detail?.strategy && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 8 }}>使用策略</h4>
                <p>策略名称: {detail.strategy.name}</p>
                <p>策略编码: {detail.strategy.code}</p>
                <p>级别: {detail.strategy.severity_level}</p>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="完成干预"
        open={completeModal}
        onCancel={() => setCompleteModal(false)}
        footer={null}
        width={500}
      >
        <Form form={completeForm} layout="vertical" onFinish={handleComplete}>
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

export default InterventionDetail
