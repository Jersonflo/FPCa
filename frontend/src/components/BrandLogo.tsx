import { Cloud, Boxes } from 'lucide-react'
import type { PlatformDef } from '../lib/platforms'

/** Logo de la plataforma (Simple Icons) en su color; ícono genérico si no hay logo oficial */
export default function BrandLogo({ platform, size = 24, color }: { platform: PlatformDef; size?: number; color?: string }) {
  const fill = color || platform.color
  if (!platform.icon) {
    const Icon = platform.key === 'aws' ? Cloud : Boxes
    return <Icon size={size} color={fill} strokeWidth={1.6} aria-hidden />
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={fill} aria-hidden>
      <path d={platform.icon.path} />
    </svg>
  )
}
