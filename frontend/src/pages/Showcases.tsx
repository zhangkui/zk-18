import { useState, useEffect } from 'react'
import { Row, Col, Card, Tag, Button, Space, Input, Select } from 'antd'
import { EnvironmentOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { showcaseAPI } from '@/services/api'

const { Search } = Input
const { Option } = Select

function Showcases() {
  const navigate = useNavigate()
  const [showcases, setShowcases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()

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
      <Card
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: '12px 24px' }}
      >
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
                      {showcase.status === 'active' ? '运行中' : '离线'}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 8 }}>编号: {showcase.code}</div>
                    <div style={{ marginBottom: 8 }}>{showcase.location}</div>
                    <div style={{ marginBottom: 8 }}>
                      <Tag className={`risk-tag ${getRiskLevelClass('low')}`}>
                        {getRiskLevelText('low')}
                      </Tag>
                    </div>
                    <Space size="middle">
                      <span style={{ color: '#666' }}>
                        温度: 20.5°C
                      </span>
                      <span style={{ color: '#666' }}>
                        湿度: 50.2%RH
                      </span>
                    </Space>
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
    </div>
  )
}

export default Showcases
