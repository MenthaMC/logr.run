import React, { useState, useRef } from 'react';
import { 
  Upload, FileText, Terminal, X, Zap, AlertTriangle, Box, Shield, Code, Copy, Check,
  ArrowRight, Activity, Search, BarChart3
} from 'lucide-react';
import { Button } from '@/lib/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config/api';
import { uploadLogContent, uploadLogFile } from '../services/logService';

const JAVA_CODE_RAW = `public void uploadLog(Path logFile, String reason) throws IOException {
    // 1. 读取文件
    byte[] fileBytes = Files.readAllBytes(logFile);

    // 2. 创建请求
    HttpClient client = HttpClient.newHttpClient();
    HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${API_BASE_URL}/logs"))
            .header("Content-Type", "application/json")
            .header("X-Backend-Token", "你的后端令牌") // 可选
            .POST(BodyPublishers.ofString("..."))
            .build();

    // 3. 异步发送
    client.sendAsync(request, HttpResponse.BodyHandlers.ofString())
        .thenAccept(res -> {
             if (res.statusCode() == 200) {
                 String url = res.headers().firstValue("Location").orElse("");
                 System.out.println("日志已上传：" + url);
             }
        });
}`;

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 20 }
  }
};

const Background = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <motion.div 
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, 90, 0],
        opacity: [0.1, 0.2, 0.1] 
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[100px]"
    />
    <motion.div 
      animate={{ 
        scale: [1, 1.3, 1],
        rotate: [0, -60, 0],
        opacity: [0.1, 0.15, 0.1]
      }}
      transition={{ duration: 25, repeat: Infinity, ease: "linear", delay: 2 }}
      className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px]"
    />
    <div
      className="absolute inset-0 opacity-15 mix-blend-overlay"
      style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: '3px 3px'
      }}
    />
  </div>
);

