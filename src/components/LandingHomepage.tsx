import React from 'react';
import {
  Monitor,
  Video,
  FileVideo,
  Upload,
  MoreHorizontal,
  Search,
  Bell,
  Play,
  SkipBack,
  SkipForward,
  Scissors,
  Trash2,
  Link2,
} from 'lucide-react';

export const SnapRecordLogo: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}> = ({ size = 'md', onClick }) => {
  const gradId = React.useId();
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 34 : 28;
  const textClass =
    size === 'sm'
      ? 'text-lg font-bold tracking-tight text-[#0A1629]'
      : size === 'lg'
        ? 'text-2xl font-bold tracking-tight text-[#0A1629]'
        : 'text-xl font-bold tracking-tight text-[#0A1629]';

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2.5 text-left focus:outline-none group shrink-0"
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 group-hover:scale-105"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B9EFF" />
            <stop offset="100%" stopColor="#0F6FFF" />
          </linearGradient>
        </defs>
        <path
          d="M20 2.2C21.9 2.2 23.5 3.4 24.4 4.9C26.1 4.1 28.1 4.3 29.7 5.5C31.2 6.6 31.9 8.5 31.6 10.3C33.4 10.6 35.1 11.8 35.9 13.5C36.7 15.2 36.4 17.2 35.2 18.6C36.6 19.9 37.3 21.8 36.9 23.7C36.5 25.6 35.1 27.1 33.3 27.6C33.8 29.4 33.3 31.4 31.9 32.7C30.5 34 28.5 34.3 26.8 33.6C26.1 35.3 24.6 36.7 22.7 37C20.8 37.3 18.9 36.5 17.8 35C16.4 36.2 14.4 36.6 12.6 35.9C10.8 35.2 9.6 33.6 9.3 31.8C7.5 31.8 5.7 30.8 4.8 29.2C3.9 27.6 4.1 25.5 5.1 24C3.6 22.9 2.8 21.1 3 19.2C3.2 17.3 4.5 15.7 6.2 15C5.6 13.2 6 11.2 7.3 9.8C8.6 8.4 10.6 7.9 12.4 8.5C13 6.7 14.4 5.2 16.3 4.8C17.4 4.5 18.8 2.2 20 2.2Z"
          fill={`url(#${gradId})`}
        />
        <circle cx="20" cy="20" r="14" fill={`url(#${gradId})`} />
        <circle cx="20" cy="20" r="6.8" fill="#FFFFFF" />
      </svg>
      <span className={textClass}>SnapRecord</span>
    </button>
  );
};

interface LandingHomepageProps {
  onOpenDashboard: () => void;
  onStartRecording: () => void;
  onGoogleLogin: () => void;
  isSignedIn: boolean;
  isGoogleSigningIn?: boolean;
  userEmail?: string;
}

