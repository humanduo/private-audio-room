# Private Audio Room

私人广播剧、有声书和网课播放器，面向 NAS 本地音频库使用。

## Docker 镜像

推送到 `main` 分支后，GitHub Actions 会使用项目根目录的 `Dockerfile` 自动构建镜像，并发布到 GHCR：

```text
ghcr.io/humanduo/private-audio-room:latest
```

## 绿联 NAS 图形界面部署

适合不使用 SSH 的情况。先确认 GitHub Actions 已经成功发布镜像，再在绿联 NAS 的 Docker 界面创建项目。

1. 在 NAS 文件管理器里准备两个目录：

```text
/Audio
/docker/private-audio-room/data
```

`/Audio` 放广播剧、有声书、网课等音频文件；`/docker/private-audio-room/data` 用来保存应用数据、分类、扫描结果和封面配置。

2. 打开绿联 NAS 的 Docker 应用，进入项目或 Compose 创建页面。

3. 项目名称填写：

```text
private-audio-room
```

4. Compose 配置粘贴 `docker-compose.image.yml` 的内容：

```yaml
services:
  private-audio-room:
    image: ghcr.io/humanduo/private-audio-room:latest
    container_name: private-audio-room
    restart: unless-stopped
    ports:
      - "8787:8787"
    environment:
      PORT: "8787"
      AUDIO_ROOT: /media/audio
      PUBLIC_APP_URL: https://audio.307167312.xyz
      OPENAI_API_KEY: ""
      OPENAI_IMAGE_MODEL: gpt-image-1
      AUTO_GENERATE_COVERS: "false"
      MAX_AUTO_GENERATED_COVERS_PER_SCAN: "8"
    volumes:
      - /Audio:/media/audio:ro
      - /docker/private-audio-room/data:/app/data
```

5. 点击部署或启动。启动完成后，在局域网浏览器打开：

```text
http://NAS局域网IP:8787
```

6. 进入应用后，NAS 路径填写：

```text
/media/audio
```

然后执行扫描。

### AI 自动生成封面

如果你希望导入广播剧或有声书时自动生成封面，在绿联 NAS 的 Docker 项目环境变量里填写：

```yaml
OPENAI_API_KEY: 新生成的 OpenAI API Key
OPENAI_IMAGE_MODEL: gpt-image-1
AUTO_GENERATE_COVERS: "true"
MAX_AUTO_GENERATED_COVERS_PER_SCAN: "8"
```

注意：不要把真实 API Key 提交到 GitHub。已经发到聊天或截图里的 key 建议立即删除并重新创建。

## 外网访问

推荐使用 Cloudflare Tunnel 或 Tailscale，不建议直接把 `8787` 端口暴露到公网。使用 Cloudflare Tunnel 时，服务地址指向：

```text
http://private-audio-room:8787
```