export default function Home({ onSuccess, onNav }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isPreviewed, setIsPreviewed] = useState(false);
  const [terminalMessage, setTerminalMessage] = useState(null);
  
  const fileInputRef = useRef(null);
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
  const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024;
      index += 1;
    }
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
  };
  
  const handleUpload = async () => {
    if (!selectedFile && !content.trim()) return;
    setTerminalMessage(null);
    setLoading(true);
    try {
      const data = selectedFile
        ? await uploadLogFile(selectedFile, { reason: 'MANUAL' })
        : await uploadLogContent(content, { reason: 'MANUAL' });
      if (data.success) {
        const previewContent = selectedFile && !isPreviewed ? "" : content;
        const viewId = data.shortId || data.id;
        onSuccess(viewId, previewContent);
        resetInput();
      } else {
        setTerminalMessage({ type: 'error', text: data.error || "上传失败" });
      }
    } catch (err) { 
      setTerminalMessage({ type: 'error', text: '无法连接到服务器，请稍后再试' });
    } finally { setLoading(false); }
  };

  const readFile = (file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setSelectedFile(null);
      setIsPreviewed(false);
      setTerminalMessage({ type: 'error', text: `文件超过 ${formatBytes(MAX_UPLOAD_BYTES)}，请压缩或裁剪后再试` });
      return;
    }

    const ALLOWED_EXTS = ['.log', '.txt', '.yml', '.yaml', '.json', '.xml', '.properties', '.toml', '.conf', '.config', '.sh', '.bat', '.gz'];
    const fileName = file.name.toLowerCase();
    const isAllowed = ALLOWED_EXTS.some(ext => fileName.endsWith(ext));
    if (!isAllowed) {
      setSelectedFile(null);
      setIsPreviewed(false);
      setTerminalMessage({ type: 'error', text: '不支持该文件类型，请上传文本日志文件（.log、.txt、.gz 等）' });
      return;
    }

    setSelectedFile(file);
    setIsPreviewed(false);
    setTerminalMessage(null);

    const isGzip = fileName.endsWith('.gz');
    const shouldPreview = !isGzip && file.size <= MAX_PREVIEW_BYTES;
    if (!shouldPreview) {
      setContent("");
      setIsPreviewed(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setContent(e.target.result || "");
      setIsPreviewed(true);
    };
    reader.readAsText(file);
  };

  const handleContentChange = (e) => {
    if (selectedFile) {
      setSelectedFile(null);
      setIsPreviewed(false);
    }
    if (terminalMessage) setTerminalMessage(null);
    setContent(e.target.value);
  };

  const resetInput = () => {
    setContent("");
    setSelectedFile(null);
    setIsPreviewed(false);
    setTerminalMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(JAVA_CODE_RAW);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 relative overflow-hidden w-full min-h-full">
      <Background />
      
      <motion.div 
        className="w-full max-w-6xl z-10 flex flex-col items-center"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        
        {/* Hero Section */}
        <motion.div className="text-center mb-10 md:mb-16 mt-8 md:mt-12" variants={itemVariants}>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight leading-tight">
            让复杂信息 <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
              前所未有的简单
            </span>
          </h1>
          <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            统一收集关键数据、实时分析、一键分享、支持多种格式
          </p>
        </motion.div>

        {/* Upload Section */}
        <motion.div className="w-full max-w-4xl" variants={itemVariants}>
          <motion.div
            layout
            className={`relative group glass-card rounded-2xl transition-all duration-300 overflow-hidden ${isDragging ? 'border-emerald-500 ring-4 ring-emerald-500/10 scale-[1.01]' : 'hover:border-white/20'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget)) return;
              setIsDragging(false);
            }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); readFile(e.dataTransfer.files[0]); }}
          >
            {/* Window Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5 backdrop-blur-md">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50"></div>
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50"></div>
                <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50"></div>
              </div>
              <div className="text-xs font-mono text-zinc-500 flex items-center gap-2 opacity-50 group-hover:opacity-100 transition">
                <Terminal size={12} /> 
                {selectedFile ? selectedFile.name : 'terminal'}
              </div>
              <motion.div
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <Button
                  isIconOnly
                  variant="light"
                  onPress={resetInput}
                  className="min-w-0 w-auto h-auto p-0 text-zinc-500 hover:text-white transition"
                >
                  <X size={16} />
                </Button>
              </motion.div>
            </div>

            {/* Text Area */}
            <textarea
              className="w-full h-[280px] sm:h-[320px] md:h-[400px] bg-transparent text-zinc-300 font-mono text-[13px] p-4 sm:p-6 resize-none outline-none leading-7 placeholder:text-zinc-700 custom-scrollbar whitespace-pre"
              placeholder="在此处粘贴日志内容，或将文件拖入..."
              value={content}
              onChange={handleContentChange}
              spellCheck="false"
            />

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 flex items-end justify-between pointer-events-none">
                <div className="flex flex-col gap-2 pointer-events-auto max-w-[60%]">
                    <AnimatePresence>
                      {(terminalMessage || selectedFile) && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="space-y-2"
                          >
                               {terminalMessage && (
                                  <div className={`text-[10px] md:text-xs font-mono px-3 py-1.5 rounded-lg border backdrop-blur-md flex items-center gap-2 ${terminalMessage.type === 'error' ? 'text-red-300 bg-red-500/10 border-red-500/20' : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'}`}>
                                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                                      {terminalMessage.text}
                                  </div>
                               )}
                               {selectedFile && (
                                  <div className="text-[10px] md:text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-700 rounded-lg px-3 py-1.5 font-mono flex items-center gap-2">
                                      <FileText size={12} />
                                      {selectedFile.name} 
                                      <span className="opacity-50">({formatBytes(selectedFile.size)})</span>
                                      {isPreviewed && <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-1 rounded">预览</span>}
                                  </div>
                               )}
                          </motion.div>
                      )}
                    </AnimatePresence>
                </div>

                <div className="flex gap-3 pointer-events-auto">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".log,.txt,.gz" onChange={e => readFile(e.target.files[0])} />
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Button
                            variant="light"
                            onPress={() => fileInputRef.current.click()}
                            className="px-4 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-xl flex items-center gap-2 border border-white/5 hover:border-white/10 transition font-medium text-sm backdrop-blur-md"
                            startContent={<FileText size={16} />}
                        >
                            <span className="hidden sm:inline">选择文件</span>
                        </Button>
                    </motion.div>
                    <motion.div
                        whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(16, 185, 129, 0.4)" }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <Button
                            onPress={handleUpload}
                            isDisabled={(!content.trim() && !selectedFile) || loading}
                            isLoading={loading}
                            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm group/btn"
                            startContent={!loading ? <Upload size={16} className="group-hover/btn:-translate-y-0.5 transition-transform" /> : null}
                        >
                            上传日志
                        </Button>
                    </motion.div>
                </div>
            </div>

            {/* Drag Overlay */}
            <AnimatePresence>
              {isDragging && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center z-20"
                >
                  <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="text-emerald-400 font-bold text-2xl flex flex-col items-center gap-6"
                  >
                    <div className="p-6 bg-emerald-500/10 rounded-full border border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                      <Upload size={48} />
                    </div>
                    松开鼠标以上传
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-6xl px-4">
            <FeatureCard 
                icon={<Activity size={24} className="text-red-400" />}
                title="智能分析"
                desc="自动检测崩溃堆栈，高亮关键错误，助你快速定位问题根源。"
                color="red"
                delay={0}
            />
            <FeatureCard 
                icon={<Box size={24} className="text-blue-400" />}
                title="Gzip 支持"
                desc="直接上传 .gz 压缩文件，无需解压，自动处理超大日志。"
                color="blue"
                delay={0.1}
            />
            <FeatureCard 
                icon={<Shield size={24} className="text-purple-400" />}
                title="隐私安全"
                desc="匿名日志定期清理，敏感信息（IP、令牌）自动脱敏处理。"
                color="purple"
                delay={0.2}
            />
            <FeatureCard 
                icon={<BarChart3 size={24} className="text-amber-400" />}
                title="数据可视化"
                desc="直观的图表展示，让日志数据一目了然，发现潜在趋势。"
                color="amber"
                delay={0.3}
            />
        </div>

        {/* Integration Section */}
        <motion.div 
          variants={itemVariants}
          className="mt-24 mb-16 w-full max-w-5xl"
        >
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
                <div className="max-w-xl">
                    <h2 className="text-3xl font-bold text-white mb-4">快速接入</h2>
                    <p className="text-zinc-400 leading-relaxed">
                        只需几十行代码，即可为您的程序集成自动日志上传功能。
                    </p>
                </div>
                <motion.div whileHover={{ x: 5 }}>
                    <Button
                        variant="light"
                        onPress={() => onNav?.('api')}
                        className="min-w-0 h-auto p-0 flex items-center gap-2 text-emerald-400 hover:text-emerald-300 font-medium transition group"
                    >
                        查看完整 API 文档 <ArrowRight size={16} />
                    </Button>
                </motion.div>
            </div>

            <div className="glass-card rounded-xl overflow-hidden shadow-2xl border border-white/5">
                <div className="bg-[#09090b] px-4 py-3 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                            <div className="w-2.5 h-2.5 rounded-full bg-zinc-700"></div>
                        </div>
                        <span className="text-xs font-mono text-zinc-500">Java HttpClient 示例</span>
                    </div>
                    <Button
                        variant="light"
                        onPress={handleCopyCode}
                        className={`text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1.5 transition-all ${codeCopied
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        {codeCopied ? <Check size={10} /> : <Copy size={10} />}
                        {codeCopied ? '已复制' : '复制'}
                    </Button>
                </div>
                <div className="p-6 bg-[#0c0c0e] overflow-x-auto">
                    <pre className="font-mono text-xs text-zinc-300 leading-relaxed">
                        <code>{JAVA_CODE_RAW}</code>
                    </pre>
                </div>
            </div>
        </motion.div>

        <motion.div 
          variants={itemVariants}
          className="w-full border-t border-white/5 py-8 text-center text-zinc-600 text-sm"
        >
            <p>&copy; {new Date().getFullYear()} Logrrun · 根据 MIT 许可证发布</p>
        </motion.div>

      </motion.div>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color, delay }) {
    const colorStyles = {
        red: "group-hover:border-red-500/30 group-hover:bg-red-500/5 hover:shadow-[0_0_20px_rgba(248,113,113,0.1)]",
        blue: "group-hover:border-blue-500/30 group-hover:bg-blue-500/5 hover:shadow-[0_0_20px_rgba(96,165,250,0.1)]",
        purple: "group-hover:border-purple-500/30 group-hover:bg-purple-500/5 hover:shadow-[0_0_20px_rgba(192,132,252,0.1)]",
        amber: "group-hover:border-amber-500/30 group-hover:bg-amber-500/5 hover:shadow-[0_0_20px_rgba(251,191,36,0.1)]",
    };

    return (
        <motion.div 
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className={`glass-card p-6 rounded-xl border border-white/5 transition-all duration-300 group ${colorStyles[color] || ""}`}
        >
            <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
                {desc}
            </p>
        </motion.div>
    );
}
