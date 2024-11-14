async function fetchCreators() {
    try {
        const response = await fetch('http://localhost:3000/api/creators');
        const creators = await response.json();
        return creators;
    } catch (error) {
        console.error('获取博主列表失败:', error);
        return [];
    }
}

async function fetchVideos(creator = null) {
    try {
        const url = creator 
            ? `http://localhost:3000/api/videos/${creator}`
            : 'http://localhost:3000/api/videos';
        const response = await fetch(url);
        const videoData = await response.json();
        return videoData;
    } catch (error) {
        console.error('获取视频列表失败:', error);
        return [];
    }
}

function createVideoCard(video) {
    console.log('创建视频卡片:', video);
    const videoElement = `
        <div class="video-card" data-video-id="${video.id}">
            <div class="video-container" onclick="handleVideoClick(this)">
                <video 
                    preload="none"
                    poster="${video.thumbnail}"
                    src="${video.videoUrl}"
                >
                    你的浏览器不支持 HTML5 视频播放
                </video>
                <span class="duration">${video.duration}</span>
                <div class="likes">${video.likes}</div>
            </div>
            <div class="video-info">
                <h3>${video.title}</h3>
                <div class="author">
                    <img src="${video.avatar}" alt="${video.author}的头像" onerror="this.src='assets/default-avatar.jpg'">
                    <span>${video.author}</span>
                    <span class="time">${video.time}</span>
                </div>
            </div>
        </div>
    `;
    return videoElement;
}

// 全局变量跟踪当前播放的视频
let currentPlayingVideo = null;

// 直接获取已存在的元素
const overlay = document.querySelector('.video-overlay');
const fullscreenVideo = document.getElementById('fullscreen-video'); // 使用ID选择器
const closeButton = overlay.querySelector('.close-button');
const fullscreenTitle = overlay.querySelector('.fullscreen-video-title');

// 添加全局变量来跟踪当前播放的视频索引
let currentVideoIndex = 0;
let allVideos = [];

// 修改 renderVideoGrid 函数来保存所有视频数据
async function renderVideoGrid() {
    const videoGrid = document.querySelector('.video-grid');
    allVideos = await fetchVideos();
    
    if (allVideos.length === 0) {
        videoGrid.innerHTML = '<div class="no-videos">没有找到视频</div>';
        return;
    }
    
    videoGrid.innerHTML = allVideos.map(video => createVideoCard(video)).join('');
    console.log('视频网格渲染完成');
}

// 修改视频点击处理函数
function handleVideoClick(container) {
    const videoElement = container.querySelector('video');
    const videoUrl = videoElement.src;
    
    // 根据URL找到对应的视频数据
    currentVideoIndex = allVideos.findIndex(v => v.videoUrl === videoUrl);
    console.log('当前视频索引:', currentVideoIndex);
    
    if (currentVideoIndex === -1) {
        console.error('未找到对应的视频数据');
        return;
    }
    
    const video = allVideos[currentVideoIndex];
    
    // 更新全屏视频
    fullscreenVideo.src = video.videoUrl;
    fullscreenTitle.textContent = video.title;
    
    // 显示遮罩层
    overlay.classList.add('active');
    
    // 加载并播放视频
    fullscreenVideo.load();
    fullscreenVideo.play().catch(error => {
        console.error('视频播放失败:', error);
    });
}

// 修改全屏播放函数
function playFullscreenVideo(index) {
    if (index < 0 || index >= allVideos.length) return;
    
    const video = allVideos[index];
    const container = document.querySelector('.fullscreen-video-container');
    container.classList.add('loading');
    
    // 更新视频源
    fullscreenVideo.src = video.videoUrl;
    fullscreenTitle.textContent = video.title;
    
    // 加载并播放视频
    fullscreenVideo.load();
    fullscreenVideo.play().catch(error => {
        console.error('视频播放失败:', error);
        container.classList.remove('loading');
    });
    
    // 视频可以播放时移除加载状态
    fullscreenVideo.oncanplay = function() {
        container.classList.remove('loading');
    };
    
    overlay.classList.add('active');
}

// 添加视频元数据加载完成后的处理
fullscreenVideo.addEventListener('loadedmetadata', function() {
    const container = document.querySelector('.fullscreen-video-container');
    const videoRatio = this.videoWidth / this.videoHeight;
    const containerRatio = container.clientWidth / container.clientHeight;
    
    // 根据视频比例调整容器大小
    if (videoRatio > containerRatio) {
        // 视频更宽，使用容器宽度
        this.style.width = '100%';
        this.style.height = 'auto';
    } else {
        // 视频更高，使用容器高度
        this.style.width = 'auto';
        this.style.height = '100%';
    }
});

// 新增切换视频函数
function switchVideo(direction) {
    console.log('切换视频', '当前索引:', currentVideoIndex, '方向:', direction);
    
    let newIndex = currentVideoIndex + direction;
    
    // 循环播放：如果到达列表末尾，回到开始；如果到达列表开头，跳到末尾
    if (newIndex >= allVideos.length) {
        newIndex = 0;
    } else if (newIndex < 0) {
        newIndex = allVideos.length - 1;
    }
    
    console.log('新索引:', newIndex, '总视频数:', allVideos.length);
    
    currentVideoIndex = newIndex;
    playFullscreenVideo(currentVideoIndex);
    
    // 显示切换提示
    showSwitchTip(direction);
}

