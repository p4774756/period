import type { MascotAnimal } from '../types'
import bearPng from '../assets/mascots/mascot-bear.png'
import catPng from '../assets/mascots/mascot-cat.png'
import dogPng from '../assets/mascots/mascot-dog.png'
import foxPng from '../assets/mascots/mascot-fox.png'
import pandaPng from '../assets/mascots/mascot-panda.png'
import rabbitPng from '../assets/mascots/mascot-rabbit.png'

const MASCOT_PNG: Record<MascotAnimal, string> = {
  rabbit: rabbitPng,
  cat: catPng,
  bear: bearPng,
  dog: dogPng,
  panda: pandaPng,
  fox: foxPng,
}

export function MascotIcon({
  animal,
  className,
  priority = false,
}: {
  animal: MascotAnimal
  className?: string
  /** 主畫面大圖可設為 true，讓圖先載入 */
  priority?: boolean
}) {
  return (
    <img
      src={MASCOT_PNG[animal]}
      width={256}
      height={256}
      className={className}
      alt="" // 外層按鈕已有說明，此處作為純裝飾
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
    />
  )
}

