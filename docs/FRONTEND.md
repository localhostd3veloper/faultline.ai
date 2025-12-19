# Frontend Documentation

## Technology Stack

- **Framework**: Next.js 16.0.10 (App Router)
- **Runtime**: React 19.2.1
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **UI Components**: Radix UI primitives
- **Charts**: Recharts 2.15.4
- **Code Highlighting**: Prism.js, highlight.js
- **Markdown**: react-markdown with remark-gfm
- **Package Manager**: Bun
- **Build Tool**: Next.js built-in

## Project Structure

```
client/
├── app/                    # Next.js App Router
│   ├── actions/           # Server actions
│   ├── api/               # API routes (if needed)
│   ├── editor/            # Code editor page
│   ├── jobs/              # Job polling page
│   ├── review/            # Analysis review page
│   ├── runs/              # Job history page
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── components/
│   ├── core/              # Core components (header, footer, logo)
│   └── ui/                # Reusable UI components (shadcn/ui)
├── lib/
│   ├── api.ts             # API client utility
│   ├── endpoints.ts       # API endpoint definitions
│   ├── hooks/             # Custom React hooks
│   ├── openapi.ts         # OpenAPI detection utilities
│   ├── store/             # Zustand stores
│   ├── types/             # TypeScript type definitions
│   └── utils.ts           # Utility functions
├── public/                # Static assets
├── components.json        # shadcn/ui configuration
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript configuration
├── next.config.ts         # Next.js configuration
└── Dockerfile             # Docker build configuration
```

## Routing

### App Router Structure

**Home (`/`)**

- File upload interface
- URL fetching for OpenAPI specs
- Paste content input
- Routes to `/editor` after content is loaded

**Editor (`/editor`)**

- Code editor with syntax highlighting
- Content type detection
- Metadata form (repo, team, risk tolerance, depth)
- Analysis trigger button
- Routes to `/jobs/{jobId}` after analysis starts

**Job Polling (`/jobs/[jobId]`)**

- Real-time job status polling
- Progress indicator
- Auto-redirects to `/review/{jobId}` on completion
- Error handling for failed jobs

**Review (`/review/[jobId]`)**

- Analysis results display
- Production readiness score
- Charts visualization
- Findings list with expandable details
- Suggested next steps
- Markdown report viewer

**Runs (`/runs`)**

- List of all past analysis jobs
- Status badges
- Timestamps
- Links to review pages

## State Management

### Zustand Stores

**Editor Store (`lib/store/editor.ts`)**

- Manages editor content and content type
- Stores metadata (repo, team, risk tolerance, depth)
- Persists across navigation

### React Hooks

**useJobStatus (`lib/hooks/job-status.ts`)**

- Polls job status every 5 seconds
- Automatically fetches result when completed
- Handles error states
- Returns: `{ status, result, error, progressHint }`

## API Integration

### API Client (`lib/api.ts`)

Centralized fetch wrapper:

- Handles base URL configuration
- Error handling
- Type-safe responses
- Returns `{ data, error }` pattern

**Configuration:**

- Development: `http://localhost:8080`
- Production: `https://api.faultline.ai`
- Override: `BACKEND_API_URL` environment variable

### Server Actions (`app/actions/`)

**analyze.ts**

- `analyzeArtifact(data)` - Submit analysis request
- `getJobStatus(jobId)` - Get job status
- `getJobResult(jobId)` - Get analysis result
- `getJobList()` - List all jobs

All actions use the `"use server"` directive for Next.js server actions.

### Endpoints (`lib/endpoints.ts`)

Centralized endpoint definitions:

- `/artifacts/analyze` - Analysis submission
- `/jobs/{jobId}` - Job status
- `/jobs/{jobId}/result` - Job result
- `/jobs` - Job list

## UI Components

### Core Components

**Header (`components/core/header.tsx`)**

- Navigation bar
- Theme switcher
- Logo

**Footer (`components/core/footer.tsx`)**

- Footer content

**Logo (`components/core/logo.tsx`)**

- Faultline.ai branding

**Theme Switch (`components/core/theme-switch.tsx`)**

- Dark/light mode toggle
- Uses next-themes

### UI Components (shadcn/ui)

All components in `components/ui/` are based on Radix UI primitives:

- `accordion.tsx` - Collapsible content
- `alert-dialog.tsx` - Modal dialogs
- `badge.tsx` - Status badges
- `button.tsx` - Buttons
- `card.tsx` - Card containers
- `chart.tsx` - Chart wrapper (Recharts)
- `dialog.tsx` - Modal dialogs
- `dropdown-menu.tsx` - Dropdown menus
- `input.tsx` - Form inputs
- `select.tsx` - Select dropdowns
- `sonner.tsx` - Toast notifications
- `tabs.tsx` - Tab navigation
- `tooltip.tsx` - Tooltips