// 修改键盘事件监听，添加左右键控制
document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('active')) {
        console.log('按键:', e.key);
        switch(e.key) {
            case 'Escape':
                closeButton.click();
                break;
            case 'ArrowUp':
                e.preventDefault(); // 防止页面滚动
                switchVideo(-1); // 上一个视频
                break;
            case 'ArrowDown':
                e.preventDefault(); // 防止页面滚动
                switchVideo(1); // 下一个视频
                break;
            case 'ArrowLeft':
                e.preventDefault();
                seekVideo(-5); // 后退5秒
                break;
            case 'ArrowRight':
                e.preventDefault();
                seekVideo(5); // 前进5秒
                break;
        }
    }
});

// 添加视频进度控制函数
function seekVideo(seconds) {
    if (!fullscreenVideo) return;
    
    const newTime = fullscreenVideo.currentTime + seconds;
    // 确保时间在有效范围内
    fullscreenVideo.currentTime = Math.max(0, Math.min(newTime, fullscreenVideo.duration));
    
    // 显示进度提示
    showSeekTip(seconds);
}

// 添加进度提示函数
function showSeekTip(seconds) {
    const tip = document.createElement('div');
    tip.className = 'seek-tip';
    tip.textContent = `${seconds > 0 ? '前进' : '后退'} ${Math.abs(seconds)} 秒`;
    overlay.appendChild(tip);
    
    // 1秒后移除提示
    setTimeout(() => {
        tip.remove();
    }, 1000);
}

// 添加进度提示的样式
const seekStyle = document.createElement('style');
seekStyle.textContent = `
    .seek-tip {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        font-size: 16px;
        z-index: 1001;
        animation: fadeInOut 1s ease-in-out;
    }
`;
document.head.appendChild(seekStyle);

// 修改关闭按钮事件
closeButton.addEventListener('click', () => {
    const currentTime = fullscreenVideo.currentTime;
    const originalVideo = document.querySelector(`video[src="${fullscreenVideo.src}"]`);
    
    // 暂停全屏视频
    fullscreenVideo.pause();
    overlay.classList.remove('active');
    fullscreenVideo.src = '';
    
    // 更新原视频的播放位置
    if (originalVideo) {
        originalVideo.currentTime = currentTime;
    }
});

// 添加切换提示
function showSwitchTip(direction) {
    const tip = document.createElement('div');
    tip.className = 'switch-tip';
    tip.textContent = direction === 1 ? '下一个视频' : '上一个视频';
    overlay.appendChild(tip);
    
    // 1秒后移除提示
    setTimeout(() => {
        tip.remove();
    }, 1000);
}

// 添加相关的 CSS
const style = document.createElement('style');
style.textContent = `
    .switch-tip {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        font-size: 16px;
        z-index: 1001;
        animation: fadeInOut 1s ease-in-out;
    }

    @keyframes fadeInOut {
        0% { opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        100% { opacity: 0; }
    }
`;
document.head.appendChild(style);

// 修改页面加载完成的处理
document.addEventListener('DOMContentLoaded', async () => {
    console.log('页面加载完成，开始初始化');
    
    try {
        // 先获取博主列表
        const creators = await fetchCreators();
        console.log('获取到的博主列表:', creators);
        
        if (creators && creators.length > 0) {
            // 初始化导航栏
            const navItems = document.querySelector('.nav-items');
            navItems.innerHTML = '';
            
            // 添加博主选项
            creators.forEach(creator => {
                const li = document.createElement('li');
                li.textContent = creator.name;
                li.dataset.creatorId = creator.id;
                navItems.appendChild(li);
            });
            
            // 添加点击事件
            navItems.addEventListener('click', async (e) => {
                const item = e.target.closest('li');
                if (!item) return;
                
                // 处理导航项点击
                await handleNavClick(item);
            });
            
            // 自动点击第一个博主
            const firstCreator = navItems.querySelector('li');
            if (firstCreator) {
                firstCreator.classList.add('active');
                await handleNavClick(firstCreator);
            }
        }
    } catch (error) {
        console.error('初始化失败:', error);
    }
});

// 添加导航项点击处理函数
async function handleNavClick(item) {
    // 移除所有active类
    const navItems = document.querySelectorAll('.nav-items li');
    navItems.forEach(i => i.classList.remove('active'));
    
    // 添加active类到当前项
    item.classList.add('active');
    
    const creatorId = item.dataset.creatorId;
    document.title = `${item.textContent} - 短视频平台`;
    
    // 加载该博主的视频
    const videoGrid = document.querySelector('.video-grid');
    videoGrid.innerHTML = '<div class="loading-spinner"></div>';
    
    // 更新全局视频列表
    allVideos = await fetchVideos(creatorId);
    if (allVideos.length === 0) {
        videoGrid.innerHTML = '<div class="category-message">暂无视频</div>';
        return;
    }
    
    videoGrid.innerHTML = allVideos.map(video => createVideoCard(video)).join('');
}

// 添加全局错误处理
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('全局错误:', {msg, url, lineNo, columnNo, error});
    return false;
}; 