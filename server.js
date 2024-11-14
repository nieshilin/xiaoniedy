const express = require('express');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// 设置 ffmpeg 路径
try {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    console.log('ffmpeg 路径:', ffmpegInstaller.path);
    console.log('ffmpeg 版本:', ffmpegInstaller.version);
} catch (error) {
    console.error('ffmpeg 初始化失败:', error);
    console.log('继续运行服务器，但视频时长功能可能不可用');
}

const app = express();

// 添加调试日志
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// 允许跨域访问
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

// 设置静态文件目录
const publicPath = path.join(__dirname, 'public');
console.log('静态文件目录:', publicPath);
app.use(express.static(publicPath));

// 生成缩略图的函数
async function generateThumbnail(videoPath, thumbnailPath) {
    return new Promise((resolve, reject) => {
        // 如果缩略图已存在，直接返回
        if (fs.existsSync(thumbnailPath)) {
            resolve(thumbnailPath);
            return;
        }

        ffmpeg(videoPath)
            .screenshots({
                timestamps: ['00:00:01'], // 从视频第1秒截图
                filename: path.basename(thumbnailPath),
                folder: path.dirname(thumbnailPath),
                size: '480x?', // 宽度480px，高度自适应
            })
            .on('end', () => {
                console.log('缩略图生成成功:', thumbnailPath);
                resolve(thumbnailPath);
            })
            .on('error', (err) => {
                console.error('生成缩略图失败:', err);
                reject(err);
            });
    });
}

// 修改获取视频时长的函数
async function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error('获取视频时长失败:', err);
                resolve('00:00');
                return;
            }
            
            try {
                const duration = metadata.format.duration;
                const minutes = Math.floor(duration / 60);
                const seconds = Math.floor(duration % 60);
                const formattedDuration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                console.log(`视频 ${videoPath} 的时长:`, formattedDuration);
                resolve(formattedDuration);
            } catch (error) {
                console.error('处理视频时长时出错:', error);
                resolve('00:00');
            }
        });
    });
}

// 添加一个函数来处理URL编码
function safeEncodeURI(str) {
    // 先进行 URI 编码
    let encoded = encodeURIComponent(str);
    // 特殊处理某些字符
    encoded = encoded.replace(/%20/g, '+')  // 空格转换为加号
                     .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16)); // 处理特殊字符
    return encoded;
}

// 修改视频文件处理中间件
app.get('/vlog/*', (req, res) => {
    try {
        // 获取请求的路径并解码
        let requestPath = req.path.substring(6); // 移除开头的 '/vlog/'
        // 处理 URL 编码的 + 号
        requestPath = requestPath.replace(/\+/g, ' ');
        // 解码路径
        requestPath = decodeURIComponent(requestPath);
        
        console.log('原始请求路径:', req.path);
        console.log('处理后的路径:', requestPath);
        
        const filePath = path.join(__dirname, 'public/vlog', requestPath);
        console.log('完整文件路径:', filePath);
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.error('文件不存在:', filePath);
            return res.status(404).send('文件不存在');
        }

        // 获取文件状态
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            // 处理范围请求
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            const file = fs.createReadStream(filePath, {start, end});
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Range',
            };

            res.writeHead(206, head);
            file.pipe(res);
        } else {
            // 处理完整请求
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
                'Access-Control-Allow-Origin': '*',
                'Accept-Ranges': 'bytes',
            };
            res.writeHead(200, head);

            // 使用 createReadStream 而不是直接发送文件
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        }
    } catch (error) {
        console.error('处理视频请求错误:', error);
        console.error('错误详情:', error.stack);
        if (!res.headersSent) {
            res.status(500).send('处理视频请求时出错');
        }
    }
});

// 保持基本的静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 添加日期提取函数
function extractDateFromFilename(filename) {
    // 匹配文件名开头的日期格式（YYYYMMDD）
    const match = filename.match(/^(\d{8})/);
    if (match) {
        const dateStr = match[1];
        // 转换为日期对象
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return new Date(year, month - 1, day);
    }
    return new Date(0); // 如果没有日期，返回最早的日期
}

// 添加时间格式化函数
function formatDateFromFilename(filename) {
    const match = filename.match(/^(\d{4})(\d{2})(\d{2})/);
    if (match) {
        const [_, year, month, day] = match;
        return `${year}/${month}/${day}`;
    }
    return '未知时间';
}

