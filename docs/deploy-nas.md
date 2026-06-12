# 绿联 NAS 部署说明

这个项目推荐用绿联 UGOS Pro 的 Docker 应用部署。部署后浏览器访问：

```text
http://你的NAS局域网IP:8787
```

## 1. 准备目录

在绿联 NAS 文件管理里准备两个目录，名称可以按你的习惯改：

```text
/Docker/private-audio-room
/Audio
```

示例含义：

- `/Docker/private-audio-room`：放本项目代码、Docker 配置和应用数据。
- `/Audio`：你的广播剧、有声书、网课音频目录。

如果你的音频在其他目录，把下面 compose 文件里的左侧路径改掉即可。

## 2. 上传项目

把整个项目上传到 NAS：

```text
/Docker/private-audio-room
```

项目里应该包含：

```text
Dockerfile
docker-compose.yml
package.json
server/
src/
```

## 3. 修改 docker-compose.yml 的音频路径

打开 `docker-compose.yml`，把这一行左侧改成你的音频目录：

```yaml
- ./media/audio:/media/audio:ro
```

例如你的绿联音频目录是 `/Audio`，改成：

```yaml
- /Audio:/media/audio:ro
```

说明：

- `/media/audio` 是容器内部路径，不要改。
- `:ro` 表示只读挂载，应用只能读取音频，不能误删你的 NAS 文件。
- `./data:/app/data` 用来保存分类、扫描结果、封面等应用数据。

## 4. 绿联 Docker 应用部署

推荐方式：使用绿联 Docker 应用里的“项目 / Docker Compose”。

大致步骤：

1. 打开绿联 NAS 桌面。
2. 打开 `Docker` 应用。
3. 进入 `项目`。
4. 点 `创建` 或 `新增项目`。
5. 项目名称填：

```text
private-audio-room
```

6. 项目路径选择：

```text
/Docker/private-audio-room
```

7. 选择使用当前目录里的 `docker-compose.yml`。
8. 创建并启动项目。

启动后访问：

```text
http://你的绿联NAS_IP:8787
```

## 5. 一键部署脚本

如果你愿意打开绿联 NAS 的 SSH，可以用项目自带脚本一键部署。

进入项目目录：

```bash
cd /Docker/private-audio-room
```

运行：

```bash
sh scripts/deploy-ugreen.sh
```

脚本默认：

```text
音频目录：/Audio
访问端口：8787
应用数据：./data
```

启动后访问：

```text
http://你的绿联NAS_IP:8787
```

进入应用后，`文件` 页里的 NAS 路径填写：

```text
/media/audio
```

### 自定义音频目录

如果你的音频不在 `/Audio`，例如在 `/听书资料`：

```bash
AUDIO_DIR="/听书资料" sh scripts/deploy-ugreen.sh
```

### 自定义端口

如果 `8787` 被占用：

```bash
APP_PORT=8788 sh scripts/deploy-ugreen.sh
```

然后访问：

```text
http://你的绿联NAS_IP:8788
```

### 同时自定义目录和端口

```bash
AUDIO_DIR="/Audio" APP_PORT=8788 sh scripts/deploy-ugreen.sh
```

脚本会生成：

```text
docker-compose.ugreen.yml
```

后续更新代码后，再运行同一条命令即可重新构建并启动。

## 6. SSH 命令行手动部署

如果你习惯 SSH，也可以进入项目目录：

```bash
cd /Docker/private-audio-room
```

启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f
```

停止：

```bash
docker compose down
```

更新代码后重新部署：

```bash
docker compose up -d --build
```

## 7. 首次进入应用

进入网页后：

1. 打开 `文件`。
2. NAS 路径填：

```text
/media/audio
```

3. 点 `保存路径`。
4. 点 `扫描音频`。

扫描完成后，首页会出现本地广播剧、有声书、网课。

## 8. 音频目录建议

建议你在 NAS 里这样放：

```text
/Audio/
  广播剧/
    雾城来信/
      01.mp3
      02.mp3
  有声书/
    长河夜读/
      001.m4b
      002.m4b
  网课/
    声音表演基础课/
      01.mp3
      02.mp3
```

当前扫描规则：

- 文件夹名包含 `课程`、`course`、`课`：归为网课。
- 文件夹名包含 `book`、`有声书`、`听书`：归为有声书。
- 其他默认归为广播剧。

## 9. 端口

默认端口：

```text
8787
```

如果端口冲突，修改 `docker-compose.yml`：

```yaml
ports:
  - "8788:8787"
```

然后访问：

```text
http://你的NAS_IP:8788
```

## 10. 数据保存在哪里

应用数据保存在：

```text
./data
```

包括：

- NAS 路径配置
- 分类
- 扫描结果
- 自定义封面 data URL

备份这个目录即可备份应用配置。

## 11. 绿联部署常见注意点

- 如果页面能打开但扫描不到文件，优先检查 `docker-compose.yml` 的音频目录左侧路径是否写对。
- 容器里填写的 NAS 路径一定是 `/media/audio`，不是绿联文件管理器里的路径。
- 如果 Docker 项目启动失败，先看项目日志，常见原因是端口 `8787` 被占用，或者音频目录路径不存在。
- 如果你想让朋友访问，需要在绿联路由器/内网穿透/反向代理里单独配置访问方式。这个应用本身不会主动连外网。
