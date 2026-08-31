type Block = { title: string; lines: string[] };

function wrapLines(params: {
  ctx: CanvasRenderingContext2D;
  text: string;
  maxWidth: number;
}): string[] {
  const { ctx, text, maxWidth } = params;
  const t = (text ?? '').replace(/\r\n/g, '\n');
  const rawLines = t.split('\n');
  const out: string[] = [];

  for (const raw of rawLines) {
    const line = raw.trimEnd();
    if (!line) {
      out.push('');
      continue;
    }
    let buf = '';
    for (const ch of line) {
      const next = buf + ch;
      if (ctx.measureText(next).width > maxWidth && buf) {
        out.push(buf);
        buf = ch;
      } else {
        buf = next;
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}

function downloadPng(filename: string, canvas: HTMLCanvasElement) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

export function exportLongImagePng(params: {
  filename: string;
  title: string;
  metaLines: string[];
  blocks: Block[];
}) {
  const { filename, title, metaLines, blocks } = params;

  const width = 1080;
  const padding = 48;
  const contentWidth = width - padding * 2;

  // 先用测量 canvas 计算高度
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('无法创建 Canvas（浏览器不支持）');

  const titleFont = '700 40px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  const metaFont = '400 24px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  const blockTitleFont = '700 28px system-ui, -apple-system, Segoe UI, Roboto, Arial';
  const bodyFont = '400 24px system-ui, -apple-system, Segoe UI, Roboto, Arial';

  const lh = 34;
  const gap = 18;

  const measureTextLines = (font: string, text: string) => {
    mctx.font = font;
    return wrapLines({ ctx: mctx, text, maxWidth: contentWidth });
  };

  const titleLines = measureTextLines(titleFont, title);
  const metaWrapped = metaLines.flatMap((l) => measureTextLines(metaFont, l));

  let height = padding;
  height += titleLines.length * (lh + 6);
  height += gap;
  height += metaWrapped.length * lh;
  height += gap;

  const blocksMeasured = blocks.map((b) => {
    const head = measureTextLines(blockTitleFont, b.title);
    const body = b.lines.flatMap((l) => measureTextLines(bodyFont, l));
    const h = head.length * (lh + 2) + gap + body.length * lh + gap;
    return { head, body, h, title: b.title };
  });
  height += blocksMeasured.reduce((sum, b) => sum + b.h, 0);
  height += padding;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(800, Math.min(20000, Math.ceil(height)));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas（浏览器不支持）');

  // 背景
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 背景微弱渐变
  const grd = ctx.createRadialGradient(width * 0.2, 180, 20, width * 0.2, 180, 900);
  grd.addColorStop(0, 'rgba(124, 92, 255, 0.28)');
  grd.addColorStop(1, 'rgba(11, 16, 32, 0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let y = padding;
  const x = padding;

  const drawLines = (font: string, color: string, lines: string[], extraLineGap = 0) => {
    ctx.font = font;
    ctx.fillStyle = color;
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += lh + extraLineGap;
    }
  };

  drawLines(titleFont, 'rgba(255,255,255,0.92)', titleLines, 6);
  y += gap;
  drawLines(metaFont, 'rgba(255,255,255,0.72)', metaWrapped);
  y += gap;

  const drawDivider = () => {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, contentWidth, 1);
    y += gap;
  };

  for (const b of blocksMeasured) {
    drawDivider();
    drawLines(blockTitleFont, 'rgba(255,255,255,0.92)', b.head, 2);
    y += gap / 2;
    drawLines(bodyFont, 'rgba(255,255,255,0.86)', b.body);
    y += gap;
  }

  drawDivider();
  ctx.font = metaFont;
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.fillText('免责声明：本图仅供自我反思与沟通辅助，不替代医疗/法律/投资等专业意见。', x, y);

  downloadPng(filename, canvas);
}

