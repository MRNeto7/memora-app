'use client'

import { useEffect, useRef, useState } from 'react'

interface PlaceSuggestion {
  placeId: string
  name: string
  address: string
  lat: number
  lng: number
  rating?: number
}

interface PlacesSearchProps {
  value: string
  onChange: (value: string) => void
  onSelect: (place: PlaceSuggestion) => void
  selectedPlace: PlaceSuggestion | null
}

export default function PlacesSearch({ value, onChange, onSelect, selectedPlace }: PlacesSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [ready, setReady] = useState(false)

  // Wait for Google Maps to be available
  useEffect(() => {
    function init() {
      if (window.google?.maps?.places) {
        setReady(true)
      } else {
        setTimeout(init, 300)
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['establishment'],
      fields: ['place_id', 'name', 'formatted_address', 'geometry', 'rating', 'types'],
    })

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace()
      if (!place?.geometry?.location) return

      onSelect({
        placeId: place.place_id ?? '',
        name: place.name ?? '',
        address: place.formatted_address ?? '',
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        rating: place.rating,
      })
    })
  }, [ready, onSelect])

  return (
    <div>
      <label className="text-xs mb-1 block font-medium" style={{ color: '#7D878D' }}>
        Restaurant or bar
        {selectedPlace && (
          <span className="ml-2" style={{ color: '#0D4F57' }}>✓ linked to Google Maps</span>
        )}
      </label>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search restaurants, bars, cafes…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-4 py-3 rounded-xl outline-none"
        style={{
          border: `1.5px solid ${selectedPlace ? '#0D4F57' : '#EAE5DD'}`,
          background: '#fafaf9',
        }}
      />
      {!ready && (
        <p className="text-xs mt-1" style={{ color: '#b0babe' }}>Loading search…</p>
      )}
    </div>
  )
}
