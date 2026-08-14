import { createFileRoute } from '@tanstack/react-router'
import { withCfDb } from '@/lib/with-request-db'

export const Route = createFileRoute('/api/users/$id')({
  server: {
    handlers: {
      GET: withCfDb(async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const { requireAdminAPI } = await import('@/lib/admin-auth')
          const authResult = await requireAdminAPI(request)
          if (authResult instanceof Response) return authResult

          const { db } = await import('@libs/database')
          const { user } = await import('@libs/database/schema/user')
          const { eq } = await import('drizzle-orm')

          const { id } = params

          const [userData] = await db.select().from(user).where(eq(user.id, id))

          if (!userData) {
            return Response.json({ error: 'User not found' }, { status: 404 })
          }

          return Response.json(userData)
        } catch (error) {
          console.error('Error fetching user:', error)
          return Response.json({ error: 'Internal Server Error' }, { status: 500 })
        }
      }),

      PATCH: withCfDb(async ({ request, params }: { request: Request; params: { id: string } }) => {
        try {
          const { requireAdminAPI } = await import('@/lib/admin-auth')
          const authResult = await requireAdminAPI(request)
          if (authResult instanceof Response) return authResult

          const { db } = await import('@libs/database')
          const { user } = await import('@libs/database/schema/user')
          const { eq } = await import('drizzle-orm')

          const { id } = params
          const { adminUpdateUserSchema } = await import('@vibechat/api-contracts/admin')
          const parsed = adminUpdateUserSchema.safeParse(await request.json())
          if (!parsed.success) {
            return Response.json({
              error: 'Invalid request',
              details: parsed.error.flatten(),
            }, { status: 400 })
          }
          const body = parsed.data

          const [existing] = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, id))

          if (!existing) {
            return Response.json({ error: 'User not found' }, { status: 404 })
          }

          const updates = {
            ...body,
            ...(body.image !== undefined ? { image: body.image || null } : {}),
            ...(body.phoneNumber !== undefined ? { phoneNumber: body.phoneNumber || null } : {}),
            ...(body.banReason !== undefined ? { banReason: body.banReason || null } : {}),
            updatedAt: new Date(),
          }

          await db
            .update(user)
            .set(updates)
            .where(eq(user.id, id))

          return Response.json({ message: 'User updated successfully' })
        } catch (error) {
          console.error('Error updating user:', error)
          return Response.json({ error: 'Internal Server Error' }, { status: 500 })
        }
      }),
    },
  },
})
