import pb from '@/lib/pocketbase/client'
import type { UserRecord } from '@/lib/types'

export const authService = {
  getCurrentUser(): UserRecord | null {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      return null
    }
    const model = pb.authStore.record
    return {
      id: model.id,
      email: model.email,
      nome: model.nome || model.name || '',
      name: model.name || model.nome || '',
      perfil: (model.perfil as 'administrador' | 'secretaria') || 'secretaria',
      avatar: model.avatar,
      created: model.created,
      updated: model.updated,
    }
  },

  async login(email: string, password: string): Promise<UserRecord> {
    const authData = await pb.collection('users').authWithPassword(email, password)
    const model = authData.record
    return {
      id: model.id,
      email: model.email,
      nome: model.nome || model.name || '',
      name: model.name || model.nome || '',
      perfil: (model.perfil as 'administrador' | 'secretaria') || 'secretaria',
      avatar: model.avatar,
      created: model.created,
      updated: model.updated,
    }
  },

  logout(): void {
    pb.authStore.clear()
  },

  subscribe(callback: (user: UserRecord | null) => void): () => void {
    const unsubscribe = pb.authStore.onChange(() => {
      callback(authService.getCurrentUser())
    })
    return unsubscribe
  },
}