// 修改获取视频列表的API
app.get('/api/videos/:creator?', async (req, res) => {
    const creator = req.params.creator ? decodeURIComponent(req.params.creator) : null;
    const baseDir = path.join(__dirname, 'public/vlog');
    const vlogDir = creator ? path.join(baseDir, creator) : baseDir;
    
    try {
        if (!fs.existsSync(vlogDir)) {
            console.error('目录不存在:', vlogDir);
            return res.json([]);
        }

        // 如果没有指定创作者，获取所有文件夹中的视频
        if (!creator) {
            const folders = fs.readdirSync(baseDir, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
            
            let allVideos = [];
            for (const folder of folders) {
                const folderPath = path.join(baseDir, folder);
                const files = fs.readdirSync(folderPath);
                const folderVideos = await Promise.all(files
                    .filter(file => file.toLowerCase().endsWith('.mp4'))
                    .map(async (file) => {
                        const title = path.basename(file, '.mp4');
                        const videoPath = path.join(folderPath, file);
                        const thumbnailPath = path.join(folderPath, `${title}.jpg`);

                        try {
                            if (!fs.existsSync(videoPath)) {
                                return null;
                            }

                            const stat = fs.statSync(videoPath);
                            await generateThumbnail(videoPath, thumbnailPath);
                            const duration = await getVideoDuration(videoPath).catch(error => {
                                console.error('获取视频时长失败:', error);
                                return '00:00';
                            });
                            console.log(`视频 ${file} 的时长:`, duration);

                            return {
                                id: allVideos.length + 1,
                                title: title,
                                author: folder,
                                time: formatDateFromFilename(file),
                                duration: duration,
                                likes: "0",
                                videoUrl: `http://localhost:3000/vlog/${safeEncodeURI(folder)}/${safeEncodeURI(file)}`,
                                thumbnail: `http://localhost:3000/vlog/${safeEncodeURI(folder)}/${safeEncodeURI(title)}.jpg`,
                                avatar: `http://localhost:3000/vlog/${safeEncodeURI(folder)}/tx.jpg`,
                                fileSize: (stat.size / (1024 * 1024)).toFixed(2) + 'MB',
                                date: extractDateFromFilename(file)
                            };
                        } catch (error) {
                            console.error('处理视频文件失败:', error);
                            return null;
                        }
                    }));
                allVideos = allVideos.concat(folderVideos.filter(v => v !== null));
            }
            
            // 按日期排序（从新到旧）
            allVideos.sort((a, b) => b.date - a.date);
            
            return res.json(allVideos);
        }

        // 处理单个创作者的视频
        const files = fs.readdirSync(vlogDir);
        const videoPromises = files
            .filter(file => file.toLowerCase().endsWith('.mp4'))
            .map(async (file) => {
                const title = path.basename(file, '.mp4');
                const videoPath = path.join(vlogDir, file);
                const thumbnailPath = path.join(vlogDir, `${title}.jpg`);

                try {
                    if (!fs.existsSync(videoPath)) {
                        return null;
                    }

                    const stat = fs.statSync(videoPath);
                    await generateThumbnail(videoPath, thumbnailPath);
                    const duration = await getVideoDuration(videoPath).catch(error => {
                        console.error('获取视频时长失败:', error);
                        return '00:00';
                    });
                    console.log(`视频 ${file} 的时长:`, duration);

                    return {
                        id: files.indexOf(file) + 1,
                        title: title,
                        author: creator,
                        time: formatDateFromFilename(file),
                        duration: duration,
                        likes: "0",
                        videoUrl: `http://localhost:3000/vlog/${safeEncodeURI(creator)}/${safeEncodeURI(file)}`,
                        thumbnail: `http://localhost:3000/vlog/${safeEncodeURI(creator)}/${safeEncodeURI(title)}.jpg`,
                        avatar: `http://localhost:3000/vlog/${safeEncodeURI(creator)}/tx.jpg`,
                        fileSize: (stat.size / (1024 * 1024)).toFixed(2) + 'MB',
                        date: extractDateFromFilename(file)
                    };
                } catch (error) {
                    console.error('处理视频文件失败:', error);
                    return null;
                }
            });

        let videos = (await Promise.all(videoPromises)).filter(video => video !== null);
        
        // 按日期排序（从新到旧）
        videos.sort((a, b) => b.date - a.date);
        
        res.json(videos);
    } catch (error) {
        console.error('读取视频错误:', error);
        res.status(500).json({ error: '无法读取视频: ' + error.message });
    }
});

// 获取所有博主文件夹
app.get('/api/creators', (req, res) => {
    const vlogDir = path.join(__dirname, 'public/vlog');
    
    try {
        const items = fs.readdirSync(vlogDir, { withFileTypes: true });
        const creators = items
            .filter(item => item.isDirectory())
            .map(dir => ({
                id: dir.name,
                name: dir.name,
                path: `/vlog/${dir.name}`
            }));
        
        res.json(creators);
    } catch (error) {
        console.error('读取博主目录错误:', error);
        res.status(500).json({ error: '无法读取博主目录' });
    }
});

// 处理所有其他路由，返回index.html
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    console.log('尝试发送文件:', indexPath);
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        console.error('index.html 不存在于:', indexPath);
        res.status(404).send('找不到 index.html');
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`务器运行在 http://localhost:${PORT}`);
    console.log('当前工作目录:', __dirname);
}); 