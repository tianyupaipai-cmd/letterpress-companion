# 剪演示视频：片头 → 手机外框里的录屏（下面一条分段字幕）→ 片尾，1080×1920 竖版
# 用法：先跑 tools/demo.mjs 和 tools/frame.mjs，再 python3 tools/cut.py，成片在 previews/演示视频.mp4
import json, glob, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
V = os.path.join(HERE, '..', 'previews', '_video')
OUT = os.path.join(HERE, '..', 'previews', '演示视频.mp4')
FONT = '/System/Library/Fonts/STHeiti Medium.ttc'
SX, SY, SW, SH = 198, 150, 684, 1480        # 和 tools/frame.mjs 一致
INTRO, OUTRO, GH = 2.8, 3.2, 4.0                # 片头、片尾、最后的开源地址

marks = json.load(open(os.path.join(V, 'marks.json')))
START = max(0, marks[0]['t'] - 0.8)          # 去掉开头加载的几秒，从第一段前一点起剪
end = marks[-1]['t']
D = round(end - START, 2)
segs = [m for m in marks if m['text']]
# 逐帧抓的画面拼成一段：每帧停到下一帧出现为止
frames = json.load(open(os.path.join(V, 'frames.json')))
lst = os.path.join(V, 'frames.txt')
with open(lst, 'w') as fl:
    prev = 0.0
    for i, fr in enumerate(frames):
        t = fr['t'] / 1000
        nxt = frames[i + 1]['t'] / 1000 if i + 1 < len(frames) else t + 1
        dur = (nxt - t) + (t - prev if i == 0 else 0)   # 第一帧从 0 秒算起
        fl.write(f"file 'frames/{fr['f']}'\nduration {max(dur, 0.001):.4f}\n")
        prev = t
    fl.write(f"file 'frames/{frames[-1]['f']}'\n")

# 每段字幕写成单独的文本文件，免得中文和符号在命令里转义出错
draw = []
for i, m in enumerate(segs):
    a = max(0, m['t'] - START)
    b = (segs[i + 1]['t'] if i + 1 < len(segs) else end) - START
    tf = os.path.join(V, f'cap{i:02d}.txt')
    open(tf, 'w').write(m['text'])
    nf = os.path.join(V, f'num{i:02d}.txt')
    open(nf, 'w').write(f'{i + 1:02d} / {len(segs):02d}')
    fade = f"alpha='if(lt(t,{a}+0.3),(t-{a})/0.3,if(gt(t,{b}-0.3),({b}-t)/0.3,1))'"
    draw.append(f"drawtext=fontfile='{FONT}':textfile='{nf}':fontsize=26:fontcolor=0x8C877D:x=(w-text_w)/2:y=1708:enable='between(t,{a},{b})':{fade}")
    draw.append(f"drawtext=fontfile='{FONT}':textfile='{tf}':fontsize=40:fontcolor=0x2B2A27:x=(w-text_w)/2:y=1752:enable='between(t,{a},{b})':{fade}")

fc = ';'.join([
    f"[1:v]trim=start={START}:duration={D},setpts=PTS-STARTPTS,fps=30,scale={SW}:{SH}:flags=lanczos[rec]",
    f"[0:v]fps=30,format=yuv420p[bg]",
    f"[bg][rec]overlay={SX}:{SY}[a]",
    f"[a][2:v]overlay=0:0," + ','.join(draw) + f",fade=t=in:st=0:d=0.4,fade=t=out:st={D - 0.4}:d=0.4,format=yuv420p[main]",
    f"[3:v]fps=30,format=yuv420p,fade=t=out:st={INTRO - 0.5}:d=0.5[intro]",
    f"[4:v]fps=30,format=yuv420p,fade=t=in:st=0:d=0.5[outro]",
    f"[5:v]fps=30,format=yuv420p,fade=t=in:st=0:d=0.5[gh]",
    "[intro][main][outro][gh]concat=n=4:v=1:a=0[v]"
])
open(os.path.join(V, 'filter.txt'), 'w').write(fc)

cmd = ['ffmpeg', '-y', '-loglevel', 'error',
       '-loop', '1', '-t', str(D), '-i', os.path.join(V, 'bg.png'),
       '-f', 'concat', '-safe', '0', '-i', lst,
       '-loop', '1', '-t', str(D), '-i', os.path.join(V, 'frame.png'),
       '-loop', '1', '-t', str(INTRO), '-i', os.path.join(V, 'intro.png'),
       '-loop', '1', '-t', str(OUTRO), '-i', os.path.join(V, 'outro.png'),
       '-loop', '1', '-t', str(GH), '-i', os.path.join(V, 'github.png'),
       '-filter_complex_script', os.path.join(V, 'filter.txt'), '-map', '[v]',
       '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', OUT]
subprocess.run(cmd, check=True)
print('done', OUT, 'main', D, 's')
