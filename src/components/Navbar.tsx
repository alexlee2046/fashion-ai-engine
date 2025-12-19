import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/(auth)/login/actions'

async function NavLink({
  href,
  label,
  currentPath,
}: {
  href: string
  label: string
  currentPath?: string
}) {
  const isActive = currentPath === href
  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
        isActive
          ? 'bg-gray-100 text-gray-900'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  )
}

export default async function Navbar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo + 主导航 */}
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="text-xl font-bold text-gray-900 flex items-center gap-2"
            >
              <span className="text-2xl">✨</span>
              <span>Fashion AI</span>
            </Link>

            {user && (
              <div className="hidden md:flex items-center space-x-1">
                <NavLink href="/" label="脚本生成" />
                <NavLink href="/generate" label="模特图生成" />
              </div>
            )}
          </div>

          {/* 用户区域 */}
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-sm text-gray-500 hidden sm:block">
                  {user.email}
                </span>
                <form action={logout}>
                  <button
                    type="submit"
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    退出
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                登录
              </Link>
            )}
          </div>
        </div>

        {/* 移动端导航 */}
        {user && (
          <div className="md:hidden pb-3 flex space-x-2">
            <NavLink href="/" label="脚本生成" />
            <NavLink href="/generate" label="模特图生成" />
          </div>
        )}
      </div>
    </nav>
  )
}
