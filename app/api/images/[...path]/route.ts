import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const safe = segments.join('/');
  if (safe.includes('..')) return new Response('Not found', { status: 404 });

  const filePath = path.join(process.cwd(), 'uploads', safe);
  try {
    const buf = await readFile(filePath);
    const ext = path.extname(safe).toLowerCase();
    const type =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';
    return new Response(buf, { headers: { 'Content-Type': type } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
