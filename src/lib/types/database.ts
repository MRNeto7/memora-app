export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          profile_public: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      venues: {
        Row: {
          id: string
          google_place_id: string | null
          name: string
          address: string | null
          lat: number
          lng: number
          category: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['venues']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['venues']['Insert']>
      }
      memories: {
        Row: {
          id: string
          user_id: string
          venue_id: string | null
          dish_name: string | null
          notes: string | null
          rating: number | null
          is_public: boolean
          public_lat: number | null
          public_lng: number | null
          visited_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['memories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['memories']['Insert']>
      }
      memory_photos: {
        Row: {
          id: string
          memory_id: string
          storage_path: string
          lat: number | null
          lng: number | null
          taken_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['memory_photos']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['memory_photos']['Insert']>
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          venue_id: string
          notes: string | null
          priority: number
          added_at: string
        }
        Insert: Omit<Database['public']['Tables']['wishlists']['Row'], 'id' | 'added_at'>
        Update: Partial<Database['public']['Tables']['wishlists']['Insert']>
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['follows']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
  }
}

export type UserRow = Database['public']['Tables']['users']['Row']
export type VenueRow = Database['public']['Tables']['venues']['Row']
export type MemoryRow = Database['public']['Tables']['memories']['Row']
export type MemoryPhotoRow = Database['public']['Tables']['memory_photos']['Row']
export type WishlistRow = Database['public']['Tables']['wishlists']['Row']

export type MemoryWithDetails = MemoryRow & {
  venue: VenueRow | null
  memory_photos: MemoryPhotoRow[]
}
