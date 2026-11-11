const cache = new Map<string, string>()

export async function resolveAssetObjectUrl(assetId: string): Promise<string> {
  const hit = cache.get(assetId)
  if (hit) return hit
  const res = await fetch(`/api/v1/assets/${assetId}/content/`, { credentials: 'include' })
  if (!res.ok) throw new Error(`asset_content_${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  cache.set(assetId, url)
  return url
}

export function revokeAllAssetUrls() {
  for (const url of cache.values()) URL.revokeObjectURL(url)
  cache.clear()
}
