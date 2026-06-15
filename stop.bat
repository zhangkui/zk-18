@echo off
echo ========================================
echo 博物馆文物微环境分析系统 - 停止脚本
echo ========================================
echo.

echo 正在停止所有服务...
docker-compose down
if %errorlevel% neq 0 (
    echo 警告: 停止服务时出现错误
) else (
    echo 所有服务已停止
)

echo.
echo 提示: 如需同时清除数据卷，请使用: docker-compose down -v
pause
