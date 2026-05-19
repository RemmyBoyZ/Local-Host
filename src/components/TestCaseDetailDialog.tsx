'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock, Code2, Copy, Edit3, Film, GripVertical, HelpCircle, History,
  Filter, Keyboard, Layers, Loader2, Maximize2, Minimize2, MousePointerClick, Pause, Pencil, Play, RefreshCw, Search, Sparkles, Square, Trash2, Wrench, X, Volume2, VolumeX
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TestCase } from '@/components/TestCaseTable';
import type { ManualRecordingMeta } from '@/hooks/useAutomationLogs';

type DevLogTab = 'console' | 'network' | 'execution' | 'detail-step' | 'timeline';

interface LogEntry {
  id?: string;
  source?: string;
  timestamp?: string | number | Date;
  relativeMs?: number;
  level?: string;
  log?: unknown;
  isConsole?: boolean;
  isNetwork?: boolean;
  isDetailStep?: boolean;
  detailStep?: {
    action?: string;
    label?: string;
    value?: string;
    selector?: string;
    tagName?: string;
    inputType?: string;
    url?: string;
  };
  network?: {
    event?: string;
    method?: string;
    url: string;
    status?: number;
    duration?: number;
    headers?: unknown;
    data?: unknown;
    success?: boolean;
  };
}

type NetworkCategory = 'business' | 'preflight' | 'static' | 'telemetry' | 'data' | 'other';

interface NetworkMeta {
  category: NetworkCategory;
  label: string;
  host: string;
  method: string;
  pathname: string;
  isError: boolean;
}

interface NetworkFilterState {
  search: string;
  host: string;
  method: string;
  status: string;
  showPreflight: boolean;
  showStatic: boolean;
  showTelemetry: boolean;
  showDataUrls: boolean;
  showOther: boolean;
}

type DetailStepData = NonNullable<LogEntry['detailStep']>;
type DetailStepLog = LogEntry & {
  detailStepKey: string;
  detailStep: DetailStepData;
};

type TimelineEvent =
  | { kind: 'step'; log: DetailStepLog; relativeMs: number }
  | { kind: 'network'; log: LogEntry & { network: NonNullable<LogEntry['network']> }; meta: NetworkMeta; relativeMs: number };

const DEFAULT_NETWORK_FILTERS: NetworkFilterState = {
  search: '',
  host: 'all',
  method: 'all',
  status: 'all',
  showPreflight: false,
  showStatic: false,
  showTelemetry: false,
  showDataUrls: false,
  showOther: true,
};

const STATIC_EXTENSIONS = [
  '.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp', '.ico',
  '.woff', '.woff2', '.ttf', '.map', '.json',
];

const formatPrettyValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '-';
    if (trimmed.length > 8000) return `${trimmed.slice(0, 8000)}... [truncated in UI]`;
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatNetworkUrlForDisplay = (url: string, maxLength = 1400) => {
  if (!url) return '-';
  if (url.startsWith('data:')) {
    const commaIndex = url.indexOf(',');
    const mediaType = url.slice(0, Math.min(commaIndex > 0 ? commaIndex : 80, 80));
    return `${mediaType || 'data:'},[omitted ${url.length} chars]`;
  }
  if (url.startsWith('blob:')) return 'blob:[omitted]';
  return url.length > maxLength ? `${url.slice(0, maxLength)}... [truncated in UI]` : url;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
);

const getRequestPayload = (data: unknown) => {
  const record = asRecord(data);
  if (!record) return null;
  return record.requestBody ?? record.payload ?? record.body ?? null;
};

const getResponsePayload = (data: unknown) => {
  const record = asRecord(data);
  if (!record) return data;
  return record.responseBody ?? record.response ?? record.data ?? data;
};

const getDetailStepKey = (log: LogEntry, index: number) => {
  const step = log.detailStep;
  return [
    log.id,
    log.relativeMs,
    step?.action,
    step?.label,
    step?.value,
    step?.selector,
    step?.url,
    index,
  ].filter((part) => part !== undefined && part !== null && part !== '').join('|');
};

const moveKeyBefore = (keys: string[], movingKey: string, targetKey: string) => {
  if (movingKey === targetKey) return keys;
  const withoutMoving = keys.filter((key) => key !== movingKey);
  const targetIndex = withoutMoving.indexOf(targetKey);
  if (targetIndex < 0) return keys;
  return [
    ...withoutMoving.slice(0, targetIndex),
    movingKey,
    ...withoutMoving.slice(targetIndex),
  ];
};

const parseNetworkUrl = (url: string) => {
  if (url.startsWith('data:')) return { host: 'data:', pathname: 'data:', protocol: 'data:' };
  if (url.startsWith('blob:')) return { host: 'blob:', pathname: 'blob:', protocol: 'blob:' };
  try {
    const parsed = new URL(url, 'http://local.invalid');
    return { host: parsed.hostname || 'local', pathname: parsed.pathname || '/', protocol: parsed.protocol };
  } catch {
    return { host: 'unknown', pathname: url, protocol: '' };
  }
};

const getNetworkMeta = (network: NonNullable<LogEntry['network']>): NetworkMeta => {
  const url = network.url || '';
  const parsed = parseNetworkUrl(url);
  const method = (network.method || network.event || 'TRACE').toUpperCase();
  const pathname = parsed.pathname.toLowerCase();
  const isError = typeof network.status === 'number' && network.status >= 400;

  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
    return { category: 'data', label: 'Data URL', host: parsed.host, method, pathname: parsed.pathname, isError };
  }
  if (method === 'OPTIONS') {
    return { category: 'preflight', label: 'Preflight', host: parsed.host, method, pathname: parsed.pathname, isError };
  }
  if (pathname.includes('/cdn-cgi/rum') || pathname.includes('/collect') || pathname.includes('/analytics')) {
    return { category: 'telemetry', label: 'Telemetry', host: parsed.host, method, pathname: parsed.pathname, isError };
  }
  const isStatic = STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext)) ||
    pathname.includes('/_next/') || pathname.includes('/assets/') ||
    pathname.includes('/public/') || pathname.includes('/media/') || pathname.includes('/images/');
  if (isStatic) {
    return { category: 'static', label: 'Static', host: parsed.host, method, pathname: parsed.pathname, isError };
  }
  const isDataMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (pathname.startsWith('/api/') || isDataMethod) {
    return { category: 'business', label: 'API', host: parsed.host, method, pathname: parsed.pathname, isError };
  }
  return { category: 'other', label: 'Other', host: parsed.host, method, pathname: parsed.pathname, isError };
};

const getNetworkCategoryClass = (category: NetworkCategory) => {
  switch (category) {
    case 'business': return 'border-cyan-500/30 bg-cyan-950/60 text-cyan-300';
    case 'preflight': return 'border-amber-500/30 bg-amber-950/60 text-amber-300';
    case 'static': return 'border-slate-600 bg-slate-900 text-slate-400';
    case 'telemetry': return 'border-violet-500/30 bg-violet-950/60 text-violet-300';
    case 'data': return 'border-fuchsia-500/30 bg-fuchsia-950/60 text-fuchsia-300';
    default: return 'border-slate-500/30 bg-slate-800 text-slate-300';
  }
};

const getStatusBucket = (status?: number) => {
  if (typeof status !== 'number') return 'unknown';
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  if (status >= 300) return '3xx';
  if (status >= 200) return '2xx';
  return 'other';
};

