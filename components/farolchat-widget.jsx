"use client"

import { useEffect } from 'react'

export default function FarolChatWidget() {
  useEffect(() => {
    try {
      const d = document
      const t = 'script'
      const BASE_URL = 'https://app.farolchat.com'
      const g = d.createElement(t)
      const s = d.getElementsByTagName(t)[0]
      g.src = BASE_URL + '/packs/js/sdk.js'
      g.async = true
      s.parentNode.insertBefore(g, s)
      g.onload = function () {
        try {
          window.chatwootSDK.run({
            websiteToken: 'X7DJ8yHtWFWryYL92fpSjhaH',
            baseUrl: BASE_URL,
          })
        } catch (e) {}
      }
    } catch (e) {}
  }, [])
  return null
}
