import { eq } from 'drizzle-orm';
import { connectDB, getDb } from '@/lib/db/client';
import { manusTasks } from '@/lib/db/schema';
import { getTaskDetail, listMessages } from '@/lib/manus-client';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  await connectDB();
  const db = getDb();
  const local = db.select().from(manusTasks).where(eq(manusTasks.taskId, taskId)).get();

  try {
    const task = await getTaskDetail(taskId);
    const { messages } = await listMessages(taskId);
    return Response.json({ task, messages, local });
  } catch {
    return Response.json({ task: null, local });
  }
}
