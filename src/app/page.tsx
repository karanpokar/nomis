'use client'
import Image from 'next/image'
import {DynamicWidget} from '@dynamic-labs/sdk-react-core'

export default function Home() {
  return (
    <main className="f  lex min-h-screen flex-col items-center justify-between p-24">
      <DynamicWidget/>
    </main>
  )
}
