interface ToolResultProps {
  toolName: string;
  result: unknown;
}

export function ToolResult({ toolName: _toolName, result }: ToolResultProps) {
  const data = result as Record<string, unknown>;

  // Show a simple success/error message if available
  if (data.message && typeof data.message === 'string') {
    return (
      <div className="text-xs text-muted-foreground my-1 px-3 py-1.5 bg-muted/50 rounded">
        {data.message}
      </div>
    );
  }

  if (data.error && typeof data.error === 'string') {
    return (
      <div className="text-xs text-red-500 my-1 px-3 py-1.5 bg-red-50 rounded">
        Error: {data.error}
      </div>
    );
  }

  return null; // Don't show raw JSON for other tools
}
