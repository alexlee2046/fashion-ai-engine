'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/signup?error=' + encodeURIComponent('请填写邮箱和密码'))
  }

  if (password.length < 6) {
    redirect('/signup?error=' + encodeURIComponent('密码至少需要6个字符'))
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    let errorMessage = '注册失败，请稍后重试'

    if (error.message.includes('already registered')) {
      errorMessage = '该邮箱已被注册'
    } else if (error.message.includes('invalid email')) {
      errorMessage = '请输入有效的邮箱地址'
    }

    redirect('/signup?error=' + encodeURIComponent(errorMessage))
  }

  redirect(
    '/signup?message=' +
      encodeURIComponent('注册成功！请查收邮箱中的确认链接')
  )
}
