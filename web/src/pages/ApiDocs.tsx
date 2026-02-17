import React from 'react';
import { Key, LayoutDashboard, FileText, Shield, Activity, Bug } from 'lucide-react';

export default function ApiDocs() {
    return (
        <div className="page-shell max-w-5xl mx-auto p-4 sm:p-6 lg:p-12 w-full fade-in pb-16 sm:pb-24 lg:pb-32 font-sans relative">
            <div className="text-center mb-16 mt-8">
                <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
                    API 文档
                </h1>
            </div>

            <div className="space-y-16">
                
                <section>
                    <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <FileText size={20} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">公共日志 API</h2>
                    </div>
                    
                    <div className="mb-12">
                        <EndpointBadge method="POST" path="/logs" />
                        <p className="text-zinc-400 mb-6 text-sm leading-relaxed">
                            核心上传端点。用于从后端或客户端上传日志。
                            支持 <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">multipart/form-data</code> (文件上传) 或 <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">application/json</code> (文本内容)。
                        </p>

                        <div className="page-card rounded-xl overflow-hidden mb-8">
                            <div className="bg-black/40 px-4 py-3 border-b border-white/5 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">请求头</span>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-8">
                                    <span className="text-emerald-400 font-mono text-sm w-32 shrink-0">Content-Type</span>
                                    <span className="text-zinc-400 text-sm">multipart/form-data <span className="text-zinc-600">或</span> application/json</span>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-8">
                                    <span className="text-emerald-400 font-mono text-sm w-32 shrink-0">X-Backend-Token</span>
                                    <span className="text-zinc-500 text-sm">可选：后端 Token（将日志关联到您的账户）</span>
                                </div>
                            </div>
                        </div>

                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 pl-1">参数</h3>
                        <div className="page-card rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-sm text-left">
                                    <thead className="bg-black/40 text-zinc-500 font-medium border-b border-white/5">
                                        <tr>
                                            <th className="px-6 py-3 w-32">字段</th>
                                            <th className="px-6 py-3 w-32">类型</th>
                                            <th className="px-6 py-3">描述</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 bg-black/20">
                                        <ParamRow name="file" type="Binary" desc="日志文件 (.log, .gz)。最大 10MB。若 content 缺失则必填。" required={false} />
                                        <ParamRow name="content" type="String" desc="原始文本内容。最大 10MB。若 file 缺失则必填。" required={false} />
                                        <ParamRow name="reason" type="String" desc={<>上传原因：<code className="text-zinc-300">CRASH</code>, <code className="text-zinc-300">SHUTDOWN</code>, <code className="text-zinc-300">MANUAL</code>。默认：MANUAL。</>} />
                                        <ParamRow name="reportName" type="String" desc="自定义报告名称。最大 1024 字符。" />
                                        <ParamRow name="error" type="String" desc="关联的错误堆栈或消息。最大 64KB。" />
                                        <ParamRow name="token" type="String" desc="后端 Token（X-Backend-Token 请求头的替代方案）。" />
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mb-12">
                        <EndpointBadge method="GET" path="/logs/:id" color="blue" />
                        <p className="text-zinc-400 mb-4 text-sm">获取完整日志内容和元数据 (JSON)。使用 <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">?meta=1</code> 仅返回元数据。</p>
                        <CodeBlock code={`{
  "success": true,
  "content": "[12:00:00] Server started...",
  "metadata": {
    "id": "a1b2",
    "uploadTime": "2023-01-01T12:00:00.000Z",
    "reason": "MANUAL",
    "originalName": "server.log",
    "reportName": "My Crash Report",
    "error": "Error: Connection failed"
  }
}`} />
                    </div>

                    <div className="mb-12">
                        <EndpointBadge method="PUT" path="/logs/:id" color="amber" />
                        <p className="text-zinc-400 mb-4 text-sm">更新日志元数据。需要用户认证（非项目 Token）。</p>
                        <CodeBlock code={`{
  "reportName": "Updated Report Name",
  "reason": "CRASH"
}`} />
                    </div>
                    
                    <div>
                        <EndpointBadge method="GET" path="/logs/:id/raw" color="blue" />
                        <p className="text-zinc-400 mb-4 text-sm">直接返回原始文本内容 (Content-Type: text/plain)。</p>
                    </div>
                </section>
                
                <section>
                    <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <Shield size={20} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">认证 API</h2>
                    </div>
                    
                    <div className="mb-8">
                        <EndpointBadge method="POST" path="/auth/login" />
                        <p className="text-zinc-400 mb-4 text-sm">登录以获取访问仪表盘的 JWT Token。需要 Cloudflare Turnstile token。</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">请求</h3>
                                <CodeBlock code={`{
  "username": "admin",
  "password": "password123",
  "turnstileToken": "<token>"
}`} />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">响应</h3>
                                <CodeBlock code={`{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "username": "admin"
}`} />
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                            <Key size={16} className="text-amber-400 mt-0.5" />
                            <p className="text-xs text-amber-200/80">
                                保存返回的 <strong>token</strong>。所有仪表盘 API 请求都需要它。
                            </p>
                        </div>
                    </div>
                    
                    <div>
                        <EndpointBadge method="POST" path="/auth/register" />
                        <p className="text-zinc-400 text-sm">注册新用户。参数与登录相同。</p>
                    </div>
                </section>
                
                <section>
                    <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <LayoutDashboard size={20} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">仪表盘 API</h2>
                    </div>

                    <div className="page-card p-4 mb-8 flex items-start gap-3 border-emerald-500/20 bg-emerald-500/5">
                        <Key className="text-emerald-500 shrink-0 mt-0.5" size={18} />
                        <div>
                            <h3 className="text-sm font-bold text-emerald-400 mb-1">需要认证</h3>
                            <p className="text-xs text-emerald-200/70 leading-relaxed">
                                以下所有请求都必须在请求头中包含 JWT Token：<br />
                                <code className="bg-black/30 px-1.5 py-0.5 rounded mt-1.5 inline-block font-mono text-emerald-300">Authorization: Bearer &lt;token&gt;</code>
                            </p>
                        </div>
                    </div>

                    <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <p className="text-xs text-amber-200/80 leading-relaxed">
                            项目接口同时提供 <code className="text-amber-200 bg-black/20 px-1.5 py-0.5 rounded">/dashboard/projects</code> 与兼容别名 <code className="text-amber-200 bg-black/20 px-1.5 py-0.5 rounded">/dashboard/plugins</code>。
                            创建/重命名若项目名已存在会返回 <code className="text-amber-200 bg-black/20 px-1.5 py-0.5 rounded">409</code>。
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ApiCard 
                            method="GET" 
                            path="/dashboard/projects" 
                            desc="列出当前用户的所有项目。" 
                            color="blue"
                        />
                        <ApiCard 
                            method="GET" 
                            path="/dashboard/plugins" 
                            desc="兼容别名：列出当前用户的所有项目。" 
                            color="blue"
                        />
                        <ApiCard 
                            method="POST" 
                            path="/dashboard/projects" 
                            desc="创建新项目。" 
                            payload={`{ "name": "My Server" }`}
                        />
                        <ApiCard 
                            method="PUT" 
                            path="/dashboard/projects/:id" 
                            desc="重命名项目。" 
                            payload={`{ "name": "New Name" }`}
                            color="amber"
                        />
                        <ApiCard 
                            method="DELETE" 
                            path="/dashboard/projects/:id" 
                            desc="删除项目及其所有日志。" 
                            color="red"
                        />
                        <ApiCard 
                            method="GET" 
                            path="/dashboard/logs/:projectId" 
                            desc="获取项目的最近日志（限制 100 条）。" 
                            color="blue"
                        />
                        <ApiCard 
                            method="DELETE" 
                            path="/dashboard/logs/:id" 
                            desc="删除特定日志。" 
                            color="red"
                        />
                        <ApiCard 
                            method="DELETE" 
                            path="/dashboard/logs/batch" 
                            desc="批量删除日志。请求体需为 JSON。" 
                            payload={`{ "ids": ["a1b2c3", "d4e5f6"] }`}
                            color="red"
                        />
                        <ApiCard 
                            method="PUT" 
                            path="/dashboard/logs/batch/visibility" 
                            desc="批量设置日志公开/私密。请求体需为 JSON。" 
                            payload={`{ "ids": ["a1b2c3", "d4e5f6"], "isPublic": true }`}
                            color="amber"
                        />
                    </div>
                </section>

                <section>
                    <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <Activity size={20} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">服务状态与调试 API</h2>
                    </div>

                    <div className="mb-12">
                        <EndpointBadge method="GET" path="/health" color="blue" />
                        <p className="text-zinc-400 mb-4 text-sm">健康检查。用于探活与快速判断服务是否在线。</p>
                        <CodeBlock code={`{
  "ok": true,
  "time": "2026-01-01T12:00:00.000Z"
}`} />
                    </div>

                    <div>
                        <EndpointBadge method="GET" path="/debug/cors" color="blue" />
                        <p className="text-zinc-400 mb-4 text-sm">输出当前请求的 Origin 与服务端允许的 CORS Origins（用于排查跨域）。</p>
                        <div className="flex items-start gap-2 mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <Bug size={16} className="text-amber-400 mt-0.5" />
                            <p className="text-xs text-amber-200/80 leading-relaxed">
                                建议仅在调试环境使用该接口。
                            </p>
                        </div>
                        <CodeBlock code={`{
  "origin": "http://localhost:5173",
  "allowed": ["http://localhost:5173"]
}`} />
                    </div>
                </section>
            </div>
        </div>
    );
}

