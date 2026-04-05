import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PostPreviewProps {
  content: string;
  employeeName?: string;
  status?: string;
  contentIdea?: string;
}

export function PostPreview({ content, employeeName, status, contentIdea }: PostPreviewProps) {
  return (
    <Card className="p-4 my-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{employeeName ? `Post for ${employeeName}` : 'Generated Post'}</span>
        {status && <Badge variant={status === 'final' ? 'default' : 'secondary'} className="text-xs">{status}</Badge>}
      </div>
      {contentIdea && <div className="text-xs text-muted-foreground">Topic: {contentIdea}</div>}
      <div className="text-sm whitespace-pre-wrap border-l-2 border-primary/20 pl-3">{content}</div>
    </Card>
  );
}
