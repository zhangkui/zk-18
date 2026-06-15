import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  EnvironmentOutlined,
  AlertOutlined,
  ToolOutlined,
  BarChartOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import Dashboard from './pages/Dashboard'
import Showcases from './pages/Showcases'
import ShowcaseDetail from './pages/ShowcaseDetail'
import Alerts from './pages/Alerts'
import AlertDetail from './pages/AlertDetail'
import Interventions from './pages/Interventions'
import InterventionDetail from './pages/InterventionDetail'
import Analytics from './pages/Analytics'
import Dispositions from './pages/Dispositions'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">数据概览</Link> },
  { key: '/showcases', icon: <EnvironmentOutlined />, label: <Link to="/showcases">展柜管理</Link> },
  { key: '/alerts', icon: <AlertOutlined />, label: <Link to="/alerts">告警中心</Link> },
  { key: '/interventions', icon: <ToolOutlined />, label: <Link to="/interventions">干预决策</Link> },
  { key: '/analytics', icon: <BarChartOutlined />, label: <Link to="/analytics">趋势分析</Link> },
  { key: '/dispositions', icon: <FileTextOutlined />, label: <Link to="/dispositions">处置记录</Link> },
]

function App() {
  const location = useLocation()

  const getSelectedKey = () => {
    if (location.pathname.startsWith('/showcases/')) return '/showcases'
    if (location.pathname.startsWith('/alerts/')) return '/alerts'
    if (location.pathname.startsWith('/interventions/')) return '/interventions'
    return location.pathname
  }

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <h1 className="app-header-title">博物馆文物微环境波动分析与展柜干预决策系统</h1>
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
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/alerts/:id" element={<AlertDetail />} />
            <Route path="/interventions" element={<Interventions />} />
            <Route path="/interventions/:id" element={<InterventionDetail />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/dispositions" element={<Dispositions />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
