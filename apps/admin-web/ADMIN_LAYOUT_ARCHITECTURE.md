# Admin Layout Architecture

## Component Hierarchy Diagram

```mermaid
graph TB
    subgraph "Next.js App Router"
        RootLayout["app/layout.tsx<br/>RootLayout<br/>(Providers, Runtime Config)"]
    end
    
    subgraph "Page Routes"
        RootPage["app/page.tsx<br/>AdminHomePage<br/>(Login/Auth)"]
        EcommercePage["app/ecommerce/page.tsx<br/>ECommerceManagement"]
        AnalyticsPage["app/analytics/page.tsx<br/>AnalyticsPage"]
        VendorsPage["app/vendors/page.tsx<br/>AdminVendorManagement"]
        OtherPages["app/*/page.tsx<br/>(Other Admin Pages)"]
    end
    
    subgraph "AdminLayout Component"
        AdminLayout["components/admin/layout/AdminLayout.tsx<br/>AdminLayout Wrapper"]
        
        subgraph "UnifiedAdminSidebar"
            Sidebar["UnifiedAdminSidebar<br/>(Collapsible)"]
            MenuButton["Menu Button<br/>(Opens Sidebar)"]
            CloseButton["Close Button<br/>(Closes Sidebar)"]
            Overlay["Blur Overlay<br/>(Backdrop)"]
            NavItems["Navigation Items<br/>(17 menu items)"]
        end
        
        MainContent["Main Content Area<br/>(flex-1)"]
    end
    
    RootLayout -->|Wraps| RootPage
    RootLayout -->|Wraps| EcommercePage
    RootLayout -->|Wraps| AnalyticsPage
    RootLayout -->|Wraps| VendorsPage
    RootLayout -->|Wraps| OtherPages
    
    EcommercePage -->|Uses| AdminLayout
    AnalyticsPage -->|Uses| AdminLayout
    VendorsPage -->|Uses| AdminLayout
    OtherPages -->|Uses| AdminLayout
    
    AdminLayout -->|Renders| Sidebar
    AdminLayout -->|Renders| MainContent
    
    Sidebar -->|Contains| MenuButton
    Sidebar -->|Contains| CloseButton
    Sidebar -->|Contains| Overlay
    Sidebar -->|Contains| NavItems
    
    MainContent -->|Displays| EcommercePage
    MainContent -->|Displays| AnalyticsPage
    MainContent -->|Displays| VendorsPage
    MainContent -->|Displays| OtherPages
    
    style RootLayout fill:#e1f5ff
    style AdminLayout fill:#fff4e6
    style Sidebar fill:#ffe6e6
    style MainContent fill:#e6ffe6
```

## Navigation Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant MenuButton
    participant Sidebar
    participant AdminLayout
    participant Router
    participant Page
    
    User->>MenuButton: Click Menu Button
    MenuButton->>Sidebar: setOpen(true)
    Sidebar->>Sidebar: Show Sidebar (translate-x-0)
    Sidebar->>Sidebar: Show Overlay
    
    User->>Sidebar: Click Navigation Item
    Sidebar->>AdminLayout: onNavigate(view)
    AdminLayout->>Router: router.push(`/${view}`)
    Router->>Page: Navigate to Page
    Sidebar->>Sidebar: setOpen(false)
    Sidebar->>Sidebar: Hide Sidebar (translate-x-full)
    
    Page->>AdminLayout: Render with Sidebar
    AdminLayout->>Sidebar: Pass activeView (from pathname)
    Sidebar->>Sidebar: Highlight Active Item
```

## State Management Flow

```mermaid
stateDiagram-v2
    [*] --> SidebarClosed: Initial State
    
    SidebarClosed --> SidebarOpen: User clicks Menu Button
    SidebarOpen --> SidebarClosed: User clicks Close Button
    SidebarOpen --> SidebarClosed: User clicks Overlay
    SidebarOpen --> SidebarClosed: User navigates (auto-close)
    
    SidebarOpen: Sidebar visible<br/>Overlay visible<br/>Menu button hidden
    SidebarClosed: Sidebar hidden<br/>Overlay hidden<br/>Menu button visible
    
    note right of SidebarOpen
        - translate-x-0
        - pointer-events-auto
        - z-30
    end note
    
    note right of SidebarClosed
        - translate-x-full
        - pointer-events-none
        - z-30
    end note
```

## Component Props Flow

```mermaid
graph LR
    subgraph "AdminLayout"
        AL[AdminLayout Component]
        ALPathname[usePathname<br/>Gets current path]
        ALRouter[useRouter<br/>Navigation handler]
        ALActiveView[activeView<br/>= pathname.split('/')[1]]
    end
    
    subgraph "UnifiedAdminSidebar"
        US[UnifiedAdminSidebar]
        USOpen[open state<br/>useState false]
        USActiveView[activeView prop]
        USOnNavigate[onNavigate prop]
    end
    
    subgraph "Page Component"
        Page[Page Component<br/>e.g., ECommerceManagement]
        PageContent[Page Content]
    end
    
    ALPathname -->|Extracts| ALActiveView
    ALActiveView -->|Passes| USActiveView
    ALRouter -->|Passes| USOnNavigate
    
    USActiveView -->|Highlights| US
    USOnNavigate -->|Calls| ALRouter
    
    AL -->|Wraps| Page
    Page -->|Renders| PageContent
    
    style AL fill:#fff4e6
    style US fill:#ffe6e6
    style Page fill:#e6ffe6
```

## File Structure

```mermaid
graph TD
    Root[apps/admin-web/]
    
    Root --> App[app/]
    Root --> Components[components/]
    
    App --> Layout[layout.tsx<br/>RootLayout]
    App --> Page[page.tsx<br/>AdminHomePage]
    App --> Ecommerce[ecommerce/page.tsx]
    App --> Analytics[analytics/page.tsx]
    App --> Vendors[vendors/page.tsx]
    App --> Other[*/page.tsx]
    
    Components --> AdminLayout[admin/layout/AdminLayout.tsx]
    Components --> Sidebar[admin/layout/UnifiedAdminSidebar.tsx]
    Components --> EcommerceComps[admin/ecommerce/]
    Components --> AnalyticsComps[admin/analytics/]
    
    Ecommerce -->|Uses| AdminLayout
    Analytics -->|Uses| AdminLayout
    Vendors -->|Uses| AdminLayout
    Other -->|Uses| AdminLayout
    
    AdminLayout -->|Renders| Sidebar
    
    style Layout fill:#e1f5ff
    style AdminLayout fill:#fff4e6
    style Sidebar fill:#ffe6e6
```

## Key Features

1. **Collapsible Sidebar**
   - Starts closed (collapsed)
   - Opens via menu button (top-left)
   - Closes via X button, overlay click, or after navigation
   - Smooth slide-in/out animation

2. **Automatic Active View Detection**
   - Uses `usePathname()` to get current route
   - Extracts first segment after root (`/ecommerce` → `ecommerce`)
   - Highlights active menu item automatically

3. **Next.js Router Integration**
   - Uses `router.push()` for navigation
   - No page reloads
   - Client-side routing

4. **Consistent Layout**
   - All pages wrapped with `AdminLayout`
   - Sidebar always available
   - Main content area flex-1 (takes remaining space)

