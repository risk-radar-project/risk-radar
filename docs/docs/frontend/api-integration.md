# API Integration

## Overview

The frontend integrates with multiple backend microservices through a proxy layer implemented using Next.js API Routes. This architecture provides centralized configuration, error handling, and request/response transformation.

## Architecture Pattern

```
Browser → Frontend API Routes → Backend Microservices
         (Proxy Layer)
```

### Benefits of Proxy Layer

1. **Security**: Backend service URLs not exposed to client
2. **Centralization**: Single point for request configuration
3. **Error Handling**: Consistent error responses
4. **Logging**: Centralized request/response logging
5. **Transformation**: Format data before sending to client
6. **CORS**: Avoid cross-origin issues

## API Client Layer

### Location

`lib/api/` - Contains typed API client functions

### Structure

```
lib/api/
├── fetcher.ts       # Base fetch wrapper
├── reports.ts       # Report API functions
├── media.ts         # Media upload functions
├── auth.ts          # Authentication API
├── admin.ts         # Admin operations
├── notifications.ts # Notification API
├── ai.ts            # AI service integration
└── authz.ts         # Authorization checks
```

## Key API Modules

### 1. Fetcher (`lib/api/fetcher.ts`)

Base fetch wrapper with automatic error handling and token management.

```typescript
export async function fetcher<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
```

**Features**:

- Automatic JSON parsing
- Error handling
- Type safety with generics
- Header management

### 2. Reports API (`lib/api/reports.ts`)

Functions for report operations.

```typescript
// Fetch all reports
export async function getReports(): Promise<Report[]> {
  return fetcher<Report[]>('/api/reports');
}

// Create new report
export async function createReport(data: CreateReportDto) {
  return fetcher('/api/reports/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get user's reports
export async function getMyReports(userId: string) {
  return fetcher<Report[]>(`/api/reports?userId=${userId}`);
}

// Delete report
export async function deleteReport(reportId: string) {
  return fetcher(`/api/reports/${reportId}`, {
    method: 'DELETE',
  });
}
```

**Key Points**:

- All functions are typed
- Use relative URLs (proxy to backend)
- Return parsed responses

### 3. Media API (`lib/api/media.ts`)

Handles file uploads.

```typescript
export async function uploadImages(
  files: File[]
): Promise<{ imageIds: string[] }> {
  const formData = new FormData();

  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData, // Don't set Content-Type for FormData
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json();
}
```

**Important**:

- Don't set `Content-Type` header for FormData
- Browser automatically sets correct boundary
- Backend expects `multipart/form-data`

### 4. Auth API (`lib/api/auth.ts`)

Authentication and session management.

```typescript
// Login
export async function login(email: string, password: string) {
  return fetcher<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Register
export async function register(data: RegisterDto) {
  return fetcher('/api/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Get current user
export async function getCurrentUser() {
  return fetcher<User>('/api/me');
}

// Logout
export async function logout() {
  return fetcher('/api/logout', { method: 'POST' });
}
```

## API Routes (Proxy Layer)

### Location

`app/api/` - Next.js Route Handlers

### Pattern

Each API route follows this pattern:

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 1. Extract parameters
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    // 2. Call backend service
    const backendUrl = process.env.BACKEND_SERVICE_URL;
    const response = await fetch(`${backendUrl}/endpoint`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 3. Handle errors
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Backend error' },
        { status: response.status }
      );
    }

    // 4. Return data
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Key Routes

#### GET /api/reports

**Purpose**: Fetch all verified reports for the map

**Backend Service**: Map Service

**Implementation**:

```typescript
// app/api/reports/route.ts
export async function GET() {
  const mapServiceUrl = process.env.MAP_SERVICE_URL;

  const response = await fetch(`${mapServiceUrl}/reports`, {
    cache: 'no-store', // Always fetch fresh data
  });

  return Response.json(await response.json());
}
```

**Notes**:

- Uses `cache: 'no-store'` to always get fresh data
- Simple passthrough to backend
- No authentication required (public data)

#### POST /api/reports/create

**Purpose**: Create new incident report

**Backend Service**: Report Service

**Implementation**:

