# loveistough-hub - Relationship Advice & Community Platform

A modern web platform for relationship advice, community support, and expert insights. Built with a hub-and-spoke architecture optimized for Vercel deployment.

## 🏗️ Project Architecture

### Hub & Spoke Pattern
- **Main Hub**: Homepage (`index.html`) serves as the Vercel root
- **Feature Spokes**: Separate feature directories with `/public/` (HTML/CSS) and `/src/` (JavaScript) subdirectories
- **Consolidated API**: Single API endpoint (`/api/index.js`) to stay under Vercel's 12-function limit

### Directory Structure
```
loveistough-hub/
├── index.html                 # Main homepage (hub)
├── styles.css                 # Global design system
├── script.js                  # Main JavaScript utilities
├── package.json               # Dependencies and scripts
├── vercel.json               # Vercel configuration
├── api/
│   ├── index.js              # Consolidated API endpoint
│   └── dev-tools/
│       └── setup.js          # Database setup and utilities
├── spoke-articles/
│   ├── public/
│   │   ├── articles.html     # Articles page
│   │   └── articles.css      # Articles-specific styles
│   └── src/
│       └── articles.js       # Articles functionality
├── spoke-advice/
│   ├── public/
│   │   ├── advice.html       # Advice page
│   │   └── advice.css        # Advice-specific styles
│   └── src/
│       └── advice.js         # Advice functionality
├── spoke-community/
│   ├── public/
│   │   ├── community.html    # Community page
│   │   └── community.css     # Community-specific styles
│   └── src/
│       └── community.js      # Community functionality
└── spoke-admin/
    ├── public/
    │   ├── admin.html        # Admin dashboard
    │   └── admin.css         # Admin-specific styles
    └── src/
        └── admin.js          # Admin functionality
```

## 🎨 Design System

### Color Palette
- **Light Tan/Sand**: `#F5F5DC` (Beige) - Background color
- **Slate Gray**: `#708090` - Primary button and border color
- **Vibrant Red**: `#FF0000` - Glow accent color
- **Black**: `#000000` - Text color
- **Dark Tan**: `#E6E6D1` - Subtle depth for gradients

### Typography
- **Headers**: Amatic SC (Google Fonts)
- **Body Text**: Bebas Neue (Google Fonts)

### Interactive Elements
- **Hover Effects**: Scale (1.05), translateY(-5px), translateX(5px)
- **Glow Effects**: Vibrant Red with 0.3-0.5 opacity
- **Transitions**: 0.3s ease for smooth animations
- **Card Effects**: Light tan backgrounds with Slate Gray borders

## 🚀 Features

### Homepage (Hub)
- Hero section with call-to-action buttons
- Feature overview cards
- Latest content preview
- Responsive navigation

### Articles Feature
- Category filtering (Communication, Trust, Conflict, Intimacy)
- Featured article highlighting
- Article cards with hover effects
- Modal article viewing
- Load more functionality

### Advice Feature
- Ask for advice form (anonymous option)
- Category filtering and sorting
- Advice post cards with stats
- Modal viewing with response system
- Anonymous posting support

### Community Feature
- Create community posts
- Category-based filtering (Discussion, Support, Celebration, Venting, Questions)
- Tag system
- Like and view statistics
- Modal post viewing

### Admin Dashboard
- Site statistics overview
- Database setup functionality
- User management (placeholder)
- Content management (placeholder)

## 🛠️ Technical Implementation

### API Structure
- **Consolidated Endpoint**: `/api/index.js` handles all operations
- **Action-Based Routing**: Uses `action` parameter to route requests
- **Database Integration**: CockroachDB with PostgreSQL compatibility
- **Authentication**: JWT-based with localStorage tokens

### Database Schema
- **Users**: Authentication and profile management
- **Articles**: Published content with categories and tags
- **Advice Posts**: User-submitted advice requests
- **Advice Responses**: Responses to advice posts
- **Community Posts**: User-generated community content
- **Comments**: Threaded commenting system
- **Likes**: User interaction tracking
- **File Uploads**: Media management

### Responsive Design
- **Mobile First**: Optimized for mobile devices
- **Breakpoints**: 768px, 700px, 480px
- **Grid Layouts**: CSS Grid with auto-fit columns
- **Flexible Typography**: Responsive font sizing

## 📱 Responsive Breakpoints

- **Mobile**: `@media (max-width: 768px)` - Stacked layouts
- **Small Mobile**: `@media (max-width: 480px)` - Adjusted font sizes
- **Tablet**: `@media (max-width: 700px)` - Grid adjustments

## 🔧 Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- Vercel CLI
- CockroachDB account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd loveistough-hub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Variables**
   Create a `.env` file with:
   ```
   DATABASE_URL=your_cockroachdb_connection_string
   JWT_SECRET=your_jwt_secret_key
   NODE_ENV=development
   ```

4. **Database Setup**
   - Visit `/spoke-admin/public/admin.html`
   - Click "Setup Database" to initialize tables

5. **Local Development**
   ```bash
   npm run dev
   ```

6. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

## 🎯 Key Features

### Design System Compliance
- ✅ Light tan/sand background (`#F5F5DC`)
- ✅ Slate Gray primary color (`#708090`)
- ✅ Vibrant Red accent color (`#FF0000`)
- ✅ Amatic SC and Bebas Neue typography
- ✅ Hover transforms and glow effects
- ✅ Responsive grid layouts

### Technical Requirements
- ✅ Hub & spoke architecture
- ✅ Consolidated API endpoints
- ✅ CockroachDB integration
- ✅ JWT authentication
- ✅ Responsive design
- ✅ Modal system
- ✅ Loading states
- ✅ Error handling

### Animation System
- ✅ LoveIsTough themed animations
- ✅ Smooth transitions (0.3s ease)
- ✅ Hover effects with scale and glow
- ✅ Fade-in animations on scroll
- ✅ Loading spinners with brand colors

## 🔗 API Endpoints

All API calls go through `/api/index.js` with the following actions:

- `setup-database` - Initialize database tables
- `register` - User registration
- `login` - User authentication
- `create-article` - Create new article
- `get-articles` - Retrieve articles with filtering
- `create-advice` - Create advice post
- `get-advice` - Retrieve advice posts
- `create-community-post` - Create community post
- `get-community-posts` - Retrieve community posts
- `upload-file` - File upload handling
- `get-stats` - Site statistics

## 🎨 Customization

### Color Scheme
The design system uses CSS custom properties for easy customization:

```css
:root {
    --light-tan: #F5F5DC;
    --slate-gray: #708090;
    --vibrant-red: #FF0000;
    --black: #000000;
    --dark-tan: #E6E6D1;
}
```

### Typography
Font families can be updated in the CSS variables:

```css
:root {
    --font-header: 'Amatic SC', cursive;
    --font-body: 'Bebas Neue', sans-serif;
}
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For support or questions, please open an issue in the repository.

---

**LoveIsTough** - Real advice for real relationships. ❤️ 