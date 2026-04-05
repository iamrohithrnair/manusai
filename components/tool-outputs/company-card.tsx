import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CompanyCardProps {
  name: string;
  industry?: string;
  size?: string;
  description?: string;
  followerCount?: number;
  linkedinUrl?: string;
}

export function CompanyCard({ name, industry, size, description, followerCount, linkedinUrl }: CompanyCardProps) {
  return (
    <Card className="p-4 space-y-2 my-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{name}</h3>
        {industry && <Badge variant="secondary" className="text-xs">{industry}</Badge>}
      </div>
      {description && <p className="text-xs text-muted-foreground line-clamp-3">{description}</p>}
      <div className="flex gap-4 text-xs text-muted-foreground">
        {size && <span>Size: {size}</span>}
        {followerCount != null && <span>Followers: {followerCount.toLocaleString()}</span>}
        {linkedinUrl && <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">LinkedIn</a>}
      </div>
    </Card>
  );
}