function EndpointBadge({ method, path, color = "emerald" }) {
    const colors = {
        emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        red: "bg-red-500/10 text-red-400 border-red-500/20",
    };
    
    return (
        <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className={`${colors[color]} px-3 py-1 rounded-lg text-sm font-bold border shadow-sm`}>{method}</span>
            <code className="text-lg sm:text-xl font-mono text-white tracking-tight">{path}</code>
        </div>
    );
}

function CodeBlock({ code }) {
    return (
        <div className="page-card rounded-xl overflow-hidden group">
            <div className="bg-[#0e0e11] p-4 overflow-x-auto custom-scrollbar">
                <pre className="font-mono text-xs text-zinc-300 leading-relaxed">{code}</pre>
            </div>
        </div>
    );
}

function ParamRow({ name, type, desc, required }) {
    return (
        <tr>
            <td className="px-6 py-4 font-mono text-emerald-400 text-sm border-b border-white/5">{name} {required && <span className="text-red-400">*</span>}</td>
            <td className="px-6 py-4 text-zinc-500 font-mono text-xs border-b border-white/5">{type}</td>
            <td className="px-6 py-4 text-zinc-400 text-sm border-b border-white/5 leading-relaxed">{desc}</td>
        </tr>
    );
}

function ApiCard({ method, path, desc, payload, color = "emerald" }) {
    const colors = {
        emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
        red: "text-red-400 bg-red-500/10 border-red-500/20",
    };

    return (
        <div className="page-card p-5 hover:border-white/10 transition-all">
            <div className="flex items-center gap-2 mb-3">
                <span className={`${colors[color]} px-2 py-0.5 rounded text-[10px] font-bold border uppercase`}>{method}</span>
                <code className="text-xs text-zinc-300 font-mono truncate" title={path}>{path}</code>
            </div>
            <p className="text-zinc-400 text-sm mb-3">{desc}</p>
            {payload && (
                <div className="bg-black/30 p-2 rounded border border-white/5">
                    <code className="text-[10px] text-zinc-500 font-mono block break-all">{payload}</code>
                </div>
            )}
        </div>
    );
}
