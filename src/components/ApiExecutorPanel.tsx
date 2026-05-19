'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Play, Clock, Trash2, ChevronDown, ChevronUp,
    Copy, CheckCircle2, XCircle, Loader2, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface ExecutionLog {
    id: string;
    method: string;
    url: string;
    statusCode: number | null;
    response: string | null;
    duration: number | null;
    createdAt: string;
    headers?: string | null;
    body?: string | null;
}

interface ApiExecutorPanelProps {
    selectedProject: string;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const getStatusColor = (code: number | null) => {
    if (!code) return 'bg-gray-100 text-gray-700';
    if (code < 300) return 'bg-emerald-100 text-emerald-700';
    if (code < 400) return 'bg-blue-100 text-blue-700';
    if (code < 500) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
};

const formatJson = (text: string) => {
    try {
        return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
        return text;
    }
};

export function ApiExecutorPanel({ selectedProject }: ApiExecutorPanelProps) {
    const { toast } = useToast();

    // Request state
    const [method, setMethod] = useState('GET');
    const [url, setUrl] = useState('');
    const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);

    // Response state
    const [response, setResponse] = useState<{
        statusCode: number;
        statusText: string;
        response: string;
        duration: number;
    } | null>(null);
    const [responseTab, setResponseTab] = useState<'body' | 'raw'>('body');

    // History state
    const [history, setHistory] = useState<ExecutionLog[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [expandedHistory, setExpandedHistory] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    // Load history
    const loadHistory = useCallback(async () => {
        if (!selectedProject) return;
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/execute/history?projectId=${selectedProject}`);
            const data = await res.json();
            if (Array.isArray(data)) setHistory(data);
        } catch {
            // silent
        } finally {
            setHistoryLoading(false);
        }
    }, [selectedProject]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    // Execute request
    const handleExecute = async () => {
        if (!url.trim()) {
            toast({ title: 'URL wajib diisi', variant: 'destructive' });
            return;
        }

        setLoading(true);
        setResponse(null);

        try {
            const res = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method,
                    url: url.trim(),
                    headers: headers.trim() || null,
                    body: method !== 'GET' && body.trim() ? body.trim() : null,
                    projectId: selectedProject || null,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setResponse(data);
                setResponseTab('body');
                loadHistory();
            } else {
                toast({
                    title: 'Request gagal',
                    description: data.error || 'Unknown error',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            toast({ title: 'Network error', description: String(err), variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    // Load from history
    const loadFromHistory = (log: ExecutionLog) => {
        setMethod(log.method);
        setUrl(log.url);
        if (log.headers) setHeaders(log.headers);
        if (log.body) setBody(log.body);
        setExpandedHistory(false);
        toast({ title: 'Request dimuat dari history' });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Disalin ke clipboard' });
    };

    return (
        <div className="space-y-6 p-1">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-800">API Executor</h2>
                    <p className="text-sm text-slate-500 mt-0.5">Hit API endpoints dan lihat response langsung</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setExpandedHistory(v => !v); if (!expandedHistory) loadHistory(); }}
                    className="gap-2"
                >
                    <History className="w-4 h-4" />
                    History
                    {history.length > 0 && (
                        <Badge variant="secondary" className="ml-1 text-xs">{history.length}</Badge>
                    )}
                </Button>
            </div>

            {/* History Panel */}
            {expandedHistory && (
                <Card className="border-0 shadow-sm bg-slate-50">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-semibold text-slate-600">
                                50 Request Terakhir
                            </CardTitle>
                            {historyLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        {history.length === 0 ? (
                            <p className="text-sm text-slate-400 py-4 text-center">Belum ada history</p>
                        ) : (
                            <div className="space-y-1 max-h-72 overflow-y-auto">
                                {history.map((log) => (
                                    <div
                                        key={log.id}
                                        className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-100 hover:border-indigo-200 cursor-pointer transition-colors"
                                        onClick={() => loadFromHistory(log)}
                                    >
                                        <Badge className={`text-[10px] font-bold px-1.5 py-0 shrink-0 ${log.method === 'GET' ? 'bg-emerald-100 text-emerald-700' :
                                                log.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                                                    log.method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                                                        log.method === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                            'bg-slate-100 text-slate-700'
                                            }`}>
                                            {log.method}
                                        </Badge>
                                        <span className="text-sm text-slate-700 truncate flex-1 font-mono">{log.url}</span>
                                        <Badge className={`text-[10px] shrink-0 ${getStatusColor(log.statusCode)}`}>
                                            {log.statusCode ?? 'ERR'}
                                        </Badge>
                                        <span className="text-[10px] text-slate-400 shrink-0">
                                            {log.duration}ms
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Request Builder */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-6 space-y-4">

                    {/* Method + URL */}
                    <div className="flex gap-2">
                        <Select value={method} onValueChange={setMethod}>
                            <SelectTrigger className="w-[110px] font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {HTTP_METHODS.map(m => (
                                    <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Input
                            placeholder="https://api.example.com/endpoint"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleExecute()}
                            className="flex-1 font-mono text-sm"
                        />
                        <Button
                            onClick={handleExecute}
                            disabled={loading || !url.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 gap-2 px-6"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            {loading ? 'Sending...' : 'Send'}
                        </Button>
                    </div>

                    {/* Headers */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Headers (JSON)</label>
                        <Textarea
                            value={headers}
                            onChange={e => setHeaders(e.target.value)}
                            className="font-mono text-xs h-24 resize-none bg-slate-50"
                            placeholder={'{\n  "Authorization": "Bearer token"\n}'}
                        />
                    </div>

                    {/* Body — only for non-GET */}
                    {method !== 'GET' && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Body (JSON)</label>
                            <Textarea
                                value={body}
                                onChange={e => setBody(e.target.value)}
                                className="font-mono text-xs h-32 resize-none bg-slate-50"
                                placeholder={'{\n  "key": "value"\n}'}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Response */}
            {response && (
                <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {response.statusCode < 400
                                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    : <XCircle className="w-5 h-5 text-red-500" />
                                }
                                <span className="font-bold text-slate-700">Response</span>
                                <Badge className={`font-bold ${getStatusColor(response.statusCode)}`}>
                                    {response.statusCode} {response.statusText}
                                </Badge>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {response.duration}ms
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                                    <button
                                        onClick={() => setResponseTab('body')}
                                        className={`px-3 py-1 text-xs font-semibold transition-colors ${responseTab === 'body' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Pretty
                                    </button>
                                    <button
                                        onClick={() => setResponseTab('raw')}
                                        className={`px-3 py-1 text-xs font-semibold transition-colors ${responseTab === 'raw' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        Raw
                                    </button>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(response.response)}
                                    className="h-7 px-2"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <pre className="p-4 text-xs font-mono text-slate-700 bg-slate-50 rounded-b-lg overflow-auto max-h-96 whitespace-pre-wrap break-words">
                            {responseTab === 'body'
                                ? formatJson(response.response)
                                : response.response
                            }
                        </pre>
                    </CardContent>
                </Card>
            )}

        </div>
    );
}