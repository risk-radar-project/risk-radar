# App Structure and Routing

## Next.js App Router

The frontend uses Next.js 14's App Router with a file-based routing system. Routes are organized using route groups to separate concerns and apply different layouts.

## Route Groups

Route groups in Next.js allow you to organize routes without affecting the URL structure. They're created using parentheses `()` in folder names.

### (public) - Public Pages

**Location**: `app/(public)/`

Pages accessible to all users without authentication.

- **Layout**: `app/(public)/layout.tsx`
- **Homepage**: `app/(public)/page.tsx`

These pages don't require authentication and are the entry point for new users.

### (auth) - Authentication Pages

**Location**: `app/(auth)/`

Handles all authentication-related flows.

**Pages**:

- **Login**: `app/(auth)/login/page.tsx`
  - User login form
  - OAuth integration (if configured)
  - Redirect to previous page after login

- **Register**: `app/(auth)/register/page.tsx`
  - New user registration
  - Email verification
  - Password strength validation

- **Reset Password**: `app/(auth)/reset-password/page.tsx`
  - Password recovery flow
  - Email-based reset token
  - New password input

**Key Features**:

- All auth pages share a centered layout
- Redirects authenticated users away
- Form validation with error messages
- CSRF protection

### (user) - Protected User Pages

**Location**: `app/(user)/`

Pages requiring user authentication.

**Layout**: `app/(user)/layout.tsx`

- Wraps all user pages with `ClientUserGuard`
- Redirects unauthenticated users to login
- Shows loading state during auth check

**Pages**:

- **My Reports**: `app/(user)/my-reports/`
  - Server component: `page.tsx` - fetches initial data
  - Client component: `my-reports-client.tsx` - interactive table
  - Features: filtering, sorting, pagination, delete

- **Profile**: `app/(user)/profile/`
  - User profile management
  - Update personal information
  - Change password

- **Notifications**: `app/(user)/notifications/`
  - User notification center
  - Mark as read functionality
  - Real-time updates (WebSocket/polling)

### (admin) - Admin Pages

**Location**: `app/(admin)/`

Administrative pages for users with admin role.

**Layout**: `app/(admin)/layout.tsx`

- Uses `ClientAdminGuard` component
- Checks for admin role/permission
- Redirects non-admin users

**Admin Panel**: `app/(admin)/admin/`

- Dashboard with statistics
- User management
- Report moderation
- System settings

### Unprotected Pages

**Map Page**: `app/map/`

- Public map view showing all verified reports
- Server-side rendering for SEO
- Interactive map component
- Search and filtering

**Submit Report**: `app/submit-report/`

- Form for creating new incident reports
- Can be used by both authenticated and anonymous users
- Location picker with geolocation
- Image upload

## API Routes

**Location**: `app/api/`

Next.js API routes act as a proxy layer between the frontend and backend microservices.

### Key API Routes

```
app/api/
├── admin/           # Admin operations
├── ai/              # AI service endpoints
├── ai-assistant/    # AI assistant chat
├── login/           # Authentication
├── register/        # User registration
├── me/              # Current user info
├── reports/         # Report CRUD operations
│   └── create/
├── media/           # Media upload
│   └── upload/
├── notifications/   # User notifications
└── users/           # User management
```

## File Nuances

### Server vs Client Components

**Server Components** (default):

- Can fetch data directly
- Access backend services
- Reduce client bundle size
- Example: `app/map/page.tsx`

```typescript
// Server Component - can use async/await
export default async function MapPage() {
  const reports = await fetch(/* ... */);
  return <MapWrapper reports={reports} />;
}
```

**Client Components** (with 'use client'):

- Interactive elements
- Use React hooks
- Access browser APIs
- Example: `components/map-component.tsx`

```typescript
'use client'

export default function MapComponent({ initialReports }) {
  const [selected, setSelected] = useState(null);
  // ... interactive logic
}
```

### Dynamic Imports

Used for client-only libraries like Leaflet:

```typescript
// app/map/page.tsx
const MapComponent = dynamic(
  () => import('@/components/map-component'),
  { ssr: false, loading: () => <LoadingSpinner /> }
);
```

**Why?**

- Leaflet uses browser-specific APIs (window, document)
- Can't be rendered on server
- Reduces initial bundle size

### Route Handlers

API routes use the new Route Handler syntax:

```typescript
// app/api/reports/route.ts
export async function GET(request: Request) {
  const reports = await fetchFromMapService();
  return Response.json(reports);
}

export async function POST(request: Request) {
  const body = await request.json();
  // ... create report
  return Response.json({ success: true });
}
```

### Layouts and Templates

**Root Layout** (`app/layout.tsx`):

- Wraps entire application
- Loads global CSS
- Sets up fonts
- Provides React Query client

**Nested Layouts**:

- Each route group can have its own layout
- Layouts nest inside parent layouts
- Persist during navigation

```typescript
// app/(user)/layout.tsx
export default function UserLayout({ children }) {
  return (
    <ClientUserGuard>
      <div className="user-container">
        {children}
      </div>
    </ClientUserGuard>
  );
}
```

### Loading States

**Loading UI** (`loading.tsx`):

```typescript
// app/map/loading.tsx
export default function Loading() {
  return <MapSkeleton />;
}
```

Automatically shown during:

- Server component data fetching
- Route navigation
- Suspense boundaries

### Error Boundaries

**Error UI** (`error.tsx`):

```typescript
// app/error.tsx
'use client'

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

Catches errors in:

- Server components
- Client components
- API routes

## Path-Aware Shell

**Component**: `components/layout/path-aware-shell.tsx`

A smart layout component that adapts based on the current route:

- Hides sidebar on auth pages
- Shows different navigation for admin
- Applies route-specific styling

```typescript
'use client'

export function PathAwareShell({ children }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith('/login') ||
                     pathname.startsWith('/register');

  if (isAuthPage) {
    return <CenteredLayout>{children}</CenteredLayout>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      {children}
    </SidebarProvider>
  );
}
```

## Metadata and SEO

Each page can export metadata for SEO:

```typescript
// app/map/page.tsx
export const metadata: Metadata = {
  title: 'RiskRadar - Interactive Map',
  description: 'View all verified incident reports on an interactive map',
  openGraph: {
    title: 'RiskRadar Map',
    description: 'Incident reports across Poland',
  },
};
```
