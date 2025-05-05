'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'

const profileSchema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  bio: z.string().max(160, 'Bio must be less than 160 characters').optional(),
  avatarUrl: z.string().url('Please enter a valid URL').optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ProfileForm() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { user, updateProfile } = useAuth()
  const [theme, setTheme] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('theme') || 'system' : 'system')
  const [emailNotifications, setEmailNotifications] = useState(() => typeof window !== 'undefined' ? localStorage.getItem('emailNotifications') === 'true' : true)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.user_metadata.full_name || '',
      username: user?.user_metadata.username || '',
      bio: user?.user_metadata.bio || '',
      avatarUrl: user?.user_metadata.avatar_url || '',
    },
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme)
      localStorage.setItem('emailNotifications', String(emailNotifications))
    }
  }, [theme, emailNotifications])

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      setError(null)
      setSuccess(false)

      // Update Supabase Auth user metadata
      await updateProfile({
        full_name: data.fullName,
        username: data.username,
        bio: data.bio,
        avatar_url: data.avatarUrl,
      })

      // Update profile in database
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      setSuccess(true)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred while updating your profile'
      setError(errorMessage)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Update your profile information</p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="johndoe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us about yourself"
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="avatarUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar URL</FormLabel>
                <FormControl>
                  <Input type="url" placeholder="https://example.com/avatar.jpg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Theme Preferences */}
          <div className="pt-6 border-t mt-6">
            <h2 className="text-lg font-semibold mb-2">Theme Preferences</h2>
            <div className="flex gap-4 items-center">
              {THEME_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    value={opt.value}
                    checked={theme === opt.value}
                    onChange={() => setTheme(opt.value)}
                    className="accent-blue-600"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          {/* Notification Settings */}
          <div className="pt-6 border-t mt-6">
            <h2 className="text-lg font-semibold mb-2">Notifications</h2>
            <div className="flex items-center gap-3">
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
                id="email-notifications"
              />
              <label htmlFor="email-notifications" className="text-sm">Enable email notifications</label>
            </div>
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="bg-green-50 dark:bg-green-900">
              <AlertDescription>Profile updated successfully</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Saving changes...' : 'Save changes'}
          </Button>
        </form>
      </Form>
    </div>
  )
}
