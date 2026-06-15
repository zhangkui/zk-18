# 博物馆文物微环境波动分析与展柜干预决策系统

## 项目简介

本系统是针对博物馆文物保护的智能环境监测与干预决策平台，通过实时采集温湿度、光照、震动等环境参数，结合人工智能算法进行异常波动识别，并提供科学的干预策略推荐，实现文物保存环境的智能化管理。

## 技术栈

### 后端
- **FastAPI**: 高性能 Python Web 框架
- **SQLAlchemy**: ORM 数据库操作
- **Pydantic**: 数据验证

### 数据库
- **TimescaleDB**: 基于 PostgreSQL 的时序数据库，存储结构化数据
- **InfluxDB**: 专业时序数据库，存储传感器时序数据

### 消息中间件
- **EMQX**: 企业级 MQTT 消息 broker

### 前端
- **React 18**: 用户界面框架
- **TypeScript**: 类型安全
- **Ant Design**: UI 组件库
- **ECharts**: 数据可视化
- **Vite**: 构建工具

### 部署
- **Docker Compose**: 容器化部署

## 功能模块

### 1. 时序数据采集
- 支持 MQTT 协议实时接入传感器数据
- 支持温度、湿度、光照、震动四类传感器
- 数据双写：TimescaleDB + InfluxDB
- 数据质量标记

### 2. 展柜环境画像
- 多维度环境参数统计
- 环境稳定性评估
- 风险等级自动判定
- 实时状态监控

### 3. 异常波动识别
- 阈值检测（上限/下限/预警）
- 统计异常检测（Z-Score）
- 变化速率检测
- 波动率检测
- 移动平均偏离检测

### 4. 干预策略推荐
- 基于规则的策略匹配
- 置信度评估
- 多策略排序推荐
- 策略库管理

### 5. 告警闭环管理
- 告警自动生成
- 告警确认机制
- 告警处理流程
- 告警状态追踪

### 6. 人工处置留痕
- 操作记录完整保存
- 状态变化可追溯
- 操作人员管理
- 处置统计分析

### 7. 长期趋势评估
- 周期性趋势分析
- 变化斜率计算
- 波动率统计
- 异常频次分析

## 项目结构

```
zk-18/
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── routers/           # API 路由
│   │   │   ├── showcases.py   # 展柜管理
│   │   │   ├── timeseries.py  # 时序数据
│   │   │   ├── alerts.py      # 告警管理
│   │   │   ├── interventions.py # 干预管理
│   │   │   └── analytics.py   # 分析统计
│   │   ├── services/          # 业务服务
│   │   │   ├── anomaly_detector.py  # 异常检测
│   │   │   ├── intervention_engine.py # 干预引擎
│   │   │   └── profiler.py    # 画像分析
│   │   ├── config.py          # 配置
│   │   ├── database.py        # 数据库连接
│   │   ├── influx_db.py       # InfluxDB 服务
│   │   ├── mqtt_client.py     # MQTT 客户端
│   │   ├── models.py          # 数据模型
│   │   ├── schemas.py         # Pydantic 模型
│   │   └── main.py            # 应用入口
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # React 前端
│   ├── src/
│   │   ├── pages/             # 页面组件
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Showcases.tsx
│   │   │   ├── ShowcaseDetail.tsx
│   │   │   ├── Alerts.tsx
│   │   │   ├── AlertDetail.tsx
│   │   │   ├── Interventions.tsx
│   │   │   ├── InterventionDetail.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── Dispositions.tsx
│   │   ├── services/
│   │   │   └── api.ts         # API 服务
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
│
├── database/                   # 数据库脚本
│   └── timescale/
│       └── init/
│           └── 01_init_schema.sql
│
├── simulator/                  # 数据模拟器
│   ├── Dockerfile
│   ├── requirements.txt
│   └── simulator.py
│
├── docker-compose.yml         # Docker Compose 配置
├── start.bat                  # Windows 启动脚本
├── stop.bat                   # Windows 停止脚本
└── README.md
```

## 快速开始

### 环境要求
- Docker Desktop 4.0+
- 至少 4GB 可用内存
- 至少 10GB 可用磁盘空间