```typescript
// app/api/reports/create/route.ts
export async function POST(request: Request) {
  const body = await request.json();

  const reportServiceUrl = process.env.REPORT_SERVICE_URL;

  const response = await fetch(`${reportServiceUrl}/createReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return Response.json(data);
}
```

**Request Body**:

```typescript
{
  title: string;
  description?: string;
  latitude: number;
  longitude: number;
  reportCategory: string;
  imageIds?: string[];
  userId?: string | null;
}
```

#### POST /api/media/upload

**Purpose**: Upload images for reports

**Backend Service**: Media Service

**Implementation**:

```typescript
// app/api/media/upload/route.ts
export async function POST(request: Request) {
  const formData = await request.formData();

  const mediaServiceUrl = process.env.MEDIA_SERVICE_URL;

  const response = await fetch(`${mediaServiceUrl}/media/upload`, {
    method: 'POST',
    body: formData,
  });

  return Response.json(await response.json());
}
```

**Response**:

```typescript
{
  imageIds: string[] // Array of uploaded image IDs
}
```

**Notes**:

- Forwards FormData as-is to backend
- No Content-Type header needed
- Returns array of image IDs for report creation

## React Query Integration

### Setup

**Provider**: `components/providers/query-client-provider.tsx`

```typescript
'use client'

export function QueryClientProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <TanStackQueryClientProvider client={queryClient}>
      {children}
    </TanStackQueryClientProvider>
  );
}
```

### Usage Example

```typescript
'use client'

import { useQuery, useMutation } from '@tanstack/react-query';
import { getReports, createReport } from '@/lib/api/reports';

export function ReportsPage() {
  // Fetch reports
  const { data: reports, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: getReports,
  });

  // Create report mutation
  const createMutation = useMutation({
    mutationFn: createReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  // ...
}
```

## Custom Hooks

### useApi Hook

**Location**: `hooks/use-api.ts`

Generic hook for API calls with loading/error states:

```typescript
export function useApi<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await fetchFn();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, dependencies);

  return { data, loading, error };
}
```

## Environment Configuration

### Required Variables

```bash
# Backend Service URLs
MAP_SERVICE_URL=http://localhost:8086
REPORT_SERVICE_URL=http://localhost:8081
MEDIA_SERVICE_URL=http://localhost:8084
USER_SERVICE_URL=http://localhost:8082
AUTHZ_SERVICE_URL=http://localhost:8083
```

### Docker Environment

In production/Docker, use internal service names:

```bash
MAP_SERVICE_URL=http://map-service:8080
REPORT_SERVICE_URL=http://report-service:8080
MEDIA_SERVICE_URL=http://media-service:8080
```

## Error Handling

### Client-Side

```typescript
try {
  const result = await createReport(data);
  toast.success('Report created successfully');
} catch (error) {
  if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error('An unexpected error occurred');
  }
}
```

### API Route Level

```typescript
export async function POST(request: Request) {
  try {
    // ... logic
  } catch (error) {
    console.error('API Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
```

## Best Practices

1. **Type Safety**
   - Define TypeScript interfaces for all API responses
   - Use generics in fetch functions

2. **Error Boundaries**
   - Wrap API calls in try-catch
   - Provide user-friendly error messages

3. **Loading States**
   - Show loading indicators during API calls
   - Use React Query's built-in loading states

4. **Caching**
   - Use React Query cache for repeated requests
   - Configure appropriate stale times

5. **Environment Variables**
   - Never expose backend URLs to client
   - Use API routes as proxy

6. **Request Validation**
   - Validate data before sending to API
   - Use Zod or similar for schema validation

7. **Authentication**
   - Include auth tokens in requests
   - Handle 401 responses (redirect to login)

8. **Optimistic Updates**
   - Update UI immediately
   - Rollback on error

```typescript
const mutation = useMutation({
  mutationFn: updateReport,
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['reports'] });

    // Snapshot previous value
    const previousReports = queryClient.getQueryData(['reports']);

    // Optimistically update
    queryClient.setQueryData(['reports'], (old) => {
      // ... update logic
    });

    return { previousReports };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['reports'], context.previousReports);
  },
  onSettled: () => {
    // Always refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['reports'] });
  },
});
```
