#!/usr/bin/env pwsh
# 快速部署脚本

Write-Host "=== 每日工作台部署助手 ===" -ForegroundColor Cyan
Write-Host ""

# 检查构建
if (-not (Test-Path "dist")) {
    Write-Host "构建项目..." -ForegroundColor Yellow
    npm run build
}

Write-Host "✓ 项目已构建" -ForegroundColor Green
Write-Host ""

# 检查 Git 状态
Write-Host "Git 仓库状态:" -ForegroundColor Cyan
git status --short
Write-Host ""

# 提供部署选项
Write-Host "请选择部署方式:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 通过 GitHub + Vercel 自动部署 (推荐)" -ForegroundColor White
Write-Host "   - 需要先创建 GitHub 仓库" -ForegroundColor Gray
Write-Host "   - 每次 push 自动部署" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 使用 Vercel CLI 直接部署" -ForegroundColor White
Write-Host "   - 需要先运行 'vercel login'" -ForegroundColor Gray
Write-Host "   - 每次手动部署" -ForegroundColor Gray
Write-Host ""

$choice = Read-Host "请输入选项 (1 或 2)"

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "=== GitHub 部署步骤 ===" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. 访问: https://github.com/new" -ForegroundColor White
    Write-Host "2. 创建新仓库后，运行以下命令:" -ForegroundColor White
    Write-Host ""
    Write-Host "   git remote add origin https://github.com/你的用户名/仓库名.git" -ForegroundColor Yellow
    Write-Host "   git branch -M main" -ForegroundColor Yellow
    Write-Host "   git push -u origin main" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "3. 然后访问: https://vercel.com/new" -ForegroundColor White
    Write-Host "4. 导入你的 GitHub 仓库" -ForegroundColor White
    Write-Host "5. 点击 Deploy" -ForegroundColor White
    Write-Host ""

    $continue = Read-Host "已创建 GitHub 仓库? (y/n)"
    if ($continue -eq "y") {
        $repo = Read-Host "请输入完整的仓库地址 (如: https://github.com/user/repo.git)"
        if ($repo) {
            git remote add origin $repo 2>$null
            git branch -M main
            git push -u origin main
            Write-Host ""
            Write-Host "✓ 代码已推送到 GitHub" -ForegroundColor Green
            Write-Host "现在访问 https://vercel.com/new 导入仓库" -ForegroundColor Cyan
        }
    }

} elseif ($choice -eq "2") {
    Write-Host ""
    Write-Host "=== Vercel CLI 部署 ===" -ForegroundColor Cyan
    Write-Host ""

    # 检查是否已登录
    $loggedIn = $false
    try {
        $null = vercel whoami 2>&1
        if ($LASTEXITCODE -eq 0) {
            $loggedIn = $true
        }
    } catch {}

    if (-not $loggedIn) {
        Write-Host "需要先登录 Vercel" -ForegroundColor Yellow
        Write-Host "运行: vercel login" -ForegroundColor White
        Write-Host ""
        $doLogin = Read-Host "现在登录? (y/n)"
        if ($doLogin -eq "y") {
            vercel login
        } else {
            Write-Host "请手动运行: vercel login" -ForegroundColor Yellow
            exit
        }
    }

    Write-Host ""
    Write-Host "开始部署到 Vercel..." -ForegroundColor Yellow
    npx vercel --prod

} else {
    Write-Host "无效选项" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== 下一步 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "查看 NEXT_STEPS.md 了解如何配置:" -ForegroundColor White
Write-Host "  - Supabase 数据库和认证" -ForegroundColor Gray
Write-Host "  - Google OAuth" -ForegroundColor Gray
Write-Host "  - 环境变量" -ForegroundColor Gray
Write-Host ""
