import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 需要认证的路由
const PROTECTED_ROUTES = ['/', '/generate']
// 认证相关路由 (已登录用户重定向)
const AUTH_ROUTES = ['/login', '/signup']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 刷新会话 (重要：保持用户登录状态)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 未登录用户访问保护路由 -> 重定向到登录
  if (
    !user &&
    PROTECTED_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    )
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // 已登录用户访问认证页面 -> 重定向到首页
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 匹配所有路由，除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico
     * - 图片文件 (.svg, .png, .jpg, .jpeg, .gif, .webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
