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
- 当前逻辑按文件夹生成专辑。
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

