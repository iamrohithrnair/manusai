import { Card } from '@/components/ui/card';

interface Employee {
  name: string;
  title?: string;
  linkedinUrl?: string;
}

interface EmployeeTableProps {
  employees: Employee[];
  companyName?: string;
}

export function EmployeeTable({ employees, companyName }: EmployeeTableProps) {
  return (
    <Card className="my-2 overflow-hidden">
      {companyName && <div className="px-4 py-2 border-b bg-muted/50 text-xs font-medium">{companyName} — {employees.length} employees</div>}
      <div className="divide-y">
        {employees.slice(0, 20).map((emp, i) => (
          <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">{emp.name}</span>
              {emp.title && <span className="text-muted-foreground ml-2 text-xs">{emp.title}</span>}
            </div>
            {emp.linkedinUrl && (
              <a href={emp.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Profile</a>
            )}
          </div>
        ))}
        {employees.length > 20 && <div className="px-4 py-2 text-xs text-muted-foreground">...and {employees.length - 20} more</div>}
      </div>
    </Card>
  );
}
