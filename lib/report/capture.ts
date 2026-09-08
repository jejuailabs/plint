/** Captures the rendered scene with readable attribution and a bounded upload size. */
export function labeledSnapshot(
  source: HTMLCanvasElement,
  caption: string,
): string {
  const output = document.createElement('canvas');
  const scale = Math.min(1, 960 / source.width, 640 / source.height);
  output.width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('이미지 캡처를 지원하지 않습니다.');
  ctx.font = '14px sans-serif';
  const lines: string[] = [];
  let line = '';
  for (const char of caption) {
    if (ctx.measureText(line + char).width > output.width - 24 && line) {
      lines.push(line);
      line = char;
    } else line += char;
  }
  if (line) lines.push(line);
  output.height = height + lines.length * 20 + 20;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.drawImage(source, 0, 0, output.width, height);
  ctx.fillStyle = '#152536';
  ctx.font = '14px sans-serif';
  lines.forEach((text, i) => ctx.fillText(text, 12, height + 20 + i * 20));
  return output.toDataURL('image/png');
}
