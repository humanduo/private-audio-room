# 私人听书房 API

本项目当前本地开发 API 地址：

```text
http://localhost:8787
```

前端开发地址 `http://localhost:5173` 已经配置代理，所以前端里可以直接请求 `/api/...`。

## 健康检查

```http
GET /api/health
```

响应：

```json
{
  "ok": true,
  "name": "private-audio-room"
}
```

## 获取应用配置

```http
GET /api/config
```

响应：

```json
{
  "config": {
    "name": "private-audio-room",
    "publicUrl": "https://audio.307167312.xyz",
    "mediaRoot": "/media/audio",
    "maxScanFiles": 2000,
    "supportedAudioExtensions": [".mp3", ".m4a", ".m4b", ".aac", ".flac", ".wav", ".ogg", ".opus"],
    "supportedCoverNames": ["cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "folder.jpeg", "folder.png"]
  }
}
```

说明：

- `publicUrl` 来自环境变量 `PUBLIC_APP_URL`，用于记录外网访问地址。
- `mediaRoot` 来自环境变量 `AUDIO_ROOT`，Docker 部署时通常是 `/media/audio`。
- `maxScanFiles` 来自环境变量 `MAX_SCAN_FILES`，默认扫描最多 2000 个音频文件。

## 获取专辑列表

```http
GET /api/albums
```

查询参数：

| 参数 | 说明 | 示例 |
| --- | --- | --- |
| `kind` | 内容类型：`drama`、`book`、`course` | `drama` |
| `q` | 本地搜索关键词 | `雾城` |
| `category` | 分类名 | `古代` |

示例：

```http
GET /api/albums?kind=drama&category=现代
```

响应：

```json
{
  "albums": []
}
```

## 获取单个专辑

```http
GET /api/albums/:id
```

示例：

```http
GET /api/albums/drama-shadow-city
```

## 更新专辑封面

```http
PATCH /api/albums/:id/cover
Content-Type: application/json
```

请求体：

```json
{
  "cover": "data:image/png;base64,..."
}
```

说明：

- 支持本地图片转成 `data:image/...` 保存。
- 也支持内部示例用的 `linear-gradient(...)`。
- 不依赖外部图床。

## AI 生成专辑封面

```http
POST /api/albums/:id/cover/generate
```

说明：

- 需要在后端环境变量中配置 `OPENAI_API_KEY`。
- 默认图片模型为 `gpt-image-1`，可通过 `OPENAI_IMAGE_MODEL` 修改。
- 生成后的封面会保存到 `/app/data/covers`，并通过 `/covers/...` 在应用内显示。

## 获取分类

```http
GET /api/categories
```

响应：

```json
{
  "categories": [
    { "id": "ancient", "name": "古代" },
    { "id": "modern", "name": "现代" },
    { "id": "xianxia", "name": "修仙" }
  ]
}
```

## 新增分类

```http
POST /api/categories
Content-Type: application/json
```

请求体：

```json
{
  "name": "刑侦"
}
```

## 获取 NAS 状态

```http
GET /api/nas
```

响应：

```json
{
  "nas": {
    "type": "local",
    "label": "本地挂载 NAS",
    "root": "/Volumes/YourNAS/Audio",
    "connected": true,
    "lastScanAt": "2026-06-12T01:00:00.000Z"
  }
}
```

## 保存 NAS 路径

```http
POST /api/nas
Content-Type: application/json
```

请求体：

```json
{
  "type": "local",
  "label": "本地挂载 NAS",
  "root": "/Volumes/YourNAS/Audio"
}
```

当前版本优先支持本地挂载路径。你可以先把 NAS 挂载到 Mac 或服务器上，再把挂载路径填进去。

## 扫描 NAS 音频

```http
POST /api/scan
```

说明：

- 扫描 `NAS root` 下的音频文件。
- 支持扩展名：`.mp3`、`.m4a`、`.m4b`、`.aac`、`.flac`、`.wav`、`.ogg`、`.opus`。
- 当前逻辑按“专辑/剧名文件夹”生成专辑。比如 `/Audio/广播剧/雾城来信/第1季/01.mp3` 会导入为专辑 `雾城来信`，不会把 `第1季` 当成专辑名。
- 分集会按中文和数字自然排序，避免 `1, 10, 2` 这种乱序。
- 分集名会清理常见下载标记、重复剧名和音频扩展名。
- 文件夹里放 `cover.jpg`、`cover.jpeg`、`cover.png`、`folder.jpg`、`folder.jpeg` 或 `folder.png`，扫描时会自动作为专辑封面。
- 如果没有本地封面，并且配置了 `OPENAI_API_KEY` 与 `AUTO_GENERATE_COVERS=true`，扫描时会自动为缺封面的专辑生成 AI 封面。
- 文件夹名包含 `课程`、`course`、`课` 会归为网课。
- 文件夹名包含 `book`、`有声书`、`听书` 会归为有声书。
- 其他默认归为广播剧。

## 播放媒体文件

```http
GET /media/:albumId/:episodeId
```

说明：

- 用于播放扫描出来的本地音频文件。
- 只允许访问已配置 NAS root 下的文件。
- 支持 `Range` 请求，手机浏览器和播放器可以拖动进度条、断点缓冲。

## 数据模型

### Album

```ts
type Album = {
  id: string;
  kind: 'drama' | 'book' | 'course';
  title: string;
  subtitle: string;
  cover: string;
  creator: string;
  status: 'new' | 'listening' | 'finished';
  progress: number;
  totalEpisodes: number;
  updatedAt: string;
  tags: string[];
  description: string;
  episodes: Episode[];
};
```

### Episode

```ts
type Episode = {
  id: string;
  title: string;
  duration: string;
  filePath?: string;
  progress?: number;
  isPreview?: boolean;
};
```
