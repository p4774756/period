import type { MascotAnimal } from '../types'
import type { ReactNode } from 'react'

function FaceBase({
  children,
  face = '#fff7f0',
  className,
}: {
  children: ReactNode
  face?: string
  className?: string
}) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <circle cx="32" cy="34" r="20" fill={face} stroke="#7b6f89" strokeWidth="2" />
      <circle cx="25" cy="33" r="2.2" fill="#3a3345" />
      <circle cx="39" cy="33" r="2.2" fill="#3a3345" />
      <path d="M29 41c1.3 1.6 4.7 1.6 6 0" stroke="#3a3345" strokeWidth="2" strokeLinecap="round" />
      {children}
    </svg>
  )
}

export function MascotIcon({
  animal,
  className,
}: {
  animal: MascotAnimal
  className?: string
}) {
  if (animal === 'rabbit') {
    return (
      <FaceBase face="#fff" className={className}>
        <ellipse cx="23" cy="12" rx="5" ry="12" fill="#fff" stroke="#7b6f89" strokeWidth="2" />
        <ellipse cx="41" cy="12" rx="5" ry="12" fill="#fff" stroke="#7b6f89" strokeWidth="2" />
        <ellipse cx="23" cy="12" rx="2" ry="7" fill="#ffd6ea" />
        <ellipse cx="41" cy="12" rx="2" ry="7" fill="#ffd6ea" />
      </FaceBase>
    )
  }
  if (animal === 'cat') {
    return (
      <FaceBase face="#fff6e8" className={className}>
        <path d="M16 24l8-12 6 10" fill="#ffe2b8" stroke="#7b6f89" strokeWidth="2" />
        <path d="M48 24l-8-12-6 10" fill="#ffe2b8" stroke="#7b6f89" strokeWidth="2" />
      </FaceBase>
    )
  }
  if (animal === 'bear') {
    return (
      <FaceBase face="#ffe0ba" className={className}>
        <circle cx="17" cy="20" r="6" fill="#ffd1a3" stroke="#7b6f89" strokeWidth="2" />
        <circle cx="47" cy="20" r="6" fill="#ffd1a3" stroke="#7b6f89" strokeWidth="2" />
      </FaceBase>
    )
  }
  if (animal === 'dog') {
    return (
      <FaceBase face="#fff2df" className={className}>
        <ellipse cx="17" cy="25" rx="6" ry="10" fill="#d7a770" stroke="#7b6f89" strokeWidth="2" />
        <ellipse cx="47" cy="25" rx="6" ry="10" fill="#d7a770" stroke="#7b6f89" strokeWidth="2" />
      </FaceBase>
    )
  }
  if (animal === 'panda') {
    return (
      <FaceBase face="#fff" className={className}>
        <circle cx="17" cy="20" r="6" fill="#1f2937" />
        <circle cx="47" cy="20" r="6" fill="#1f2937" />
        <ellipse cx="25" cy="33" rx="4.3" ry="5.6" fill="#1f2937" />
        <ellipse cx="39" cy="33" rx="4.3" ry="5.6" fill="#1f2937" />
      </FaceBase>
    )
  }
  return (
    <FaceBase face="#ffe7d1" className={className}>
      <path d="M14 24l10-12 4 11" fill="#ffb36d" stroke="#7b6f89" strokeWidth="2" />
      <path d="M50 24l-10-12-4 11" fill="#ffb36d" stroke="#7b6f89" strokeWidth="2" />
      <path d="M32 40l5 4h-10z" fill="#fff" />
    </FaceBase>
  )
}

