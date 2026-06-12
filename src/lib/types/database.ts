export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
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
          memora_id: string | null
          wishlist_public: boolean
          bio: string | null
          favourite_venue_id: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          profile_public?: boolean
          memora_id?: string | null
          wishlist_public?: boolean
          bio?: string | null
          favourite_venue_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          profile_public?: boolean
          memora_id?: string | null
          wishlist_public?: boolean
          bio?: string | null
          favourite_venue_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'users_favourite_venue_id_fkey'
            columns: ['favourite_venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
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
        Insert: {
          id?: string
          google_place_id?: string | null
          name: string
          address?: string | null
          lat: number
          lng: number
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          google_place_id?: string | null
          name?: string
          address?: string | null
          lat?: number
          lng?: number
          category?: string | null
          created_at?: string
        }
        Relationships: []
      }
      memories: {
        Row: {
          id: string
          user_id: string
          venue_id: string | null
          dish_name: string | null
          notes: string | null
          rating: number | null
          rating_food: number | null
          rating_service: number | null
          rating_ambiance: number | null
          is_public: boolean
          public_lat: number | null
          public_lng: number | null
          visited_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id?: string | null
          dish_name?: string | null
          notes?: string | null
          rating?: number | null
          rating_food?: number | null
          rating_service?: number | null
          rating_ambiance?: number | null
          is_public?: boolean
          public_lat?: number | null
          public_lng?: number | null
          visited_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string | null
          dish_name?: string | null
          notes?: string | null
          rating?: number | null
          rating_food?: number | null
          rating_service?: number | null
          rating_ambiance?: number | null
          is_public?: boolean
          public_lat?: number | null
          public_lng?: number | null
          visited_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memories_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'memories_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
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
        Insert: {
          id?: string
          memory_id: string
          storage_path: string
          lat?: number | null
          lng?: number | null
          taken_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          memory_id?: string
          storage_path?: string
          lat?: number | null
          lng?: number | null
          taken_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'memory_photos_memory_id_fkey'
            columns: ['memory_id']
            isOneToOne: false
            referencedRelation: 'memories'
            referencedColumns: ['id']
          },
        ]
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
        Insert: {
          id?: string
          user_id: string
          venue_id: string
          notes?: string | null
          priority?: number
          added_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string
          notes?: string | null
          priority?: number
          added_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wishlists_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wishlists_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'follows_follower_id_fkey'
            columns: ['follower_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'follows_following_id_fkey'
            columns: ['following_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      friend_requests: {
        Row: {
          id: string
          from_user_id: string
          to_user_id: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          from_user_id: string
          to_user_id: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          from_user_id?: string
          to_user_id?: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'friend_requests_from_user_id_fkey'
            columns: ['from_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friend_requests_to_user_id_fkey'
            columns: ['to_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      friends: {
        Row: {
          friend_id: string | null
          created_at: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          id: string | null
          memora_id: string | null
          display_name: string | null
          username: string | null
          avatar_url: string | null
          profile_public: boolean | null
          wishlist_public: boolean | null
          bio: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_memora_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type UserRow = Database['public']['Tables']['users']['Row']
export type VenueRow = Database['public']['Tables']['venues']['Row']
export type MemoryRow = Database['public']['Tables']['memories']['Row']
export type MemoryPhotoRow = Database['public']['Tables']['memory_photos']['Row']
export type WishlistRow = Database['public']['Tables']['wishlists']['Row']
export type FriendRequestRow = Database['public']['Tables']['friend_requests']['Row']
export type PublicProfileRow = Database['public']['Views']['public_profiles']['Row']

export type MemoryWithDetails = MemoryRow & {
  venue: VenueRow | null
  memory_photos: MemoryPhotoRow[]
}
