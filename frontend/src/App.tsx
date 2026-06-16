import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { Layout, Menu, Button, Dropdown, Avatar } from 'antd'
import {
  DashboardOutlined,
  EnvironmentOutlined,
  AlertOutlined,
  ToolOutlined,
  BarChartOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Showcases from './pages/Showcases'
import ShowcaseDetail from './pages/ShowcaseDetail'
import Alerts from './pages/Alerts'
import AlertDetail from './pages/AlertDetail'
import Interventions from './pages/Interventions'
import InterventionDetail from './pages/InterventionDetail'
import Analytics from './pages/Analytics'
import Dispositions from './pages/Dispositions'
import Login from './pages/Login'
import SensorManagement from './pages/SensorManagement'
import StrategyManagement from './pages/StrategyManagement'
import UserManagement from './pages/UserManagement'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">数据概览</Link> },
  { key: '/showcases', icon: <EnvironmentOutlined />, label: <Link to="/showcases">展柜管理</Link> },
  { key: '/sensors', icon: <AppstoreOutlined />, label: <Link to="/sensors">传感器管理</Link> },
  { key: '/alerts', icon: <AlertOutlined />, label: <Link to="/alerts">告警中心</Link> },
  { key: '/interventions', icon: <ToolOutlined />, label: <Link to="/interventions">干预决策</Link> },
  { key: '/strategies', icon: <SafetyCertificateOutlined />, label: <Link to="/strategies">干预策略</Link> },
  { key: '/analytics', icon: <BarChartOutlined />, label: <Link to="/analytics">趋势分析</Link> },
  { key: '/dispositions', icon: <FileTextOutlined />, label: <Link to="/dispositions">处置记录</Link> },
  { key: '/users', icon: <TeamOutlined />, label: <Link to="/users">用户管理</Link> },
]

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr))
      } catch {
        setCurrentUser(null)
      }
    }
  }, [])

  if (location.pathname === '/login') {
    return <Login />
  }

  const token = localStorage.getItem('token')
  if (!token) {
    return <Login />
  }

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/showcases/')) return '/showcases'
    if (location.pathname.startsWith('/alerts/')) return '/alerts'
    if (location.pathname.startsWith('/interventions/')) return '/interventions'
    return location.pathname
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setCurrentUser(null)
    navigate('/login')
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ]

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <h1 className="app-header-title">博物馆文物微环境波动分析与展柜干预决策系统</h1>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" style={{ color: 'white' }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />
            {currentUser?.real_name || currentUser?.username || '用户'}
          </Button>
        </Dropdown>
      </Header>
      <Layout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[getSelectedKey()]}
            items={menuItems}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/showcases" element={<Showcases />} />
            <Route path="/showcases/:id" element={<ShowcaseDetail />} />
            <Route path="/sensors" element={<SensorManagement />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/alerts/:id" element={<AlertDetail />} />
            <Route path="/interventions" element={<Interventions />} />
            <Route path="/interventions/:id" element={<InterventionDetail />} />
            <Route path="/strategies" element={<StrategyManagement />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/dispositions" element={<Dispositions />} />
            <Route path="/users" element={<UserManagement />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
