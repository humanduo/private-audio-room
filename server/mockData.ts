import type { Album, Category, NasConfig } from './types';

export const defaultCategories: Category[] = [
  { id: 'ancient', name: '古代' },
  { id: 'modern', name: '现代' },
  { id: 'xianxia', name: '修仙' }
];

export const mockAlbums: Album[] = [
  {
    id: 'drama-shadow-city',
    kind: 'drama',
    title: '雾城来信',
    subtitle: '悬疑广播剧 · 第一季',
    cover:
      'linear-gradient(145deg, rgba(29, 25, 40, .42), rgba(255, 99, 112, .18)), radial-gradient(circle at 68% 38%, #f6b46f 0 4%, transparent 5%), linear-gradient(135deg, #2d3342 0%, #6f6f78 42%, #e4a293 100%)',
    creator: '多人声音剧场',
    status: 'listening',
    progress: 62,
    totalEpisodes: 18,
    updatedAt: '今天更新',
    tags: ['现代', '悬疑', '多人剧', '睡前'],
    description: '一座被雨雾包裹的城市，一封封没有署名的来信，把几个陌生人拉进同一场旧案。',
    episodes: [
      { id: 'e1', title: '01 雾里的第一封信', duration: '28:14', progress: 100, isPreview: true },
      { id: 'e2', title: '02 旧楼里的脚步声', duration: '31:02', progress: 100 },
      { id: 'e3', title: '03 没有名字的录音', duration: '29:48', progress: 68 },
      { id: 'e4', title: '04 雨夜重逢', duration: '33:20', progress: 0 }
    ]
  },
  {
    id: 'drama-summer-signal',
    kind: 'drama',
    title: '夏日信号',
    subtitle: '治愈广播剧 · 完结',
    cover:
      'linear-gradient(145deg, rgba(255, 255, 255, .2), rgba(255, 99, 112, .18)), radial-gradient(circle at 26% 24%, #ffffff 0 7%, transparent 8%), linear-gradient(135deg, #9bd7ee 0%, #ffd8dd 48%, #ff8ac5 100%)',
    creator: '私人剧场',
    status: 'new',
    progress: 0,
    totalEpisodes: 12,
    updatedAt: '最近添加',
    tags: ['现代', '治愈', '轻甜', '完结'],
    description: '旧电台里断续出现的夏日留言，把两个久未联系的人重新带回同一个海边小城。',
    episodes: [
      { id: 's1', title: '01 海边小站', duration: '24:16', progress: 0 },
      { id: 's2', title: '02 信号不稳定', duration: '26:30', progress: 0 },
      { id: 's3', title: '03 晚风来电', duration: '27:12', progress: 0 }
    ]
  },
  {
    id: 'drama-night-archive',
    kind: 'drama',
    title: '夜航档案',
    subtitle: '悬疑单元剧',
    cover:
      'linear-gradient(145deg, rgba(15, 14, 27, .44), rgba(255, 99, 112, .16)), radial-gradient(circle at 72% 30%, #ffd18b 0 5%, transparent 6%), linear-gradient(135deg, #151525 0%, #3c3557 52%, #a96a72 100%)',
    creator: '多人声音剧场',
    status: 'listening',
    progress: 28,
    totalEpisodes: 30,
    updatedAt: '昨天听过',
    tags: ['现代', '悬疑', '单元剧', '夜听'],
    description: '每一段夜航录音，都对应一份无法归档的异常事件。',
    episodes: [
      { id: 'n1', title: '01 无人应答', duration: '35:44', progress: 100 },
      { id: 'n2', title: '02 第十三排座位', duration: '38:05', progress: 42 },
      { id: 'n3', title: '03 黑匣子里的歌', duration: '36:20', progress: 0 }
    ]
  },
  {
    id: 'drama-flower-room',
    kind: 'drama',
    title: '花房事件簿',
    subtitle: '轻悬疑广播剧',
    cover:
      'linear-gradient(145deg, rgba(255, 255, 255, .2), rgba(255, 99, 112, .16)), radial-gradient(circle at 28% 68%, #f8c16d 0 8%, transparent 9%), linear-gradient(135deg, #fff1f8 0%, #ffb3c7 45%, #6f3bdc 100%)',
    creator: '本地收藏',
    status: 'new',
    progress: 0,
    totalEpisodes: 16,
    updatedAt: '本周添加',
    tags: ['古代', '轻悬疑', '日常', '广播剧'],
    description: '花店老板收到一束没有订单的花，由此牵出一组互相隐藏身份的老顾客。',
    episodes: [
      { id: 'f1', title: '01 没有订单的玫瑰', duration: '22:08', progress: 0 },
      { id: 'f2', title: '02 花语密码', duration: '25:10', progress: 0 },
      { id: 'f3', title: '03 周三的客人', duration: '24:40', progress: 0 }
    ]
  },
  {
    id: 'book-long-river',
    kind: 'book',
    title: '长河夜读',
    subtitle: '历史有声书',
    cover: 'linear-gradient(145deg, #3c2a87 0%, #8e4cff 52%, #d9ccff 100%)',
    creator: '林川 朗读',
    status: 'listening',
    progress: 35,
    totalEpisodes: 64,
    updatedAt: '上周添加',
    tags: ['古代', '历史', '长篇', '有声书'],
    description: '从人物、制度与日常生活重新读一段长河般的历史。',
    episodes: [
      { id: 'b1', title: '第一章 风从北方来', duration: '42:10', progress: 100 },
      { id: 'b2', title: '第二章 城门与商旅', duration: '39:55', progress: 82 },
      { id: 'b3', title: '第三章 夜读札记', duration: '44:01', progress: 0 }
    ]
  },
  {
    id: 'course-voice-basic',
    kind: 'course',
    title: '声音表演基础课',
    subtitle: '网课 · 24 课时',
    cover: 'linear-gradient(145deg, #063f46 0%, #34a0a4 48%, #b9f3ea 100%)',
    creator: '课程资料',
    status: 'new',
    progress: 12,
    totalEpisodes: 24,
    updatedAt: '昨天添加',
    tags: ['现代', '网课', '练声', '笔记'],
    description: '从气息、口腔控制、情绪进入到角色声音设计的基础训练。',
    episodes: [
      { id: 'c1', title: '01 气息和身体准备', duration: '25:40', progress: 100 },
      { id: 'c2', title: '02 口腔打开与咬字', duration: '32:18', progress: 24 },
      { id: 'c3', title: '03 情绪进入练习', duration: '29:22', progress: 0 }
    ]
  }
];

export const defaultNasConfig: NasConfig = {
  type: process.env.AUDIO_ROOT ? 'local' : 'smb',
  label: process.env.AUDIO_ROOT ? '本地挂载 NAS' : '尚未连接 NAS',
  root: process.env.AUDIO_ROOT || '',
  connected: Boolean(process.env.AUDIO_ROOT)
};
