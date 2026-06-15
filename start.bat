@echo off
echo ========================================
echo 博物馆文物微环境分析系统 - 启动脚本
echo ========================================
echo.

echo [1/5] 检查 Docker 是否运行...
docker version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: Docker 未运行，请先启动 Docker Desktop
    pause
    exit /b 1
)
echo Docker 运行正常
echo.

echo [2/5] 构建并启动所有服务...
docker-compose up -d --build
if %errorlevel% neq 0 (
    echo 错误: 服务启动失败
    pause
    exit /b 1
)
echo 服务启动中...
echo.

echo [3/5] 等待数据库就绪...
timeout /t 30 /nobreak >nul
echo.

echo [4/5] 检查服务状态...
docker-compose ps
echo.

echo [5/5] 服务启动完成！
echo.
echo ========================================
echo 服务访问地址:
echo - 前端界面: http://localhost:3000
echo - 后端 API: http://localhost:8000
echo - API 文档: http://localhost:8000/docs
echo - EMQX 控制台: http://localhost:18083 (admin/public)
echo - InfluxDB: http://localhost:8086
echo ========================================
echo.
echo 提示: 运行 stop.bat 可停止所有服务
pause