const formatDateTime = (dateStr?: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatVideoDuration = (seconds: number) => {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const getBugLifecycleItems = (testCase: TestCase) => [
  {
    key: 'reported',
    label: 'Dilaporkan',
    description: 'Bug tercatat dari testcase yang gagal.',
    date: testCase.reportedAt || testCase.createdAt,
    status: 'SUDAH DILAPORKAN',
  },
  {
    key: 'fixing',
    label: 'Sedang Di Fix',
    description: 'Bug mulai masuk proses perbaikan.',
    date: testCase.fixingAt,
    status: 'SEDANG DI FIX',
  },
  {
    key: 'ready',
    label: 'Ready to Retest',
    description: 'Bug dikembalikan ke QA untuk retest.',
    date: testCase.readyAt,
    status: 'READY TO RETEST',
  },
  {
    key: 'fixed',
    label: 'Verified & Fixed',
    description: 'Retest berhasil dari halaman Test Case.',
    date: testCase.fixedAt,
    status: 'VERIFIED & FIXED',
  },
];

const getLifecycleIndex = (status: string) => {
  switch (status) {
    case 'SUDAH DILAPORKAN': return 0;
    case 'SEDANG DI FIX': return 1;
    case 'READY TO RETEST': return 2;
    case 'VERIFIED & FIXED': return 3;
    default: return 0;
  }
};

// ─── Video Player ─────────────────────────────────────────────────────────────
interface VideoPlayerProps {
  src: string;
  targetUrl?: string;
  compact?: boolean;
  onClose?: () => void;
}

function VideoPlayer({ src, targetUrl, compact = true, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(!compact);
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
  }, [isPlaying]);

  useEffect(() => {
    return () => { if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = Number(e.target.value);
    videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-black">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-black/80 px-5 backdrop-blur">
          <div className="flex items-center gap-3">
            <Film className="h-4 w-4 text-indigo-300" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-200">Screen Recording</p>
            <Badge variant="outline" className="rounded-md border-indigo-400/30 bg-indigo-950 text-[10px] font-bold text-indigo-200">
              {formatVideoDuration(currentTime)} / {formatVideoDuration(duration)}
            </Badge>
          </div>
          {targetUrl && <p className="hidden truncate text-[11px] text-slate-500 sm:block max-w-lg">{targetUrl}</p>}
          <Button type="button" variant="ghost" size="sm"
            className="h-9 w-9 rounded-full border border-white/10 bg-white/5 p-0 text-slate-300 hover:bg-white hover:text-slate-950"
            onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
          onMouseMove={resetControlsTimer} onClick={togglePlay}>
          <video ref={videoRef} src={src} className="max-h-full max-w-full object-contain"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/50 backdrop-blur">
              {isPlaying ? <Pause className="h-8 w-8 text-white" /> : <Play className="h-8 w-8 translate-x-0.5 text-white" />}
            </div>
          </div>
        </div>

        <div className={`shrink-0 border-t border-white/10 bg-black/90 px-5 py-3 backdrop-blur transition-opacity duration-300 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
          onMouseMove={resetControlsTimer}>
          <div className="mb-3 flex items-center gap-3">
            <span className="min-w-[36px] text-right text-[10px] font-bold text-slate-400">{formatVideoDuration(currentTime)}</span>
            <div className="relative flex-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <input type="range" min="0" max={duration || 0} step="0.05" value={currentTime}
                onChange={handleSeek} onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </div>
            <span className="min-w-[36px] text-[10px] font-bold text-slate-400">{formatVideoDuration(duration)}</span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white"
              onClick={(e) => { e.stopPropagation(); skip(-10); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-10 w-10 rounded-full bg-white/10 p-0 text-white hover:bg-white/20"
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white"
              onClick={(e) => { e.stopPropagation(); skip(10); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-4">
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>
            <div className="ml-auto">
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                onClick={(e) => { e.stopPropagation(); onClose?.(); }}>
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="relative bg-black group cursor-pointer" style={{ aspectRatio: '16/9' }}
        onClick={togglePlay} onMouseMove={resetControlsTimer}>
        <video ref={videoRef} src={src} className="h-full w-full object-contain"
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />
        <div className={`absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/70 via-transparent to-black/20 p-3 transition-opacity duration-200 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="h-3.5 w-3.5 text-indigo-300" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Screen Recording</span>
              <Badge variant="outline" className="rounded border-indigo-400/30 bg-indigo-950/70 text-[9px] font-bold text-indigo-200">VIDEO</Badge>
            </div>
            <Button type="button" variant="ghost" size="sm"
              className="h-7 w-7 rounded-md bg-black/40 p-0 text-white/70 hover:bg-black/60 hover:text-white"
              onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur ring-2 ring-white/20">
              {isPlaying ? <Pause className="h-6 w-6 text-white" /> : <Play className="h-6 w-6 translate-x-0.5 text-white" />}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-white/60">{formatVideoDuration(currentTime)}</span>
              <div className="relative flex-1">
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/30">
                  <div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <input type="range" min="0" max={duration || 0} step="0.05" value={currentTime}
                  onChange={handleSeek} onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              </div>
              <span className="text-[9px] font-bold text-white/60">{formatVideoDuration(duration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/60 hover:text-white"
                onClick={(e) => { e.stopPropagation(); skip(-10); }}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/60 hover:text-white"
                onClick={(e) => { e.stopPropagation(); skip(10); }}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-white/60 hover:text-white"
                onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
                {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </Button>
              {targetUrl && <span className="ml-auto truncate text-[9px] text-white/40 max-w-[200px]">{targetUrl}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Frame Player ─────────────────────────────────────────────────────────────
interface ManualRecordingFrame {
  file: string;
  url: string;
  relativeMs: number;
}

interface FramePlayerProps {
  frames: ManualRecordingFrame[];
  targetUrl?: string | null;
  actionLogs?: LogEntry[];
  onFullscreen?: () => void;
}

function FramePlayer({ frames, targetUrl, actionLogs = [], onFullscreen }: FramePlayerProps) {
  const [seekMs, setSeekMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalMs = frames.length > 0 ? frames[frames.length - 1].relativeMs : 0;
  const frameIntervalMs = frames.length > 1
    ? Math.round((frames[frames.length - 1].relativeMs - frames[0].relativeMs) / (frames.length - 1))
    : 200;

  const selectedFrame = useMemo(() => {
    if (!frames.length) return null;
    return frames.reduce((closest, frame) =>
      Math.abs(frame.relativeMs - seekMs) < Math.abs(closest.relativeMs - seekMs) ? frame : closest, frames[0]);
  }, [frames, seekMs]);

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const actionTimestamps = useMemo(() =>
    actionLogs
      .filter((log) => typeof log.relativeMs === 'number')
      .map((log) => ({
        relativeMs: log.relativeMs as number,
        label: log.detailStep?.label || log.detailStep?.action || 'Action',
        action: log.detailStep?.action,
      })),
    [actionLogs]
  );

  const progress = totalMs > 0 ? (seekMs / totalMs) * 100 : 0;

  useEffect(() => {
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    if (!isPlaying) return;
    const tickMs = Math.max(50, frameIntervalMs / playbackSpeed);
    playIntervalRef.current = setInterval(() => {
      setSeekMs((prev) => {
        const next = prev + frameIntervalMs;
        if (next >= totalMs) { setIsPlaying(false); return totalMs; }
        return next;
      });
    }, tickMs);
    return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
  }, [isPlaying, frameIntervalMs, playbackSpeed, totalMs]);

  const handleSeek = (val: number) => { setIsPlaying(false); setSeekMs(val); };
  const togglePlay = () => {
    if (!isPlaying && seekMs >= totalMs) setSeekMs(0);
    setIsPlaying((p) => !p);
  };
  const skipToAction = (ms: number) => { setIsPlaying(false); setSeekMs(ms); };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="relative bg-black cursor-pointer" style={{ aspectRatio: '16/9' }} onClick={togglePlay}>
        {selectedFrame ? (
          <img src={`http://127.0.0.1:3001${selectedFrame.url}`} alt="Recording frame"
            className="h-full w-full object-contain select-none" draggable={false} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">
            <Film className="h-8 w-8 opacity-20" />
          </div>
        )}
        <div className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur ring-2 ring-white/20">
            {isPlaying ? <Pause className="h-6 w-6 text-white" /> : <Play className="h-6 w-6 translate-x-0.5 text-white" />}
          </div>
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-3">
          <div className="flex items-center gap-2">
            <Film className="h-3.5 w-3.5 text-indigo-300" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Screen Recording</span>
            <Badge variant="outline" className="rounded border-indigo-400/30 bg-indigo-950/70 text-[9px] font-bold text-indigo-200">
              {frames.length} FRAMES
            </Badge>
          </div>
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Badge variant="outline" className="rounded border-slate-600 bg-slate-900/70 text-[9px] font-bold text-slate-300">
              {formatMs(seekMs)}
            </Badge>
            {onFullscreen && (
              <Button type="button" variant="ghost" size="sm"
                className="h-7 w-7 rounded-md bg-black/40 p-0 text-white/70 hover:bg-black/60 hover:text-white"
                onClick={onFullscreen}>
                <Maximize2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        {targetUrl && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-4">
            <p className="truncate text-[9px] text-white/40">{targetUrl}</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
        <div className="space-y-1.5">
          <div className="relative h-5">
            <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            {actionTimestamps.map((action, i) => {
              const pct = totalMs > 0 ? (action.relativeMs / totalMs) * 100 : 0;
              const isActive = selectedFrame && Math.abs(action.relativeMs - seekMs) < 500;
              return (
                <button key={i} type="button" title={`${action.label} @ ${formatMs(action.relativeMs)}`}
                  className={`absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm transition-all ${action.action === 'click'
                    ? isActive ? 'bg-rose-500 scale-125' : 'bg-rose-400/80 hover:bg-rose-500'
                    : isActive ? 'bg-emerald-500 scale-125' : 'bg-emerald-400/80 hover:bg-emerald-500'
                    }`}
                  style={{ left: `${pct}%` }}
                  onClick={() => skipToAction(action.relativeMs)} />
              );
            })}
            <input type="range" min="0" max={totalMs || 0} step="100" value={seekMs}
              onChange={(e) => handleSeek(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400">{formatMs(seekMs)}</span>
            <span className="text-[9px] font-bold text-slate-400">{formatMs(totalMs)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm"
            className="h-8 w-8 rounded-full border-slate-300 p-0 text-slate-700 hover:bg-slate-100"
            onClick={togglePlay}>
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700"
            onClick={() => handleSeek(0)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-700"
            onClick={() => handleSeek(totalMs)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Speed</span>
            {[0.5, 1, 2, 4].map((s) => (
              <button key={s} type="button" onClick={() => setPlaybackSpeed(s)}
                className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition-all ${playbackSpeed === s ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                {s}x
              </button>
            ))}
          </div>
        </div>

        {actionTimestamps.length > 0 && (
          <div className="space-y-1">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Actions ({actionTimestamps.length})</p>
            <div ref={timelineRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {actionTimestamps.map((action, i) => {
                const isActive = Math.abs(action.relativeMs - seekMs) < 500;
                return (
                  <button key={i} type="button" onClick={() => skipToAction(action.relativeMs)}
                    className={`shrink-0 flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold transition-all ${isActive
                      ? 'border-indigo-500/40 bg-indigo-950 text-indigo-200'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
                    {action.action === 'click' ? <MousePointerClick className="h-2.5 w-2.5" /> : <Keyboard className="h-2.5 w-2.5" />}
                    <span className="max-w-[80px] truncate">{action.label}</span>
                    <span className="opacity-60">{formatMs(action.relativeMs)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {frames
            .filter((_, i) => i % Math.max(1, Math.floor(frames.length / 10)) === 0)
            .slice(0, 10)
            .map((frame) => {
              const isActive = selectedFrame?.file === frame.file;
              return (
                <button key={frame.file} type="button" onClick={() => setSeekMs(frame.relativeMs)}
                  className={`shrink-0 rounded border text-[9px] font-bold px-1.5 py-0.5 transition-all ${isActive ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}>
                  {formatMs(frame.relativeMs)}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Props ───────────────────────────────────────────────────────────────
interface TestCaseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewTestCase: TestCase | null;
  socketReady: boolean;
  liveLogs: LogEntry[];
  activeDevLogTab: DevLogTab;
  expandedLogId: string | null;
  isLoadingHistory: boolean;
  loadedRunLabel: 'current' | 'previous' | 'live';
  aiSummary: string | null;
  isSummarizing: boolean;
  manualCaptureTargetUrl: string;
  manualCaptureSessionId: string | null;
  manualRecording: ManualRecordingMeta | null;
  isManualCaptureActive: boolean;
  isStartingManualCapture: boolean;
  isStoppingManualCapture: boolean;
  logEndRef: React.RefObject<HTMLDivElement | null>;
  setManualCaptureTargetUrl: (url: string) => void;
  setActiveDevLogTab: (tab: DevLogTab) => void;
  setExpandedLogId: (id: string | null) => void;
  setAiSummary: (summary: string | null) => void;
  clearLogs: () => void;
  startManualCapture: () => void;
  stopManualCapture: () => void;
  loadCurrentLogRun: () => void;
  generateAISummary: () => void;
  loadLogHistory: () => void;
  filterConsoleLogs: (logs: LogEntry[]) => LogEntry[];
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getTestTypeColor: (type: string) => string;
  getPriorityColor: (priority: string) => string;
  onEdit: (testCase: TestCase) => void;
  onRefine?: (testCase: TestCase) => void;
  onCopyId: (id: string) => void;
}

export function TestCaseDetailDialog({
  open, onOpenChange, viewTestCase, socketReady, liveLogs, activeDevLogTab, expandedLogId,
  isLoadingHistory, loadedRunLabel, aiSummary, isSummarizing, manualCaptureTargetUrl,
  manualCaptureSessionId, manualRecording, isManualCaptureActive, isStartingManualCapture,
  isStoppingManualCapture, logEndRef, setManualCaptureTargetUrl, setActiveDevLogTab,
  setExpandedLogId, setAiSummary, clearLogs, startManualCapture, stopManualCapture,
  loadCurrentLogRun, generateAISummary, loadLogHistory, filterConsoleLogs,
  getStatusColor, getStatusIcon, getTestTypeColor, getPriorityColor, onEdit, onRefine, onCopyId,
}: TestCaseDetailDialogProps) {
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const [networkFilters, setNetworkFilters] = useState<NetworkFilterState>(DEFAULT_NETWORK_FILTERS);
  const [detailStepEdits, setDetailStepEdits] = useState<Record<string, Partial<DetailStepData>>>({});
  const [deletedDetailStepKeys, setDeletedDetailStepKeys] = useState<Set<string>>(() => new Set());
  const [detailStepOrder, setDetailStepOrder] = useState<string[]>([]);
  const [editingDetailStepKey, setEditingDetailStepKey] = useState<string | null>(null);
  const [draggingDetailStepKey, setDraggingDetailStepKey] = useState<string | null>(null);

  const consoleLogs = useMemo(() => filterConsoleLogs(liveLogs), [filterConsoleLogs, liveLogs]);
  const detailStepLogs = useMemo(() => liveLogs.filter((log) => log.isDetailStep || Boolean(log.detailStep)), [liveLogs]);
  const baseDetailStepRows = useMemo<DetailStepLog[]>(() => (
    detailStepLogs
      .filter((log): log is LogEntry & { detailStep: DetailStepData } => Boolean(log.detailStep))
      .map((log, index) => {
        const detailStepKey = getDetailStepKey(log, index);
        return { ...log, detailStepKey, detailStep: { ...log.detailStep, ...(detailStepEdits[detailStepKey] || {}) } };
      })
      .filter((log) => !deletedDetailStepKeys.has(log.detailStepKey))
  ), [deletedDetailStepKeys, detailStepEdits, detailStepLogs]);

  const detailStepRows = useMemo(() => {
    const orderIndex = new Map(detailStepOrder.map((key, index) => [key, index]));
    return [...baseDetailStepRows].sort((a, b) => {
      const aIndex = orderIndex.get(a.detailStepKey);
      const bIndex = orderIndex.get(b.detailStepKey);
      if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
      if (aIndex !== undefined) return -1;
      if (bIndex !== undefined) return 1;
      return 0;
    });
  }, [baseDetailStepRows, detailStepOrder]);

  const rawNetworkLogs = useMemo(() => liveLogs.filter((log) => log.isNetwork || Boolean(log.network)), [liveLogs]);
  const networkLogItems = useMemo(() => (
    rawNetworkLogs
      .filter((log): log is LogEntry & { network: NonNullable<LogEntry['network']> } => Boolean(log.network))
      .map((log) => ({ log, meta: getNetworkMeta(log.network) }))
  ), [rawNetworkLogs]);
  const networkHosts = useMemo(() => Array.from(new Set(networkLogItems.map((item) => item.meta.host))).filter(Boolean).sort(), [networkLogItems]);
  const networkMethods = useMemo(() => Array.from(new Set(networkLogItems.map((item) => item.meta.method))).filter(Boolean).sort(), [networkLogItems]);
  const networkCategoryCounts = useMemo(() => (
    networkLogItems.reduce<Record<NetworkCategory, number>>((counts, item) => {
      counts[item.meta.category] += 1;
      return counts;
    }, { business: 0, preflight: 0, static: 0, telemetry: 0, data: 0, other: 0 })
  ), [networkLogItems]);
  const networkLogs = useMemo(() => {
    const query = networkFilters.search.trim().toLowerCase();
    return networkLogItems.filter(({ log, meta }) => {
      const statusBucket = getStatusBucket(log.network.status);
      const categoryVisible = meta.isError || meta.category === 'business' ||
        (meta.category === 'preflight' && networkFilters.showPreflight) ||
        (meta.category === 'static' && networkFilters.showStatic) ||
        (meta.category === 'telemetry' && networkFilters.showTelemetry) ||
        (meta.category === 'data' && networkFilters.showDataUrls) ||
        (meta.category === 'other' && networkFilters.showOther);
      if (!categoryVisible) return false;
      if (networkFilters.host !== 'all' && meta.host !== networkFilters.host) return false;
      if (networkFilters.method !== 'all' && meta.method !== networkFilters.method) return false;
      if (networkFilters.status !== 'all' && statusBucket !== networkFilters.status) return false;
      if (!query) return true;
      return log.network.url.toLowerCase().includes(query) ||
        meta.host.toLowerCase().includes(query) ||
        meta.method.toLowerCase().includes(query) ||
        String(log.network.status ?? '').includes(query);
    });
  }, [networkFilters, networkLogItems]);
  const hiddenNetworkCount = Math.max(0, networkLogItems.length - networkLogs.length);

  const unifiedTimeline = useMemo<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];
    for (const log of detailStepRows) {
      events.push({ kind: 'step', log, relativeMs: log.relativeMs ?? 0 });
    }
    for (const { log, meta } of networkLogItems) {
      const isRelevant = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(meta.method) || meta.isError || meta.category === 'business';
      if (!isRelevant) continue;
      events.push({ kind: 'network', log: log as LogEntry & { network: NonNullable<LogEntry['network']> }, meta, relativeMs: log.relativeMs ?? 0 });
    }
    return events.sort((a, b) => a.relativeMs - b.relativeMs);
  }, [detailStepRows, networkLogItems]);

  const isBugFixDetail = viewTestCase?.detailSource === 'bugfix' || Boolean(viewTestCase?.sourceTestCaseId && viewTestCase?.reportedAt);
  const lifecycleItems = useMemo(() => viewTestCase ? getBugLifecycleItems(viewTestCase) : [], [viewTestCase]);
  const lifecycleIndex = viewTestCase ? getLifecycleIndex(viewTestCase.status) : 0;
  const okLogCount = useMemo(() => liveLogs.filter((log) => !log.network && log.level !== 'SEVERE').length, [liveLogs]);
  const errorLogCount = useMemo(() => liveLogs.filter((log) => log.level === 'SEVERE').length, [liveLogs]);
  const captureScriptUrl = typeof window !== 'undefined' ? `${window.location.origin}/qa-capture.js` : '/qa-capture.js';
  const captureScriptTag = `<script defer src="${captureScriptUrl}"></script>`;
  const videoSrc = manualRecording?.videoUrl ?? null;
  const hasFrames = (manualRecording?.frames?.length ?? 0) > 0;
  const hasRecording = videoSrc !== null || hasFrames;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDetailStepEdits({});
      setDeletedDetailStepKeys(new Set());
      setDetailStepOrder([]);
      setEditingDetailStepKey(null);
      setDraggingDetailStepKey(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [viewTestCase?.id, loadedRunLabel]);

  useEffect(() => {
    if (liveLogs.length > 0) return;
    const timer = window.setTimeout(() => {
      setDetailStepEdits({});
      setDeletedDetailStepKeys(new Set());
      setDetailStepOrder([]);
      setEditingDetailStepKey(null);
      setDraggingDetailStepKey(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [liveLogs.length]);

  const formatRelativeTime = (relativeMs?: number) => {
    if (typeof relativeMs !== 'number') return '-';
    const safeMs = Math.max(0, Math.round(relativeMs));
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const getNetworkMethod = (network: NonNullable<LogEntry['network']>) => network.method || network.event || 'TRACE';
  const getNetworkStatus = (network: NonNullable<LogEntry['network']>) => {
    if (typeof network.status === 'number') return String(network.status);
    if (network.event === 'Request') return 'REQ';
    if (network.event === 'Response') return 'RES';
    return '-';
  };
  const getNetworkStatusClass = (network: NonNullable<LogEntry['network']>) => {
    if (typeof network.status !== 'number') return 'bg-slate-800 text-slate-400';
    return network.status < 400 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400';
  };
  const getNetworkDuration = (network: NonNullable<LogEntry['network']>) =>
    typeof network.duration === 'number' ? `${network.duration}ms` : '-';
  const getDetailStepTitle = (log: LogEntry) => {
    const step = log.detailStep;
    if (!step) return String(log.log ?? 'Manual step');
    const action = step.action === 'input' ? 'Input text' : step.action === 'change' ? 'Change value' : 'Click';
    return `${action}${step.label ? `: ${step.label}` : ''}`;
  };
  const getDetailStepIcon = (action?: string) => (
    action === 'input' || action === 'change' ? <Keyboard className="h-3.5 w-3.5" /> : <MousePointerClick className="h-3.5 w-3.5" />
  );
  const updateDetailStep = (key: string, patch: Partial<DetailStepData>) => {
    setDetailStepEdits((current) => ({ ...current, [key]: { ...(current[key] || {}), ...patch } }));
  };
  const deleteDetailStep = (key: string) => {
    setDeletedDetailStepKeys((current) => { const next = new Set(current); next.add(key); return next; });
    setDetailStepOrder((current) => current.filter((item) => item !== key));
    if (expandedLogId === key) setExpandedLogId(null);
    if (editingDetailStepKey === key) setEditingDetailStepKey(null);
  };
  const handleDetailStepDrop = (targetKey: string) => {
    if (!draggingDetailStepKey) return;
    const visibleKeys = detailStepRows.map((log) => log.detailStepKey);
    setDetailStepOrder(moveKeyBefore(visibleKeys, draggingDetailStepKey, targetKey));
    setDraggingDetailStepKey(null);
  };
  const updateNetworkFilters = (nextFilters: Partial<NetworkFilterState>) => {
    setNetworkFilters((current) => ({ ...current, ...nextFilters }));
  };
  const toggleNetworkFilter = (key: keyof Pick<NetworkFilterState, 'showPreflight' | 'showStatic' | 'showTelemetry' | 'showDataUrls' | 'showOther'>) => {
    setNetworkFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <>
      {isVideoFullscreen && videoSrc && (
        <VideoPlayer src={videoSrc} targetUrl={manualRecording?.targetUrl} compact={false}
          onClose={() => setIsVideoFullscreen(false)} />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="w-5 h-5 text-indigo-600" />
              Detail Test Case
              {viewTestCase && (
                <Badge variant="outline" className={`gap-1 ml-2 ${getStatusColor(viewTestCase.status)}`}>
                  {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detail test case dan automation devlogs untuk hasil eksekusi Katalon.
            </DialogDescription>
          </DialogHeader>

          {viewTestCase && (
            <div className="flex-1 overflow-y-auto outline-none">
              <div className="p-6 pt-2">
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className={`grid w-full ${isBugFixDetail ? 'grid-cols-3' : 'grid-cols-2'} mb-6 bg-slate-100 p-1`}>
                    <TabsTrigger value="details" className="gap-2">
                      <ClipboardList className="w-4 h-4" /> Informasi Utama
                    </TabsTrigger>
                    {isBugFixDetail && (
                      <TabsTrigger value="lifecycle" className="gap-2">
                        <History className="w-4 h-4" /> Lifecycle
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="logs" className="gap-2">
                      <div className="relative">
                        <Wrench className="w-4 h-4" />
                        {socketReady && (
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                      </div>
                      Automation DevLogs
                    </TabsTrigger>
                  </TabsList>

                  {/* ── DETAILS TAB ── */}
                  <TabsContent value="details" className="space-y-6 mt-0 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Identification</p>
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Test Case ID (Display)</p>
                              <p className="font-mono font-bold text-base text-slate-800">{viewTestCase.testCaseId}</p>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-xs text-muted-foreground">Internal Database ID (UUID)</p>
                                <Badge variant="secondary" className="text-[9px] h-3.5 px-1 bg-indigo-50 text-indigo-600 border-0">Required for Logs</Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="font-mono text-[11px] text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 truncate flex-1 shadow-sm">
                                  {viewTestCase.id}
                                </p>
                                <Button variant="outline" size="sm" className="h-7 w-7 p-0 hover:bg-indigo-50 hover:text-indigo-600 border-slate-200"
                                  onClick={() => onCopyId(viewTestCase.id)}>
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Classification</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Page / Menu</p>
                              <p className="font-bold text-slate-700">{viewTestCase.page}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Sub Menu</p>
                              <p className="text-sm font-medium">{viewTestCase.subMenu || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Tipe Test</p>
                              <Badge variant="outline" className={getTestTypeColor(viewTestCase.testType)}>{viewTestCase.testType}</Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Prioritas</p>
                              <Badge className={getPriorityColor(viewTestCase.priority)}>{viewTestCase.priority}</Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Project Tracking</p>
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Module</p>
                              <div className="flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-semibold text-slate-700">{viewTestCase.module?.name || 'Tanpa Module'}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Bobot Transaksi</p>
                                <Badge variant="secondary" className="font-mono text-indigo-600 bg-indigo-50 border-indigo-100">
                                  {viewTestCase.calculatedWeight != null ? `${viewTestCase.calculatedWeight.toFixed(2)}%` : (viewTestCase.weight || '-')}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Progress</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={viewTestCase.progress} className="h-2 flex-1" />
                                  <span className="text-xs font-bold text-slate-600">{viewTestCase.progress}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Test Status</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Actual Result</p>
                              <Badge className={viewTestCase.actualResult === 'As Expected' ? 'bg-emerald-100 text-emerald-800' : viewTestCase.actualResult === 'Not As Expected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                                {viewTestCase.actualResult || 'BELUM DI-TEST'}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Terakhir Diupdate</p>
                              <p className="text-[10px] font-medium text-slate-500">
                                {new Date(viewTestCase.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-6" />

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test Action</Label>
                        <div className="text-sm bg-white border border-slate-200 p-4 rounded-xl shadow-sm text-slate-700 leading-relaxed italic">
                          "{viewTestCase.testAction}"
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expected Result</Label>
                        <div className="text-sm bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl text-emerald-900 font-semibold leading-relaxed min-h-[120px]">
                          {viewTestCase.expectedResult}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remarks / Catatan</Label>
                        <div className="min-h-[72px] whitespace-pre-wrap rounded-xl border border-amber-100 bg-amber-50/50 p-4 text-sm italic text-amber-800">
                          {viewTestCase.remarks?.trim() || '-'}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── LIFECYCLE TAB ── */}
                  {isBugFixDetail && (
                    <TabsContent value="lifecycle" className="space-y-6 mt-0 outline-none">
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bug Lifecycle</p>
                            <h3 className="mt-1 text-lg font-bold text-slate-800">{viewTestCase.testCaseId}</h3>
                            <p className="mt-1 max-w-2xl text-sm text-slate-500">
                              Perjalanan bug dari laporan awal sampai verified fixed. Status maksimal dari halaman BugFix adalah Ready to Retest; Verified & Fixed terjadi setelah retest berhasil dari halaman Test Case.
                            </p>
                          </div>
                          <Badge variant="outline" className={`gap-1 ${getStatusColor(viewTestCase.status)}`}>
                            {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
                          </Badge>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-4">
                          {lifecycleItems.map((item, index) => {
                            const isDone = index <= lifecycleIndex && Boolean(item.date);
                            const isCurrent = index === lifecycleIndex && viewTestCase.status !== 'VERIFIED & FIXED';
                            return (
                              <div key={item.key}
                                className={`rounded-md border p-3 ${isDone ? 'border-emerald-200 bg-emerald-50/70' : isCurrent ? 'border-cyan-200 bg-cyan-50/70' : 'border-slate-200 bg-slate-50/70'}`}>
                                <div className="mb-2 flex items-center gap-2">
                                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${isDone ? 'bg-emerald-600 text-white' : isCurrent ? 'bg-cyan-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                  </div>
                                  <p className="text-sm font-bold text-slate-800">{item.label}</p>
                                </div>
                                <p className="min-h-[36px] text-xs leading-relaxed text-slate-500">{item.description}</p>
                                <p className="mt-3 text-xs font-semibold text-slate-700">{formatDateTime(item.date)}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Bug Source</p>
                          <div className="mt-3 space-y-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Original Test Case ID</p>
                              <p className="font-mono font-bold text-slate-800">{viewTestCase.sourceTestCaseId || viewTestCase.id}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Actual Result</p>
                              <p className="font-semibold text-red-700">{viewTestCase.actualResult || 'Not As Expected'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status Timing</p>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Reported</p>
                              <p className="font-medium text-slate-700">{formatDateTime(viewTestCase.reportedAt || viewTestCase.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Updated</p>
                              <p className="font-medium text-slate-700">{formatDateTime(viewTestCase.updatedAt)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Ready Retest</p>
                              <p className="font-medium text-slate-700">{formatDateTime(viewTestCase.readyAt)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Fixed</p>
                              <p className="font-medium text-slate-700">{formatDateTime(viewTestCase.fixedAt)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  )}

                  {/* ── LOGS TAB ── */}
                  <TabsContent value="logs" className="mt-0 outline-none">
                    <div className="flex flex-col gap-4">

                      {/* Manual Capture bar */}
                      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Play className="h-4 w-4 text-teal-700" />
                              <p className="text-xs font-black uppercase tracking-widest text-slate-600">Manual Capture</p>
                              <Badge variant="outline" className={`rounded-md text-[10px] font-bold shadow-none ${socketReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                {socketReady ? '● Relay Live' : '○ Relay Offline'}
                              </Badge>
                              {isManualCaptureActive && (
                                <Badge className="rounded-md bg-teal-100 text-[10px] font-bold text-teal-800 shadow-none animate-pulse">
                                  ● REC {manualCaptureSessionId?.slice(0, 14)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input value={manualCaptureTargetUrl} onChange={(e) => setManualCaptureTargetUrl(e.target.value)}
                                placeholder="https://target-app.example/path" disabled={isManualCaptureActive}
                                className="h-9 rounded-md border-slate-200 text-xs font-mono" />
                              {isManualCaptureActive ? (
                                <Button type="button" variant="outline" size="sm"
                                  className="h-9 shrink-0 gap-1.5 rounded-md border-rose-200 text-rose-700 hover:bg-rose-50"
                                  onClick={stopManualCapture} disabled={isStoppingManualCapture}>
                                  {isStoppingManualCapture ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                                  Stop
                                </Button>
                              ) : (
                                <Button type="button" size="sm"
                                  className="h-9 shrink-0 gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800"
                                  onClick={startManualCapture} disabled={!manualCaptureTargetUrl.trim() || isStartingManualCapture}>
                                  {isStartingManualCapture ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                  Start
                                </Button>
                              )}
                            </div>
                          </div>
                          <Button type="button" variant="outline" size="sm"
                            className="h-9 shrink-0 gap-1.5 rounded-md border-slate-200 text-xs"
                            onClick={() => navigator.clipboard.writeText(captureScriptTag)}>
                            <Code2 className="h-3.5 w-3.5" /> Copy Script
                          </Button>
                        </div>
                      </div>

                      {/* Split layout */}
                      <div className="flex gap-4" style={{ minHeight: '520px' }}>

                        {/* LEFT PANEL: Recording */}
                        <div className="w-[340px] shrink-0 flex flex-col gap-3">
                          {hasRecording ? (
                            <>
                              {videoSrc ? (
                                <>
                                  <VideoPlayer src={videoSrc} targetUrl={manualRecording?.targetUrl} compact={true}
                                    onClose={() => setIsVideoFullscreen(false)} />
                                  <Button type="button" variant="outline" size="sm"
                                    className="h-7 gap-1.5 rounded-md border-slate-200 px-2 text-[10px] font-bold text-slate-600 hover:text-indigo-600"
                                    onClick={() => setIsVideoFullscreen(true)}>
                                    <Maximize2 className="h-3 w-3" /> Buka Fullscreen
                                  </Button>
                                </>
                              ) : hasFrames ? (
                                <FramePlayer frames={manualRecording!.frames} targetUrl={manualRecording?.targetUrl}
                                  actionLogs={detailStepRows} />
                              ) : null}
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400" style={{ aspectRatio: '16/9' }}>
                              <Film className="h-10 w-10 mb-2 opacity-20" />
                              <p className="text-[10px] font-bold uppercase tracking-wider">Belum ada recording</p>
                              <p className="text-[9px] text-slate-300 mt-1">Start capture untuk merekam</p>
                            </div>
                          )}

                          {manualRecording && (
                            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-1.5">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Session Info</p>
                              <div className="space-y-1 text-[10px]">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Status</span>
                                  <Badge className={`text-[9px] px-1.5 py-0 ${manualRecording.status === 'recording' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {manualRecording.status === 'recording' ? '● Recording' : '✓ Stopped'}
                                  </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Frames</span>
                                  <span className="font-bold text-slate-600">{manualRecording.frames.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Steps</span>
                                  <span className="font-bold text-slate-600">{detailStepRows.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Network</span>
                                  <span className="font-bold text-slate-600">{networkLogs.length}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-lg border border-slate-100 bg-white p-2">
                              <p className="text-base font-black text-slate-700">{detailStepRows.length}</p>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Steps</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-white p-2">
                              <p className="text-base font-black text-emerald-600">{okLogCount}</p>
                              <p className="text-[9px] font-bold uppercase text-slate-400">OK</p>
                            </div>
                            <div className="rounded-lg border border-slate-100 bg-white p-2">
                              <p className="text-base font-black text-rose-600">{errorLogCount}</p>
                              <p className="text-[9px] font-bold uppercase text-slate-400">Errors</p>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT PANEL: DevTools */}
                        <div className="flex flex-1 flex-col min-w-0 bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden font-mono text-[11.5px]">

                          {/* DevTools header */}
                          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2 shrink-0">
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
                                <Wrench className="h-4 w-4 text-emerald-400" />
                              </div>
                              <div>
                                <p className="text-[11px] font-black text-slate-200 leading-tight">Automation DevTools</p>
                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Katalon Browser Sniffer</p>
                              </div>
                              {socketReady && (
                                <div className="ml-2 flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-900 px-2.5 py-1">
                                  <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  </span>
                                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Live</span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm"
                                className={`h-6 px-2 text-[9px] font-bold gap-1 ${isSummarizing ? 'animate-pulse' : ''} text-violet-400 hover:text-violet-300 hover:bg-violet-950/40`}
                                onClick={generateAISummary} disabled={isSummarizing}>
                                <Sparkles className={`h-3 w-3 ${isSummarizing ? 'animate-spin' : ''}`} />
                                AI SUMMARY
                              </Button>
                              <Button variant="ghost" size="sm"
                                className={`h-6 px-2 text-[9px] font-bold ${loadedRunLabel === 'current' || loadedRunLabel === 'live' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'}`}
                                onClick={loadCurrentLogRun} disabled={isLoadingHistory}>
                                CURRENT
                              </Button>
                              <Button variant="ghost" size="sm"
                                className="h-6 px-2 text-[9px] font-bold text-slate-500 hover:text-indigo-400 gap-1"
                                onClick={loadLogHistory} disabled={isLoadingHistory}>
                                {isLoadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <History className="h-3 w-3" />}
                                PREV
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-600 hover:text-rose-400" onClick={clearLogs}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>

                          {/* Tab bar */}
                          <div className="flex items-center border-b border-slate-800 bg-slate-900 shrink-0 overflow-x-auto">
                            {([
                              { id: 'timeline' as const, label: '✦ TIMELINE', count: unifiedTimeline.length },
                              { id: 'execution' as const, label: 'EXECUTION', count: null },
                              { id: 'detail-step' as const, label: 'DETAILED STEPS', count: detailStepRows.length },
                              { id: 'console' as const, label: 'CONSOLE', count: consoleLogs.length },
                              { id: 'network' as const, label: 'NETWORK', count: networkLogs.length },
                            ] as const).map((tab) => (
                              <button key={tab.id} type="button" onClick={() => setActiveDevLogTab(tab.id)}
                                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${activeDevLogTab === tab.id
                                  ? tab.id === 'timeline' ? 'border-indigo-500 bg-indigo-950/30 text-indigo-300' : 'border-slate-300 bg-white/5 text-slate-200'
                                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                                {tab.label}
                                {tab.count !== null && (
                                  <span className={`rounded px-1 py-px text-[9px] font-black ${activeDevLogTab === tab.id ? 'bg-slate-700 text-slate-200' : 'bg-slate-800 text-slate-500'}`}>
                                    {tab.count}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>

                          {/* AI Summary strip */}
                          {aiSummary && (
                            <div className="border-b border-indigo-900/50 bg-indigo-950/30 px-4 py-3 shrink-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] uppercase tracking-wider shrink-0">
                                  <Sparkles className="w-3.5 h-3.5" /> AI Summary
                                </div>
                                <p className="flex-1 text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0 text-indigo-400/50 hover:text-indigo-400" onClick={() => setAiSummary(null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Log content area */}
                          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">

                            {/* TIMELINE */}
                            {activeDevLogTab === 'timeline' && (
                              <div className="divide-y divide-slate-800/30">
                                {unifiedTimeline.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                                    <Play className="w-8 h-8 mb-3 opacity-20" />
                                    <p className="font-bold tracking-widest text-[10px] uppercase">Start Manual Capture untuk merekam timeline</p>
                                  </div>
                                ) : unifiedTimeline.map((event, index) => {
                                  const logId = `timeline-${index}`;
                                  const isExpanded = expandedLogId === logId;

                                  if (event.kind === 'step') {
                                    const step = event.log.detailStep;
                                    const isInput = step.action === 'input' || step.action === 'change';
                                    return (
                                      <div key={logId} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
                                        <span className="mt-0.5 min-w-[36px] text-right text-[10px] font-bold tabular-nums text-slate-600">
                                          {formatRelativeTime(event.relativeMs)}
                                        </span>
                                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isInput ? 'border-cyan-500/25 bg-cyan-950/50 text-cyan-400' : 'border-rose-500/25 bg-rose-950/50 text-rose-400'}`}>
                                          {isInput ? <Keyboard className="h-3 w-3" /> : <MousePointerClick className="h-3 w-3" />}
                                        </span>
                                        <div className="min-w-0 flex-1 py-0.5">
                                          <p className="truncate text-[11px] font-bold text-slate-200">{getDetailStepTitle(event.log)}</p>
                                          {step.value && <p className="mt-0.5 truncate text-[10px] font-medium text-emerald-400">↳ {step.value}</p>}
                                          {(step.selector || step.url) && <p className="mt-0.5 truncate text-[9px] text-slate-600">{step.selector || step.url}</p>}
                                        </div>
                                      </div>
                                    );
                                  }

                                  const net = event.log.network;
                                  const isSuccess = typeof net.status === 'number' && net.status < 400;
                                  return (
                                    <div key={logId} className={`border-l-2 ${isSuccess ? 'border-l-emerald-600/40' : 'border-l-rose-600/60'}`}>
                                      <div
                                        className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors ${isExpanded ? 'bg-white/[0.05]' : isSuccess ? 'hover:bg-emerald-950/10' : 'bg-rose-950/10 hover:bg-rose-950/20'}`}
                                        onClick={() => setExpandedLogId(isExpanded ? null : logId)}>
                                        <span className="mt-0.5 min-w-[36px] text-right text-[10px] font-bold tabular-nums text-slate-600">
                                          {formatRelativeTime(event.relativeMs)}
                                        </span>
                                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-violet-500/25 bg-violet-950/50 text-violet-400">
                                          <RefreshCw className="h-3 w-3" />
                                        </span>
                                        <div className="min-w-0 flex-1 py-0.5">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black text-indigo-400">{event.meta.method}</span>
                                            <span className={`rounded px-1.5 py-px text-[9px] font-bold ${isSuccess ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                                              {net.status ?? '…'}
                                            </span>
                                            {typeof net.duration === 'number' && <span className="text-[9px] text-slate-600">{net.duration}ms</span>}
                                          </div>
                                          <p className="mt-0.5 truncate text-[10px] font-semibold">
                                            <span className="text-slate-500">{event.meta.host}</span>
                                            <span className="text-slate-300">{event.meta.pathname}</span>
                                          </p>
                                        </div>
                                        <ChevronDown className={`mt-1.5 h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      </div>
                                      {isExpanded && (
                                        <div className="mx-4 mb-3 ml-[52px] space-y-2">
                                          <div className="rounded-lg border border-slate-800 bg-slate-900/80 overflow-hidden">
                                            <div className="border-b border-slate-800 px-3 py-1.5">
                                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Request Body</span>
                                            </div>
                                            <pre className="max-h-48 overflow-auto p-3 whitespace-pre-wrap break-all text-[10px] leading-relaxed text-cyan-300/90">
                                              {formatPrettyValue(getRequestPayload(net.data))}
                                            </pre>
                                          </div>
                                          <div className="rounded-lg border border-slate-800 bg-slate-900/80 overflow-hidden">
                                            <div className="border-b border-slate-800 px-3 py-1.5">
                                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Response</span>
                                            </div>
                                            <pre className="max-h-48 overflow-auto p-3 whitespace-pre-wrap break-all text-[10px] leading-relaxed text-emerald-400/80">
                                              {formatPrettyValue(getResponsePayload(net.data))}
                                            </pre>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <div ref={logEndRef} className="h-4" />
                              </div>
                            )}

                            {/* EXECUTION */}
                            {activeDevLogTab === 'execution' && (
                              <div className="p-5 space-y-0.5">
                                {viewTestCase.stepLogs ? (
                                  viewTestCase.stepLogs.split('\n').map((line, index) => {
                                    if (!line.trim()) return null;
                                    const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail');
                                    const isWarning = line.toLowerCase().includes('warn');
                                    const isInfo = line.toLowerCase().includes('info') || line.toLowerCase().includes('step');
                                    return (
                                      <div key={`${index}-${line}`} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded group">
                                        <span className="text-slate-700 select-none min-w-[24px] text-right font-bold opacity-50 group-hover:opacity-100">{index + 1}</span>
                                        <span className={isError ? 'text-rose-400 font-bold' : isWarning ? 'text-amber-400' : isInfo ? 'text-cyan-400' : 'text-emerald-400/90'}>
                                          {line}
                                        </span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                                    <Clock className="w-8 h-8 mb-3 opacity-20" />
                                    <p className="font-bold tracking-widest text-[10px] uppercase">Awaiting Execution Trace...</p>
                                  </div>
                                )}
                                <div ref={logEndRef} className="h-8" />
                              </div>
                            )}

                            {/* DETAIL STEPS */}
                            {activeDevLogTab === 'detail-step' && (
                              <div className="divide-y divide-slate-800/50">
                                {detailStepRows.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                                    <MousePointerClick className="w-8 h-8 mb-3 opacity-20" />
                                    <p className="font-bold tracking-widest text-[10px] uppercase">Awaiting Detailed Steps...</p>
                                  </div>
                                ) : detailStepRows.map((log, index) => {
                                  const step = log.detailStep;
                                  const logId = log.detailStepKey;
                                  const isEditing = editingDetailStepKey === logId;
                                  return (
                                    <div key={logId} draggable
                                      onDragStart={() => setDraggingDetailStepKey(logId)}
                                      onDragEnd={() => setDraggingDetailStepKey(null)}
                                      onDragOver={(e) => e.preventDefault()}
                                      onDrop={() => handleDetailStepDrop(logId)}
                                      className={`group transition-colors ${draggingDetailStepKey === logId ? 'bg-cyan-950/30' : 'hover:bg-white/5'}`}>
                                      <div className="grid w-full grid-cols-12 items-start gap-3 p-3 text-left">
                                        <span className="col-span-1 flex items-center gap-2 text-slate-600">
                                          <GripVertical className="h-4 w-4 cursor-grab" />
                                          <span className="text-[10px] font-bold">{index + 1}</span>
                                        </span>
                                        <span className="col-span-2 text-[10px] font-bold text-slate-500">{formatRelativeTime(log.relativeMs)}</span>
                                        <span className="col-span-1 flex h-7 w-7 items-center justify-center rounded-md border border-cyan-500/20 bg-cyan-950/40 text-cyan-300">
                                          {getDetailStepIcon(step?.action)}
                                        </span>
                                        <div role="button" tabIndex={0} className="col-span-6 min-w-0 text-left cursor-pointer"
                                          onClick={() => setExpandedLogId(expandedLogId === logId ? null : logId)}>
                                          {isEditing ? (
                                            <div className="space-y-2">
                                              <Input value={step.label || ''} onChange={(e) => updateDetailStep(logId, { label: e.target.value })}
                                                placeholder="Step label" className="h-8 border-slate-700 bg-slate-900 text-xs text-slate-100"
                                                onClick={(e) => e.stopPropagation()} />
                                              <Input value={step.value || ''} onChange={(e) => updateDetailStep(logId, { value: e.target.value })}
                                                placeholder="Value" className="h-8 border-slate-700 bg-slate-900 text-xs text-emerald-200"
                                                onClick={(e) => e.stopPropagation()} />
                                            </div>
                                          ) : (
                                            <>
                                              <span className="block truncate text-xs font-bold text-slate-200">{getDetailStepTitle(log)}</span>
                                              {step?.value && <span className="mt-1 block truncate text-[11px] text-emerald-300">Value: {step.value}</span>}
                                              <span className="mt-1 block truncate text-[10px] text-slate-600">{step?.selector || step?.url || '-'}</span>
                                            </>
                                          )}
                                        </div>
                                        <span className="col-span-2 flex justify-end gap-1">
                                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:bg-emerald-950/40 hover:text-emerald-300"
                                            onClick={() => setEditingDetailStepKey(isEditing ? null : logId)}>
                                            {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                                          </Button>
                                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:bg-rose-950/40 hover:text-rose-300"
                                            onClick={() => deleteDetailStep(logId)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:bg-slate-900"
                                            onClick={() => setExpandedLogId(expandedLogId === logId ? null : logId)}>
                                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedLogId === logId ? 'rotate-180' : ''}`} />
                                          </Button>
                                        </span>
                                      </div>
                                      {expandedLogId === logId && (
                                        <div className="px-12 pb-3">
                                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-800 bg-slate-900 p-3 text-[10px] leading-relaxed text-slate-300">
                                            {formatPrettyValue(step || log.log)}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <div ref={logEndRef} className="h-4" />
                              </div>
                            )}

                            {/* CONSOLE */}
                            {activeDevLogTab === 'console' && (
                              <div className="divide-y divide-slate-800/50">
                                {consoleLogs.length === 0 ? (
                                  <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                                    <Clock className="w-8 h-8 mb-3 opacity-20" />
                                    <p className="font-bold tracking-widest text-[10px] uppercase">Awaiting Console Output...</p>
                                  </div>
                                ) : consoleLogs.map((log, index) => {
                                  const logId = log.id ?? `console-${index}`;
                                  const isError = log.level === 'SEVERE' || log.log?.toString().toLowerCase().includes('error');
                                  const isWarning = log.level === 'WARNING' || log.log?.toString().toLowerCase().includes('warn');
                                  return (
                                    <div key={logId} className={`group ${isError ? 'bg-rose-950/20' : isWarning ? 'bg-amber-950/20' : 'hover:bg-white/5'}`}>
                                      <div className="flex items-start gap-3 p-2 cursor-pointer" onClick={() => setExpandedLogId(expandedLogId === logId ? null : logId)}>
                                        <span className="text-slate-600 text-[10px] min-w-[60px] pt-0.5">
                                          {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('id-ID', { hour12: false }) : '-'}
                                        </span>
                                        {typeof log.relativeMs === 'number' && (
                                          <span className="mt-0.5 rounded bg-indigo-950 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">{formatRelativeTime(log.relativeMs)}</span>
                                        )}
                                        <div className="flex-1 break-all">
                                          <span className={isError ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400/90'}>
                                            {typeof log.log === 'object' ? `${JSON.stringify(log.log).substring(0, 200)}...` : String(log.log ?? '')}
                                          </span>
                                        </div>
                                      </div>
                                      {expandedLogId === logId && typeof log.log === 'object' && (
                                        <div className="px-10 pb-3">
                                          <pre className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-emerald-500/80 whitespace-pre-wrap overflow-x-auto text-[10px]">
                                            {JSON.stringify(log.log, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                <div ref={logEndRef} className="h-4" />
                              </div>
                            )}

                            {/* NETWORK */}
                            {activeDevLogTab === 'network' && (
                              <div className="h-full flex flex-col">
                                <div className="space-y-2 border-b border-slate-800 bg-slate-950 p-3 shrink-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="relative min-w-[180px] flex-1">
                                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                                      <Input value={networkFilters.search} onChange={(e) => updateNetworkFilters({ search: e.target.value })}
                                        placeholder="Filter URL, host, status..."
                                        className="h-8 border-slate-800 bg-slate-900 pl-8 text-[11px] text-slate-200 placeholder:text-slate-600" />
                                    </div>
                                    <select value={networkFilters.host} onChange={(e) => updateNetworkFilters({ host: e.target.value })}
                                      className="h-8 min-w-[150px] rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] text-slate-300 outline-none">
                                      <option value="all">All hosts ({networkLogItems.length})</option>
                                      {networkHosts.map((h) => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                    <select value={networkFilters.method} onChange={(e) => updateNetworkFilters({ method: e.target.value })}
                                      className="h-8 rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] text-slate-300 outline-none">
                                      <option value="all">All methods</option>
                                      {networkMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select value={networkFilters.status} onChange={(e) => updateNetworkFilters({ status: e.target.value })}
                                      className="h-8 rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] text-slate-300 outline-none">
                                      <option value="all">All status</option>
                                      <option value="2xx">2xx</option>
                                      <option value="3xx">3xx</option>
                                      <option value="4xx">4xx</option>
                                      <option value="5xx">5xx</option>
                                      <option value="unknown">Unknown</option>
                                    </select>
                                    <Button type="button" variant="ghost" size="sm"
                                      className="h-8 gap-1 px-2 text-[10px] font-bold text-slate-400 hover:text-white"
                                      onClick={() => setNetworkFilters(DEFAULT_NETWORK_FILTERS)}>
                                      <Filter className="h-3 w-3" /> Reset
                                    </Button>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {([
                                      { key: 'showPreflight' as const, label: `OPTIONS ${networkCategoryCounts.preflight}` },
                                      { key: 'showStatic' as const, label: `Static ${networkCategoryCounts.static}` },
                                      { key: 'showTelemetry' as const, label: `Analytics ${networkCategoryCounts.telemetry}` },
                                      { key: 'showDataUrls' as const, label: `Data URL ${networkCategoryCounts.data}` },
                                      { key: 'showOther' as const, label: `Other ${networkCategoryCounts.other}` },
                                    ] as const).map((f) => (
                                      <button key={f.key} type="button" onClick={() => toggleNetworkFilter(f.key)}
                                        className={`rounded-full border px-2.5 py-1 text-[9px] font-bold transition-colors ${networkFilters[f.key] ? 'border-indigo-500/40 bg-indigo-950/60 text-indigo-300' : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'}`}>
                                        {f.label}
                                      </button>
                                    ))}
                                    <span className="ml-auto rounded-full border border-cyan-500/20 bg-cyan-950/40 px-2 py-1 text-[9px] font-bold text-cyan-300">
                                      API {networkCategoryCounts.business}
                                    </span>
                                    {hiddenNetworkCount > 0 && (
                                      <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-1 text-[9px] font-bold text-slate-500">
                                        {hiddenNetworkCount} hidden
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-12 gap-2 border-b border-slate-800 bg-slate-900 p-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
                                  <div className="col-span-1">Method</div>
                                  <div className="col-span-1">Type</div>
                                  <div className="col-span-6">Name</div>
                                  <div className="col-span-2 text-center">Status</div>
                                  <div className="col-span-2 text-right">Time</div>
                                </div>

                                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
                                  {networkLogs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                                      <RefreshCw className="w-8 h-8 mb-3 opacity-20" />
                                      <p className="font-bold tracking-widest text-[10px] uppercase">Waiting for Network Traffic...</p>
                                    </div>
                                  ) : networkLogs.map(({ log: net, meta }, index) => {
                                    const logId = net.id ?? `network-${index}`;
                                    return (
                                      <div key={logId} className="group hover:bg-white/5">
                                        <div className="grid grid-cols-12 gap-2 p-2 cursor-pointer items-center"
                                          onClick={() => setExpandedLogId(expandedLogId === logId ? null : logId)}>
                                          <div className="col-span-1 text-[10px] font-black text-indigo-400 truncate">{getNetworkMethod(net.network)}</div>
                                          <div className="col-span-1">
                                            <span className={`rounded border px-1 py-px text-[9px] font-bold uppercase ${getNetworkCategoryClass(meta.category)}`}>
                                              {meta.label}
                                            </span>
                                          </div>
                                          <div className="col-span-6 min-w-0">
                                            <div className="truncate text-[11px] text-slate-300">{meta.pathname.split('/').pop() || meta.pathname}</div>
                                            <div className="truncate text-[9px] text-slate-600">{meta.host}</div>
                                          </div>
                                          <div className="col-span-2 text-center">
                                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${getNetworkStatusClass(net.network)}`}>
                                              {getNetworkStatus(net.network)}
                                            </span>
                                          </div>
                                          <div className="col-span-2 text-right text-[10px] text-slate-500">
                                            {getNetworkDuration(net.network)}
                                            {typeof net.relativeMs === 'number' && (
                                              <span className="ml-1 text-indigo-400">{formatRelativeTime(net.relativeMs)}</span>
                                            )}
                                          </div>
                                        </div>
                                        {expandedLogId === logId && (
                                          <div className="border-t border-slate-800 bg-slate-900/50 p-4">
                                            <div className="mb-3 rounded border border-slate-800 bg-slate-950/70 p-3">
                                              <p className="mb-1 text-[9px] font-bold uppercase text-slate-500">Full URL</p>
                                              <pre className="whitespace-pre-wrap break-all text-[10px] text-slate-300">{formatNetworkUrlForDisplay(net.network.url)}</pre>
                                            </div>
                                            <div className="grid gap-3 xl:grid-cols-3">
                                              <div>
                                                <p className="mb-1 text-[9px] font-bold uppercase text-slate-500">Headers</p>
                                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-900 p-2 text-[10px] text-slate-400">{formatPrettyValue(net.network.headers)}</pre>
                                              </div>
                                              <div>
                                                <p className="mb-1 text-[9px] font-bold uppercase text-slate-500">Request</p>
                                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-900 p-2 text-[10px] text-cyan-300/90">{formatPrettyValue(getRequestPayload(net.network.data))}</pre>
                                              </div>
                                              <div>
                                                <p className="mb-1 text-[9px] font-bold uppercase text-slate-500">Response</p>
                                                <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-900 p-2 text-[10px] text-emerald-500/80">{formatPrettyValue(getResponsePayload(net.network.data))}</pre>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div ref={logEndRef} className="h-4" />
                                </div>
                              </div>
                            )}

                          </div>{/* end log content area */}

                          {/* DevTools Footer */}
                          <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/80 px-4 py-2 shrink-0">
                            <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{okLogCount} OK</span>
                              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" />{errorLogCount} ERR</span>
                              <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />{networkLogs.length} NET</span>
                            </div>
                            <p className="text-[9px] italic text-slate-600">Auto-scrolling enabled</p>
                          </div>

                        </div>{/* end RIGHT PANEL */}
                      </div>{/* end split layout */}

                      {/* Help tip */}
                      <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                        <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                        <p className="text-[11px] font-medium leading-relaxed text-slate-600">
                          <span className="font-bold text-indigo-600">Timeline</span> menampilkan steps + API secara kronologis.{' '}
                          <span className="font-bold text-indigo-600">Network</span> untuk full traffic dengan filter.{' '}
                          Klik baris untuk expand request/response payload.
                        </p>
                      </div>

                    </div>{/* end flex flex-col gap-4 */}
                  </TabsContent>{/* end logs tab */}

                </Tabs>
              </div>{/* end p-6 pt-2 */}
            </div>{/* end flex-1 overflow-y-auto */}
          )}

          <DialogFooter className="p-6 pt-4 border-t shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 px-6 font-bold border-slate-200">
              Tutup
            </Button>
            {viewTestCase && !isBugFixDetail && onRefine && (
              <Button variant="outline" onClick={() => onRefine(viewTestCase)} className="h-10 px-6 font-bold gap-2 border-violet-200 text-violet-700 hover:bg-violet-50">
                <Sparkles className="w-4 h-4" /> Refine AI
              </Button>
            )}
            {viewTestCase && (
              <Button onClick={() => { onOpenChange(false); onEdit(viewTestCase); }} className="h-10 px-6 font-bold gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100">
                <Edit3 className="w-4 h-4" /> Edit Test Case
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}