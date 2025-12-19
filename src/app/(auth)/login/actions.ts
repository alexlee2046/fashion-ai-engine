'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirect') as string) || '/'

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('请填写邮箱和密码'))
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    let errorMessage = '登录失败，请稍后重试'

    if (error.message === 'Invalid login credentials') {
      errorMessage = '邮箱或密码错误'
    } else if (error.message.includes('Email not confirmed')) {
      errorMessage = '请先验证邮箱'
    }

    redirect('/login?error=' + encodeURIComponent(errorMessage))
  }

  revalidatePath('/', 'layout')
  redirect(redirectTo)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