### 一键启动（Windows）

```bash
# 启动所有服务
start.bat

# 停止所有服务
stop.bat
```

### Docker Compose 启动

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 停止服务并清除数据
docker-compose down -v
```

### 本地开发

#### 后端开发

```bash
cd backend

# 创建虚拟环境
python -m venv venv
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
copy .env.example .env

# 启动开发服务器
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 配置环境变量
copy .env.example .env

# 启动开发服务器
npm run dev
```

## 访问地址

启动后可以通过以下地址访问服务：

| 服务 | 地址 | 用户名/密码 |
|------|------|-------------|
| 前端界面 | http://localhost:3000 | - |
| 后端 API | http://localhost:8000 | - |
| API 文档 | http://localhost:8000/docs | - |
| EMQX 控制台 | http://localhost:18083 | admin / public |
| InfluxDB | http://localhost:8086 | admin / admin_secure_2024 |
| TimescaleDB | localhost:5432 | museum_admin / museum_secure_pass_2024 |

## API 文档

### 展柜管理
- `GET /api/showcases/showcases` - 获取展柜列表
- `GET /api/showcases/showcases/{id}` - 获取展柜详情
- `GET /api/showcases/showcases/{id}/profile` - 获取展柜画像
- `POST /api/showcases/showcases/{id}/profile/recalculate` - 重新计算画像

### 时序数据
- `GET /api/timeseries/sensors/{id}/readings` - 获取传感器读数
- `GET /api/timeseries/showcases/{id}/readings` - 获取展柜所有读数
- `GET /api/timeseries/sensors/{id}/latest` - 获取最新读数
- `POST /api/timeseries/sensors/readings` - 手动录入读数
- `GET /api/timeseries/sensors/{id}/anomalies/check` - 检查异常

### 告警管理
- `GET /api/alerts/alerts` - 获取告警列表
- `GET /api/alerts/alerts/{id}` - 获取告警详情
- `POST /api/alerts/alerts` - 创建告警
- `PUT /api/alerts/alerts/{id}/acknowledge` - 确认告警
- `PUT /api/alerts/alerts/{id}/resolve` - 处理告警
- `GET /api/alerts/alerts/summary` - 告警统计

### 干预管理
- `GET /api/interventions/interventions` - 获取干预列表
- `GET /api/interventions/interventions/{id}` - 获取干预详情
- `POST /api/interventions/interventions` - 创建干预
- `PUT /api/interventions/interventions/{id}/start` - 开始干预
- `PUT /api/interventions/interventions/{id}/complete` - 完成干预
- `GET /api/interventions/strategies` - 获取策略列表
- `GET /api/interventions/showcases/{id}/interventions/recommend` - 推荐干预策略

### 分析统计
- `GET /api/analytics/dispositions` - 获取处置记录
- `POST /api/analytics/dispositions` - 创建处置记录
- `GET /api/analytics/trends/showcases/{id}` - 获取趋势分析
- `POST /api/analytics/trends/analyze` - 执行趋势分析
- `GET /api/analytics/trends/summary` - 趋势统计
- `GET /api/analytics/dispositions/summary` - 处置统计

## MQTT 数据格式

### Topic 格式
```
museum/sensor/{sensor_type}/{sensor_code}
```

### Payload 格式
```json
{
  "sensor_code": "S-001-TEMP",
  "sensor_type": "temperature",
  "value": 20.5,
  "unit": "°C",
  "timestamp": "2024-01-01T12:00:00",
  "quality": 1
}
```

## 预置数据

系统启动后会自动初始化以下演示数据：

- 5 个展柜
- 20 个传感器（每展柜 4 个：温度、湿度、光照、震动）
- 6 条干预策略
- 展柜环境画像
- 数据模拟器会自动产生实时传感器数据

## 注意事项

1. 生产环境部署时请务必修改默认密码
2. 数据卷目录会持久化存储数据，删除需谨慎
3. 首次启动需要一定时间初始化数据库
4. 数据模拟器仅用于演示，生产环境请接入真实传感器

## License

MIT
