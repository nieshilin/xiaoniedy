# 小聂的仿都抖音项目

### 项目预览



![](https://raw.githubusercontent.com/nieshilin/xiaoniedy/refs/heads/master/1.png)

![](https://raw.githubusercontent.com/nieshilin/xiaoniedy/refs/heads/master/2.png)

使用说明

  1.git此项目

2. 安装依赖

npm install

4. 启动服务器

node server.js

服务器将在 http://localhost:3000 启动

## 目录结构

video-server/
├── node_modules/
├── public/
│   └── vlog/
│       └── [创作者文件夹]/
│           ├── *.mp4    # 视频文件
│           ├── *.jpg    # 缩略图
│           └── tx.jpg   # 头像
├── package.json
├── package-lock.json
└── server.js

注意事项：

1. 需要 Node.js 版本 >= 12

   2.确保系统有足够的磁盘空间存储视频文件

   3.文件夹需要适当的读写权限

### 使用的主要依赖

- express: Web 服务器框架
- fluent-ffmpeg: 视频处理
- @ffmpeg-installer/ffmpeg: FFmpeg 自动安装

## 配置说明

服务器默认运行在 3000 端口，如需修改，请在 `server.js` 中修改

### 添加新视频

1. 在 `public/vlog` 下创建创作者文件夹

2. 将创作者头像命名为 `tx.jpg` 放入对应文件夹

3. 将视频文件（.mp4格式）放入对应文件夹

4. 视频文件命名规则：`YYYYMMDD-视频标题.mp4`
   - 例如：`20240315-我的第一个视频.mp4`
### 注意

本项目不提供视频资源，需要自行采集视频资源，该项目不适合服务器运行