### Review Page Components

**ScoreRing (`review/[jobId]/components/score-ring.tsx`)**

- Circular progress indicator
- Shows production readiness score (0-100)

**ReviewCharts (`review/[jobId]/components/review-charts.tsx`)**

- Renders multiple chart types (line, bar, pie)
- Uses Recharts library
- Responsive grid layout

**FindingsList (`review/[jobId]/components/findings-list.tsx`)**

- Expandable findings accordion
- Severity badges
- Category grouping
- Rationale and remediation details

**NextSteps (`review/[jobId]/components/next-steps.tsx`)**

- Ordered list of suggested actions
- Checkbox-style UI

**CopyableJobId (`review/[jobId]/components/copyable-job-id.tsx`)**

- Job ID display with copy button
- Toast notification on copy

## Content Type Detection

**OpenAPI Detection (`lib/openapi.ts`)**

- Detects OpenAPI JSON/YAML from:
  - File extensions (.json, .yaml, .yml)
  - URL patterns
  - Content structure (checks for OpenAPI schema keys)
- Detects architecture diagrams from keywords
- Falls back to markdown for other content

## Data Flow

### Analysis Submission Flow

```
1. User loads content (upload/URL/paste)
2. Content stored in Zustand editor store
3. User navigates to /editor
4. User fills metadata (optional)
5. User clicks "Analyze"
6. Server action: analyzeArtifact()
7. API call: POST /artifacts/analyze
8. Receive job_id
9. Navigate to /jobs/{jobId}
10. useJobStatus hook starts polling
11. Poll GET /jobs/{jobId} every 5s
12. When status === COMPLETED:
    - Fetch GET /jobs/{jobId}/result
    - Navigate to /review/{jobId}
13. Display results
```

### Job Polling Implementation

```typescript
// Poll interval: 5 seconds
// Stops when: COMPLETED, FAILED, or error
// Auto-fetches result on completion
// Cleans up interval on unmount
```

## Styling

### Tailwind CSS 4

- Utility-first CSS framework
- Dark mode support via `next-themes`
- Custom color scheme defined in `globals.css`
- Responsive design with mobile-first approach

### Theme System

- Light/dark mode toggle
- CSS variables for theming
- Consistent color palette across components

## Code Editor

**Editor Component (`app/editor/components/editor.tsx`)**

- Uses `react-simple-code-editor`
- Syntax highlighting with Prism.js
- Content type-aware highlighting
- Real-time content updates

## Charts

**Chart Types Supported:**

- Line charts (trends over time)
- Bar charts (category comparisons)
- Pie charts (distribution)

**Implementation:**

- Recharts library
- Responsive container
- Custom styling
- Data from AI analysis

## Error Handling

### API Errors

- Network errors caught and displayed
- HTTP error status codes shown
- User-friendly error messages

### Job Errors

- Failed job status displayed
- Error message from backend shown
- Retry option (navigate back to editor)

### Validation

- Content required before analysis
- URL validation for fetch
- File type validation on upload

## Performance Optimizations

### Next.js Optimizations

- Server components where possible
- Static generation for review pages (with dynamic params)
- Image optimization (if images added)
- Code splitting automatic

### React Optimizations

- `useCallback` for event handlers
- `useMemo` for expensive computations (if needed)
- Proper dependency arrays in hooks

### Bundle Size

- Tree shaking enabled
- Standalone output mode for Docker
- Minimal dependencies

## Build & Deployment

### Development

```bash
bun install
bun dev
```

### Production Build

```bash
bun run build
bun run start
```

### Docker Build

- Multi-stage build
- Dependencies stage
- Builder stage (Next.js build)
- Runner stage (minimal runtime)
- Uses Bun for runtime

### Environment Variables

- `BACKEND_API_URL` - Backend API URL
- `NODE_ENV` - Environment mode

## Type Safety

### TypeScript Configuration

- Strict mode enabled
- Path aliases (`@/` for `lib/`)
- Next.js types included

### Type Definitions (`lib/types/index.ts`)

- All API request/response types
- Job status enum
- Analysis data structures
- Chart data structures

## Testing Considerations

Currently no tests. Recommended:

- Unit tests for utilities
- Integration tests for API calls
- E2E tests for critical flows
- Component tests for UI components

## Accessibility

- Radix UI components are accessible by default
- Keyboard navigation supported
- ARIA labels where needed
- Focus management in modals
- Screen reader friendly

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2020+ features
- CSS Grid and Flexbox
- Async/await support required

## Future Improvements

- Authentication/authorization
- User accounts and saved analyses
- Export reports (PDF, markdown)
- Offline support with service workers
- Progressive Web App (PWA)
- Advanced filtering and search
- Comparison between analyses
- Integration with CI/CD
