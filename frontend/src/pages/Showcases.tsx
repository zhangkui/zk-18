import { useState, useEffect } from 'react'
import { Row, Col, Card, Tag, Button, Space, Input, Select, Modal, Form, message, Popconfirm } from 'antd'
import { EnvironmentOutlined, SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { showcaseAPI } from '@/services/api'
import dayjs from 'dayjs'

const { Search } = Input
const { Option } = Select

function Showcases() {
  const navigate = useNavigate()
  const [showcases, setShowcases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadShowcases()
  }, [])

  const loadShowcases = async () => {
    setLoading(true)
    try {
      const res = await showcaseAPI.getAll()
      setShowcases(res.data)
    } catch (error) {
      console.error('加载展柜列表失败:', error)
    } finally {
      setLoading(false)
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

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({ status: 'active' })
    setModalVisible(true)
  }

  const handleEdit = (item: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setEditingItem(item)
    form.setFieldsValue({
      code: item.code,
      name: item.name,
      location: item.location,
      description: item.description,
      status: item.status,
    })
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingItem) {
        await showcaseAPI.update(editingItem.id, values)
        message.success('展柜更新成功')
      } else {
        await showcaseAPI.create(values)
        message.success('展柜创建成功')
      }
      setModalVisible(false)
      loadShowcases()
    } catch (error: any) {
      if (error.response?.data?.detail) {
        message.error(error.response.data.detail)
      }
    }
  }

  const handleDisable = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await showcaseAPI.disable(id)
      message.success('展柜已停用')
      loadShowcases()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleEnable = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await showcaseAPI.enable(id)
      message.success('展柜已启用')
      loadShowcases()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '操作失败')
    }
  }

  const handleDelete = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await showcaseAPI.delete(id)
      message.success('展柜已删除')
      loadShowcases()
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败')
    }
  }

  const filteredShowcases = showcases.filter(item => {
    if (searchText && !item.name.includes(searchText) && !item.code.includes(searchText)) {
      return false
    }
    if (statusFilter && item.status !== statusFilter) {
      return false
    }
    return true
  })

  return (
    <div>
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 24px' }}>
        <Space>
          <Search
            placeholder="搜索展柜名称/编号"
            allowClear
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
            onSearch={(value) => setSearchText(value)}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 150 }}
            onChange={setStatusFilter}
          >
            <Option value="active">运行中</Option>
            <Option value="inactive">已停用</Option>
            <Option value="maintenance">维护中</Option>
          </Select>
          <Button type="primary" onClick={loadShowcases}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增展柜</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        {filteredShowcases.map((showcase) => (
          <Col span={8} key={showcase.id}>
            <Card
              className="showcase-card"
              hoverable
              onClick={() => navigate(`/showcases/${showcase.id}`)}
            >
              <Card.Meta
                avatar={<EnvironmentOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
                title={
                  <Space>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{showcase.name}</span>
                    <Tag color={showcase.status === 'active' ? 'green' : 'default'}>
                      {showcase.status === 'active' ? '运行中' : '已停用'}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 8 }}>编号: {showcase.code}</div>
                    <div style={{ marginBottom: 8 }}>{showcase.location}</div>
                    <div style={{ marginBottom: 8 }}>
                      <Tag className={`risk-tag ${getRiskLevelClass(showcase.risk_level || 'low')}`}>
                        {getRiskLevelText(showcase.risk_level || 'low')}
                      </Tag>
                    </div>
                    <Space size="middle">
                      <span style={{ color: '#666' }}>
                        温度: {showcase.latest_data?.temperature ? `${showcase.latest_data.temperature.value}°C` : '-'}
                      </span>
                      <span style={{ color: '#666' }}>
                        湿度: {showcase.latest_data?.humidity ? `${showcase.latest_data.humidity.value}%RH` : '-'}
                      </span>
                    </Space>
                    <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                      <Space size="small">
                        <Button type="link" size="small" icon={<EditOutlined />} onClick={(e) => handleEdit(showcase, e)}>编辑</Button>
                        {showcase.status === 'active' ? (
                          <Button type="link" size="small" danger onClick={(e) => handleDisable(showcase.id, e)}>停用</Button>
                        ) : (
                          <Button type="link" size="small" onClick={(e) => handleEnable(showcase.id, e)}>启用</Button>
                        )}
                        <Popconfirm title="确定删除该展柜？" onConfirm={(e) => handleDelete(showcase.id, e as any)}>
                          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {filteredShowcases.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          暂无展柜数据
        </div>
      )}

      <Modal
        title={editingItem ? '编辑展柜' : '新增展柜'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="展柜编号" rules={[{ required: true, message: '请输入展柜编号' }]}>
            <Input placeholder="请输入展柜编号" />
          </Form.Item>
          <Form.Item name="name" label="展柜名称" rules={[{ required: true, message: '请输入展柜名称' }]}>
            <Input placeholder="请输入展柜名称" />
          </Form.Item>
          <Form.Item name="location" label="所在位置">
            <Input placeholder="请输入所在位置" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="active">运行中</Option>
              <Option value="inactive">已停用</Option>
              <Option value="maintenance">维护中</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Showcases
