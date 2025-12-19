'use client';

import { useState } from 'react';
import { generateMarketingScript } from './actions';
import type { ScriptSchema, Platform } from '@/types';

export default function Home() {
  const [input, setInput] = useState('');
  const [platform, setPlatform] = useState<Platform>('douyin');
  const [result, setResult] = useState<ScriptSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await generateMarketingScript(input, platform);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || '生成失败，请稍后重试');
      }
    } catch (e) {
      console.error(e);
      setError('网络错误，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-50">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Fashion AI Engine</h1>
        <a
          href="/generate"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Generate Model Image
        </a>
      </div>

      <div className="w-full max-w-2xl bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        {/* 平台选择 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Target Platform</label>
          <div className="flex gap-2">
            {(['douyin', 'red', 'tiktok'] as Platform[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  platform === p
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p === 'douyin' ? '抖音' : p === 'red' ? '小红书' : 'TikTok'}
              </button>
            ))}
          </div>
        </div>

        {/* 产品描述输入 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Product Description
            <span className="text-gray-400 ml-2">({input.length}/2000)</span>
          </label>
          <textarea
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900"
            rows={4}
            placeholder="e.g. A vintage denim jacket with embroidery on the back..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={2000}
          />
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={loading || input.trim().length < 10}
          className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium"
        >
          {loading ? 'Generating...' : 'Generate Campaign'}
        </button>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* 结果展示 */}
        {result && (
          <div className="mt-8 pt-8 border-t border-gray-100">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Generated Script</h2>

            <div className="space-y-4">
              {/* Title */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <span className="font-bold text-purple-900 block mb-1">Title</span>
                <p className="text-purple-800">{result.title}</p>
              </div>

              {/* Hook */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <span className="font-bold text-blue-900 block mb-1">Hook (0-3s)</span>
                <p className="text-blue-800">{result.hook}</p>
              </div>

              {/* Body */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="font-bold text-gray-900 block mb-1">Body</span>
                <p className="text-gray-800 whitespace-pre-wrap">{result.body}</p>
              </div>

              {/* Call to Action */}
              <div className="bg-green-50 p-4 rounded-lg">
                <span className="font-bold text-green-900 block mb-1">Call to Action</span>
                <p className="text-green-800">{result.callToAction}</p>
              </div>

              {/* Hashtags */}
              <div className="flex flex-wrap gap-2 mt-4">
                {result.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="bg-gray-100 px-3 py-1 rounded-full text-gray-600 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
