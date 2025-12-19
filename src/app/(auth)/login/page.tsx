import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string; message?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          登录 Fashion AI
        </h1>
        <p className="text-gray-500 text-center mb-6 text-sm">
          服装电商智能营销平台
        </p>

        {params.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{params.error}</p>
          </div>
        )}

        {params.message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 text-sm">{params.message}</p>
          </div>
        )}

        <form className="space-y-4">
          <input
            type="hidden"
            name="redirect"
            value={params.redirect || '/'}
          />

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-gray-900"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-gray-900"
              placeholder="••••••••"
            />
          </div>

          <button
            formAction={login}
            className="w-full bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-colors font-medium"
          >
            登录
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            还没有账号？{' '}
            <a href="/signup" className="text-black font-medium hover:underline">
              立即注册
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
