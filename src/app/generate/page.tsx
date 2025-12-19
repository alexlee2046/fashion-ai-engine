'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  uploadProductImage,
  generateModelImage,
  getGenerationStatus,
} from '@/app/actions/image';

// ============================================
// 类型定义
// ============================================

interface GenerationState {
  step: 'idle' | 'uploading' | 'generating' | 'polling' | 'completed' | 'error';
  progress: number;
  imageUrl?: string;
  resultUrl?: string;
  error?: string;
  taskId?: string;
}

// ============================================
// 主组件
// ============================================

export default function GeneratePage() {
  const [state, setState] = useState<GenerationState>({
    step: 'idle',
    progress: 0,
  });
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // 处理文件上传
  const handleFile = useCallback(async (file: File) => {
    setState({ step: 'uploading', progress: 10 });

    // 1. 上传图片
    const formData = new FormData();
    formData.append('file', file);

    const uploadResult = await uploadProductImage(formData);

    if (!uploadResult.success || !uploadResult.data) {
      setState({
        step: 'error',
        progress: 0,
        error: uploadResult.error || '上传失败',
      });
      return;
    }

    setState({
      step: 'generating',
      progress: 30,
      imageUrl: uploadResult.data.url,
    });

    // 2. 开始生成模特图
    const generateResult = await generateModelImage(uploadResult.data.url);

    if (!generateResult.success || !generateResult.data) {
      setState((prev) => ({
        ...prev,
        step: 'error',
        error: generateResult.error || '生成失败',
      }));
      return;
    }

    const taskId = generateResult.data.taskId;

    setState((prev) => ({
      ...prev,
      step: 'polling',
      progress: 40,
      taskId,
    }));

    // 3. 轮询任务状态
    pollingRef.current = setInterval(async () => {
      const statusResult = await getGenerationStatus(taskId);

      if (!statusResult.success || !statusResult.data) {
        return;
      }

      const { status, progress, resultUrl } = statusResult.data;

      if (status === 'completed' && resultUrl) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        setState((prev) => ({
          ...prev,
          step: 'completed',
          progress: 100,
          resultUrl,
        }));
      } else if (status === 'failed') {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        setState((prev) => ({
          ...prev,
          step: 'error',
          error: '生成失败，请重试',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          progress: Math.max(prev.progress, 40 + (progress || 0) * 0.6),
        }));
      }
    }, 2000); // 每 2 秒轮询一次
  }, []);

  // 拖拽处理
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile]
  );

  // 重置状态
  const handleReset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    setState({ step: 'idle', progress: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            AI Model Image Generator
          </h1>
          <p className="text-gray-600">
            Upload a product image and generate a model wearing it
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* 左侧：上传区域 */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Product Image
            </h2>

            {/* 上传区域 */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative border-2 border-dashed rounded-lg p-8
                flex flex-col items-center justify-center
                cursor-pointer transition-colors min-h-[300px]
                ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
                ${state.imageUrl ? 'border-green-500 bg-green-50' : ''}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleChange}
                className="hidden"
                disabled={state.step !== 'idle' && state.step !== 'completed' && state.step !== 'error'}
              />

              {state.imageUrl ? (
                <Image
                  src={state.imageUrl}
                  alt="Uploaded product"
                  width={256}
                  height={320}
                  className="max-h-64 object-contain rounded"
                  unoptimized
                />
              ) : (
                <>
                  <svg
                    className="w-12 h-12 text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-gray-600 text-center">
                    Drag & drop or click to upload
                  </p>
                  <p className="text-gray-400 text-sm mt-1">
                    JPG, PNG, WebP up to 10MB
                  </p>
                </>
              )}
            </div>

            {/* 进度条 */}
            {(state.step === 'uploading' ||
              state.step === 'generating' ||
              state.step === 'polling') && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>
                    {state.step === 'uploading'
                      ? 'Uploading...'
                      : state.step === 'generating'
                      ? 'Starting generation...'
                      : 'Generating model image...'}
                  </span>
                  <span>{Math.round(state.progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {state.step === 'error' && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{state.error}</p>
                <button
                  onClick={handleReset}
                  className="mt-2 text-red-600 text-sm underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* 重新开始按钮 */}
            {state.step === 'completed' && (
              <button
                onClick={handleReset}
                className="mt-4 w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Generate Another
              </button>
            )}
          </div>

          {/* 右侧：结果展示 */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generated Model Image
            </h2>

            <div className="border-2 border-dashed border-gray-200 rounded-lg min-h-[300px] flex items-center justify-center">
              {state.step === 'completed' && state.resultUrl ? (
                <div className="relative">
                  <Image
                    src={state.resultUrl}
                    alt="Generated model"
                    width={320}
                    height={400}
                    className="max-h-80 object-contain rounded"
                    unoptimized
                  />
                  <a
                    href={state.resultUrl}
                    download="model-image.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 bg-black/70 text-white px-3 py-1 rounded text-sm hover:bg-black/90 transition-colors"
                  >
                    Download
                  </a>
                </div>
              ) : state.step === 'polling' || state.step === 'generating' ? (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                  <p className="text-gray-500">Generating...</p>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <svg
                    className="w-16 h-16 mx-auto mb-2 opacity-50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p>Upload a product image to start</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 返回首页 */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 text-sm underline"
          >
            Back to Script Generator
          </Link>
        </div>
      </div>
    </main>
  );
}
