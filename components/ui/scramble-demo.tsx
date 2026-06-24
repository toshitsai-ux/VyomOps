"use client"

import ScrambleText from "@/components/ui/scramble-text"

export default function ScrambleTextDemo() {
  return (
    <div className="flex flex-col items-start justify-center font-mono max-w-2xl p-8 bg-slate-900 rounded-xl border border-zinc-800 shadow-2xl">
      <ScrambleText
        text="Clear Delta."
        className="text-5xl md:text-6xl font-medium tracking-tight text-white mb-6"
      />
      <ScrambleText
        text="VyomOps shows exactly what changed from space — so you can respond with confidence."
        className="text-xs md:text-sm text-zinc-500 max-w-md leading-relaxed font-normal"
        speed={90}
      />
    </div>
  )
}
