# Astarta Capital

A modern, interactive presentation website for Astarta Capital investment firm.

## 🚀 Features

- **Interactive Video Scrolling**: Synchronized video playback with scroll position
- **Smooth Animations**: Typing animations and content block transitions
- **Responsive Design**: Optimized for desktop and mobile devices
- **Reverse Video Playback**: Seamless backward scrolling with dedicated reverse video
- **Form Integration**: Contact form with validation (demo mode)
- **Sound Controls**: Toggle sound on/off functionality

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3 (SCSS), JavaScript (ES6+)
- **Build Tool**: Vite
- **Libraries**: 
  - FullPage.js for smooth scrolling
- **Video Processing**: FFmpeg for reverse video generation

## 📁 Project Structure

```
src/
├── index.html          # Main HTML file 
├── js/
│   └── main.js         # Main JavaScript logic
├── styles/
│   ├── main.scss       # Main stylesheet
│   ├── base/           # Base styles (variables, mixins, etc.)
│   ├── layout/         # Layout-specific styles
│   └── vendors/        # Third-party styles
└── templates/          # Handlebars partials
    ├── header.html
    ├── footer.html
    └── sound-button.html

public/
├── video/              # Video files
├── images/             # Images and icons
└── fonts/              # Font files
```

## 🎬 Video System

The project uses a sophisticated video system with:

- **Main Video**: `output-zipped.mp4` (desktop) / `output_mob.mp4` (mobile)
- **Reverse Video**: `backward.mp4` (desktop) / `backward_mob.mp4` (mobile)
- **Seamless Transitions**: Crossfade between forward and reverse videos
- **Performance Optimized**: Preloading and efficient frame seeking

## 🎨 Animation System

- **Content Blocks**: Sequential animation of text and image blocks
- **Typing Animation**: Character-by-character text reveal
- **Video Synchronization**: Scroll-based video playback control
- **UI Transitions**: Smooth show/hide animations for interface elements

## 📱 Responsive Design

- **Desktop**: Full-featured experience with all animations
- **Mobile**: Optimized video files and touch-friendly interface
- **Breakpoints**: 479px for mobile/desktop switching

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## 🎯 Key Features Explained

### Video Synchronization
The video playback is synchronized with scroll position using timecode segments defined in `VIDEO_SEGMENTS` array. Each scroll section corresponds to a specific video time range.

### Reverse Playback
When scrolling backward, the system switches to a pre-rendered reverse video file, ensuring smooth playback without performance issues.

### Form Handling
The contact form is set up for demonstration purposes with client-side validation and submission handling.

## 🔧 Configuration

### Video Segments
Edit the `VIDEO_SEGMENTS` array in `main.js` to adjust video timing:

```javascript
const VIDEO_SEGMENTS = [
  { from: 0, to: 5 },      // Intro
  { from: 5, to: 10 },     // Section 1
  // ... more segments
];
```

### Animation Timing
Adjust animation delays in the constants section:

```javascript
const BLOCK_ANIMATION_DELAY = 300; // ms between block animations
const TYPING_ANIMATION_DELAY = 50; // ms between characters
```

## 📝 Notes

- The form is currently in demo mode and doesn't submit to a server
- Video files are excluded from git via `.gitignore`
- The project uses `noindex,nofollow` meta tags for development

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary to Astarta Capital.