export const LandingHomepage: React.FC<LandingHomepageProps> = ({
  onOpenDashboard,
  onStartRecording,
  onGoogleLogin,
  isSignedIn,
  isGoogleSigningIn = false,
  userEmail,
}) => {
  return (
    <div className="min-h-screen w-full bg-white text-[#0A1629] selection:bg-blue-600/15 selection:text-blue-900">
      {/* Top Navbar */}
      <header className="mx-auto max-w-[1160px] px-4 sm:px-8 py-5 flex items-center justify-between gap-4">
        <SnapRecordLogo size="md" onClick={onOpenDashboard} />

        <nav
          aria-label="Homepage Navigation"
          className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-600"
        >
          <a
            href="#features"
            className="hover:text-slate-900 transition-colors inline-flex items-center gap-1"
          >
            <span>Features</span>
          </a>
          <a href="#engagement" className="hover:text-slate-900 transition-colors">
            Use Case
          </a>
          <button
            type="button"
            onClick={onOpenDashboard}
            className="hover:text-slate-900 transition-colors"
          >
            My Library
          </button>
          <button
            type="button"
            onClick={onStartRecording}
            className="hover:text-slate-900 transition-colors"
          >
            Recorder
          </button>
        </nav>

        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {isSignedIn ? (
            <>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Drive Connected ({userEmail})</span>
              </span>
              <button
                type="button"
                onClick={onOpenDashboard}
                className="rounded-full bg-[#0F6FFF] hover:bg-[#0B5ED7] text-white text-xs font-semibold px-5 py-2.5 shadow-sm transition-all active:scale-[0.98] whitespace-nowrap"
              >
                Open My Library
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isGoogleSigningIn}
                className="text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors px-2 py-1.5 whitespace-nowrap"
              >
                {isGoogleSigningIn ? 'Connecting...' : 'Log In with Google'}
              </button>
              <button
                type="button"
                onClick={onGoogleLogin}
                disabled={isGoogleSigningIn}
                className="rounded-full bg-[#0F6FFF] hover:bg-[#0B5ED7] text-white text-xs font-semibold px-4 sm:px-5 py-2.5 shadow-sm transition-all active:scale-[0.98] whitespace-nowrap"
              >
                Sign Up with Google
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-[1120px] px-4 sm:px-8 pt-6 sm:pt-10 pb-20">
        <section className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[#0A1629] leading-[1.08]">
            Fast Idea Sharing
          </h1>

          <p className="mt-4 sm:mt-5 text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
            Record and share high-clarity videos — entire screens, application windows, or browser
            tabs — with automatic Google Drive storage and instant shareable links.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            {isSignedIn ? (
              <>
                <button
                  type="button"
                  onClick={onStartRecording}
                  className="rounded-full bg-[#0F6FFF] hover:bg-[#0B5ED7] text-white text-xs sm:text-sm font-semibold px-7 py-3.5 shadow-md shadow-blue-500/20 transition-all active:scale-[0.98]"
                >
                  Start Video Recording
                </button>
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold px-6 py-3.5 transition-all"
                >
                  Open My Library
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={isGoogleSigningIn}
                  className="rounded-full bg-[#0F6FFF] hover:bg-[#0B5ED7] text-white text-xs sm:text-sm font-semibold px-7 py-3.5 shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] inline-flex items-center gap-2.5"
                >
                  <svg className="h-4 w-4 bg-white rounded-full p-0.5 shrink-0" viewBox="0 0 48 48">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                  </svg>
                  <span>
                    {isGoogleSigningIn
                      ? 'Connecting Google Drive...'
                      : 'Continue with Google & Connect Drive'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold px-6 py-3.5 transition-all"
                >
                  Open My Library
                </button>
              </>
            )}
          </div>
        </section>

        {/* 3-Card Pastel Video Showcase Stage */}
        <section
          id="features"
          className="mt-10 sm:mt-12 rounded-[28px] bg-gradient-to-r from-[#DCE5FF] via-[#E8F3FF] to-[#C6F1FF] p-4 sm:p-8 lg:p-10 shadow-inner border border-blue-100/80"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 items-stretch">
            {/* Showcase Card 1: Screen & Window Video Studio */}
            <div
              onClick={onStartRecording}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onStartRecording()}
              className="rounded-2xl bg-white/95 backdrop-blur-xs border border-white shadow-lg shadow-blue-950/5 p-4 flex flex-col justify-between text-left cursor-pointer hover:-translate-y-0.5 transition-transform"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1 text-[10px] text-slate-400 flex-1">
                    <Search className="h-3 w-3" />
                    <span>Search videos</span>
                  </div>
                  <Bell className="h-3.5 w-3.5 text-slate-400" />
                  <span className="h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    S
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1 text-center items-center pb-3 border-b border-slate-100">
                  <div className="relative rounded-xl border-2 border-[#0F6FFF] bg-blue-50/70 py-1.5 flex flex-col items-center justify-center text-[#0F6FFF] font-semibold text-[10px]">
                    <Monitor className="h-3.5 w-3.5 mb-0.5" />
                    <span>Screen</span>
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-2 -right-1 text-slate-950 text-xs font-black select-none"
                    >
                      ↖
                    </span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <Video className="h-3.5 w-3.5 mb-0.5" />
                    <span>Record</span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <FileVideo className="h-3.5 w-3.5 mb-0.5" />
                    <span>MP4</span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <Upload className="h-3.5 w-3.5 mb-0.5" />
                    <span>Drive</span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <MoreHorizontal className="h-3.5 w-3.5 mb-0.5" />
                    <span>More</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-[10px] font-semibold text-slate-700 mb-2">
                    Video Studio Canvas
                  </div>
                  <div className="grid grid-cols-12 gap-2.5 items-stretch">
                    <div className="col-span-5 grid grid-cols-2 gap-1.5">
                      <div className="h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600" />
                      <div className="h-7 rounded-md bg-gradient-to-br from-pink-500 to-rose-400" />
                      <div className="h-7 rounded-md bg-gradient-to-br from-amber-400 to-orange-500" />
                      <div className="h-7 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-500" />
                      <div className="h-7 rounded-md bg-gradient-to-br from-violet-500 to-purple-700" />
                      <div className="h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400">
                        +
                      </div>
                    </div>
                    <div className="col-span-7 rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex flex-col justify-center">
                      <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">
                        SnapRecord Studio
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-slate-900 leading-tight">
                        Entire Screen, Window, or Tab
                      </div>
                      <div className="mt-2 h-1.5 w-16 rounded-full bg-blue-600/20" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                Video Library
              </div>
            </div>

            {/* Showcase Card 2: Video Record Library */}
            <div
              onClick={onOpenDashboard}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onOpenDashboard()}
              className="rounded-2xl bg-white/95 backdrop-blur-xs border border-white shadow-lg shadow-blue-950/5 p-4 flex flex-col justify-between text-left cursor-pointer hover:-translate-y-0.5 transition-transform"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1 text-[10px] text-slate-400 flex-1">
                    <Search className="h-3 w-3" />
                    <span>Search videos</span>
                  </div>
                  <Bell className="h-3.5 w-3.5 text-slate-400" />
                  <span className="h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    S
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1 text-center items-center pb-2.5 border-b border-slate-100">
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <Monitor className="h-3.5 w-3.5 mb-0.5" />
                    <span>Screen</span>
                  </div>
                  <div className="relative rounded-xl border-2 border-[#0F6FFF] bg-blue-50/70 py-1.5 flex flex-col items-center justify-center text-[#0F6FFF] font-semibold text-[10px]">
                    <Video className="h-3.5 w-3.5 mb-0.5" />
                    <span>Record</span>
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-2 -right-1 text-slate-950 text-xs font-black select-none"
                    >
                      ↖
                    </span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <FileVideo className="h-3.5 w-3.5 mb-0.5" />
                    <span>MP4</span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <Upload className="h-3.5 w-3.5 mb-0.5" />
                    <span>Drive</span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <MoreHorizontal className="h-3.5 w-3.5 mb-0.5" />
                    <span>More</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-semibold border-b border-slate-100 py-1.5">
                  <span className="text-[#0F6FFF] border-b-2 border-[#0F6FFF] pb-0.5">
                    Videos
                  </span>
                  <span className="text-slate-400">Shared</span>
                  <span className="text-slate-400">Team</span>
                  <span className="text-slate-400">Favorites</span>
                </div>

                <div className="mt-2 space-y-2">
                  {[
                    { title: 'Sales Strategy Update.mp4', time: 'Just now', color: 'bg-rose-500' },
                    {
                      title: 'Product Demo Walkthrough.mp4',
                      time: '1 hour ago',
                      color: 'bg-sky-500',
                      actions: true,
                    },
                    { title: 'Employee Onboarding.mp4', time: '14 hours ago', color: 'bg-amber-500' },
                    { title: 'Sidebar Design Feedback.mp4', time: '1 day ago', color: 'bg-indigo-500' },
                  ].map((row) => (
                    <div
                      key={row.title}
                      className="flex items-center justify-between gap-2 text-[10px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-5 w-7 rounded ${row.color} shrink-0`} />
                        <div className="truncate">
                          <div className="font-semibold text-slate-800 truncate">
                            {row.title}
                          </div>
                          <div className="text-[9px] text-slate-400">{row.time}</div>
                        </div>
                      </div>
                      {row.actions ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-semibold text-slate-700">
                            Copy Link
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-semibold text-slate-700">
                            Share
                          </span>
                        </div>
                      ) : (
                        <Link2 className="h-3 w-3 text-slate-300 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                Video Library
              </div>
            </div>

            {/* Showcase Card 3: Drive Sync & Instant Video Share */}
            <div
              onClick={onOpenDashboard}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onOpenDashboard()}
              className="rounded-2xl bg-white/95 backdrop-blur-xs border border-white shadow-lg shadow-blue-950/5 p-4 flex flex-col justify-between text-left cursor-pointer hover:-translate-y-0.5 transition-transform"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1 text-[10px] text-slate-400 flex-1">
                    <Search className="h-3 w-3" />
                    <span>Search videos</span>
                  </div>
                  <Bell className="h-3.5 w-3.5 text-slate-400" />
                  <span className="h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                    S
                  </span>
                </div>

                <div className="grid grid-cols-5 gap-1 text-center items-center pb-3 border-b border-slate-100">
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <Monitor className="h-3.5 w-3.5 mb-0.5" />
                    <span>Screen</span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <Video className="h-3.5 w-3.5 mb-0.5" />
                    <span>Record</span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <FileVideo className="h-3.5 w-3.5 mb-0.5" />
                    <span>MP4</span>
                  </div>
                  <div className="relative rounded-xl border-2 border-[#0F6FFF] bg-blue-50/70 py-1.5 flex flex-col items-center justify-center text-[#0F6FFF] font-semibold text-[10px]">
                    <Upload className="h-3.5 w-3.5 mb-0.5" />
                    <span>Drive</span>
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-2 -right-1 text-slate-950 text-xs font-black select-none"
                    >
                      ↖
                    </span>
                  </div>
                  <div className="py-1.5 flex flex-col items-center justify-center text-slate-400 text-[10px]">
                    <MoreHorizontal className="h-3.5 w-3.5 mb-0.5" />
                    <span>More</span>
                  </div>
                </div>

                <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-3 text-white relative h-32 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-[9px] font-semibold">
                    <span className="bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full">
                      Google Drive Synced
                    </span>
                    <span className="font-mono">02:14</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-7 w-7 rounded-full bg-white text-blue-600 flex items-center justify-center shadow-xs">
                      <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                    </span>
                    <div>
                      <div className="text-[11px] font-bold leading-tight">
                        Design Review & Handoff
                      </div>
                      <div className="text-[9px] text-blue-100">
                        Instant share link ready
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                Personal Library
              </div>
            </div>
          </div>
        </section>

        {/* Engagement Section + 2 Feature Cards */}
        <section id="engagement" className="mt-14 sm:mt-20">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#0A1629] leading-tight">
              Get 10x higher engagement
              <br />
              and response rates
            </h2>
            <p className="mt-3.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              Use video in your sales, marketing, support, and team communication to boost
              clarity. People absorb and remember much more through video than text
            </p>
          </div>

          <div className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Left Card: Reviews and Approvals */}
            <div className="rounded-3xl bg-[#F2F6FF] p-5 sm:p-7 flex flex-col justify-between border border-blue-100/80">
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-[#0F6FFF]" />
                    <span className="text-[10px] font-semibold text-slate-700">
                      Product Launch Walkthrough
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-full bg-[#0F6FFF] text-white text-[10px] font-semibold">
                      Copy Link
                    </span>
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                      Share
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-7 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 aspect-video p-3 flex flex-col justify-end text-white relative overflow-hidden">
                    <div className="text-[10px] font-bold">Q4 Campaign Review</div>
                    <div className="mt-1 h-1 w-full bg-white/30 rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-white" />
                    </div>
                  </div>
                  <div className="col-span-5 space-y-2 text-left">
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2">
                      <div className="text-[9px] text-slate-500">Add timestamp comment...</div>
                      <div className="mt-1.5 flex justify-end">
                        <span className="px-2 py-0.5 rounded bg-[#0F6FFF] text-white text-[8px] font-semibold">
                          Comment at 1:42
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1 text-[9px] text-slate-600">
                      <div className="font-semibold text-slate-800">
                        Alex R. <span className="text-blue-600 font-mono">01:15</span>
                      </div>
                      <p className="text-slate-500 leading-tight">
                        Love the new transition here! Ready for client sign-off.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-base sm:text-lg font-bold text-[#0A1629]">
                  Get to final faster with reviews and approvals
                </h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Accelerate project delivery by collecting actionable feedback with time-stamped
                  comments and instant Google Drive share links.
                </p>
              </div>
            </div>

            {/* Right Card: Edit your videos to perfection */}
            <div className="rounded-3xl bg-[#F5F3FF] p-5 sm:p-7 flex flex-col justify-between border border-indigo-100/80">
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
                <div className="flex items-center justify-between text-[11px] text-slate-600 pb-3 border-b border-slate-100">
                  <span className="font-mono font-semibold text-slate-800">
                    0:15 <span className="text-slate-400">/ 0:50</span>
                  </span>
                  <div className="flex items-center gap-3 text-slate-700">
                    <SkipBack className="h-3.5 w-3.5" />
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <SkipForward className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-slate-400">⌄</span>
                </div>

                <div className="my-5 space-y-2.5">
                  <div className="flex justify-between text-[9px] font-mono text-slate-400">
                    <span>0:00</span>
                    <span>0:05</span>
                    <span>0:10</span>
                    <span>0:15</span>
                    <span>0:20</span>
                    <span>0:25</span>
                  </div>

                  <div className="relative h-7 rounded-lg bg-slate-100 flex items-center px-6">
                    <div className="h-6 w-3/5 rounded-md border-2 border-[#0F6FFF] bg-blue-500/15 flex items-center justify-between px-1">
                      <span className="h-3 w-0.5 bg-[#0F6FFF] rounded-full" />
                      <span className="h-3 w-0.5 bg-[#0F6FFF] rounded-full" />
                    </div>
                  </div>

                  <div className="relative h-7 rounded-lg bg-slate-100 flex items-center pl-20 pr-3">
                    <div className="h-6 w-full rounded-md border-2 border-purple-600 bg-purple-500/15 flex items-center justify-between px-1">
                      <span className="h-3 w-0.5 bg-purple-600 rounded-full" />
                      <span className="h-3 w-0.5 bg-purple-600 rounded-full" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-medium text-slate-700">
                    <Scissors className="h-3 w-3" />
                    <span>Split to trim at 01:27</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-[10px] font-medium text-slate-700">
                    <Trash2 className="h-3 w-3" />
                    <span>Delete Clip</span>
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-base sm:text-lg font-bold text-[#0A1629]">
                  Edit your videos to perfection
                </h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                  Seamlessly trim start and end timestamps or convert WebM clips to MP4 without the
                  hassle of external editing software.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
