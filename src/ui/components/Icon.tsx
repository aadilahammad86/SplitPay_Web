import React from 'react'

export type IconName =
  | 'home'
  | 'users'
  | 'user'
  | 'beach'
  | 'receipt'
  | 'chart'
  | 'settings'
  | 'plus'
  | 'close'
  | 'search'
  | 'edit'
  | 'delete'
  | 'check'
  | 'lock'
  | 'unlock'
  | 'reload'
  | 'smartphone'
  | 'monitor'
  | 'sun'
  | 'moon'
  | 'rupee'
  | 'dollar'
  | 'euro'
  | 'pound'
  | 'coins'
  | 'moneyHand'
  | 'creditcard'
  | 'arrowRight'
  | 'arrowLeft'
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronLeft'
  | 'burger'
  | 'cup'
  | 'cart'
  | 'airplane'
  | 'car'
  | 'box'
  | 'lightning'
  | 'ticket'
  | 'glass'
  | 'save'
  | 'cloud'
  | 'calendar'
  | 'filter'
  | 'heart'
  | 'folder'
  | 'share'
  | 'presentationPlay'
  | 'shield'
  | 'clipboard'
  | 'arrowUp'
  | 'arrowDown'
  | 'alert'
  | 'info'
  | 'document'
  | 'file'
  | 'eye'
  | 'eyeOff'
  | 'tag'
  | 'rocket'
  | 'star'
  | 'question'
  | 'database'
  | 'play'
  | 'link'
  | 'logout'
  | 'login'
  | 'bell'
  | 'send';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name?: IconName
  size?: number | string
  strokeWidth?: number | string
}

const iconPaths: Record<IconName, React.ReactNode> = {
  home: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 19v-8.5a1 1 0 0 0-.4-.8l-7-5.25a1 1 0 0 0-1.2 0l-7 5.25a1 1 0 0 0-.4.8V19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1z"/></>),
  users: (<><circle cx="9" cy="9" r="4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 19c0-3.314-3.134-6-7-6s-7 2.686-7 6m13-6a4 4 0 1 0-3-6.646"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M22 19c0-3.314-3.134-6-7-6-.807 0-2.103-.293-3-1.235"/></>),
  user: (<><circle cx="12" cy="8" r="5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 21a8 8 0 1 0-16 0m16 0a8 8 0 1 0-16 0"/></>),
  beach: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.696 3.866C15.098 2.366 11.5 2.598 10 5.196l3.464 2m4.232-3.33c2.598 1.5 4.196 4.732 2.696 7.33l-5.196-3m2.5-4.33.5-.866m-.5.866c-1.821.488-2.982 1.165-4.232 3.33m4.232-3.33c.488 1.821.482 3.165-.768 5.33m-1.732-1-1.732-1m1.732 1-3 5.196M3 21l.88-1.056a2.001 2.001 0 0 1 3.139.08v0a2.001 2.001 0 0 0 3.107.118l.19-.218a2.236 2.236 0 0 1 3.367 0l.191.218c.838.957 2.344.9 3.107-.117v0a2.001 2.001 0 0 1 3.14-.08L21 21M6.708 16A7.97 7.97 0 0 1 12 14a7.97 7.97 0 0 1 5.292 2"/></>),
  receipt: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h8m-8 4h8m-8 4h4m8 6V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16l2.5-2 3 2 2.5-2 2.5 2 3-2 2.5 2z"/></>),
  chart: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m4 0V7m-8 4h.01M3 3h1m17 0h-1m0 0v12h-6m6-12H4m0 0v12h6m0 0-2 6m2-6h4m0 0 2 6"/></>),
  settings: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 21h-4l-.551-2.48a6.991 6.991 0 0 1-1.819-1.05l-2.424.763-2-3.464 1.872-1.718a7.055 7.055 0 0 1 0-2.1L3.206 9.232l2-3.464 2.424.763A6.992 6.992 0 0 1 9.45 5.48L10 3h4l.551 2.48a6.992 6.992 0 0 1 1.819 1.05l2.424-.763 2 3.464-1.872 1.718a7.05 7.05 0 0 1 0 2.1l1.872 1.718-2 3.464-2.424-.763a6.99 6.99 0 0 1-1.819 1.052L14 21z"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></>),
  plus: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h7m7 0h-7m0 0V5m0 7v7"/></>),
  close: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12 7 7m5 5 5 5m-5-5 5-5m-5 5-5 5"/></>),
  search: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m20 20-4.05-4.05m0 0a7 7 0 1 0-9.9-9.9 7 7 0 0 0 9.9 9.9z"/></>),
  edit: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m14 6 2.293-2.293a1 1 0 0 1 1.414 0l2.586 2.586a1 1 0 0 1 0 1.414L18 10m-4-4-9.707 9.707a1 1 0 0 0-.293.707V19a1 1 0 0 0 1 1h2.586a1 1 0 0 0 .707-.293L18 10m-4-4 4 4"/></>),
  delete: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7v0a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v0M9 7h6M9 7H6m9 0h3m2 0h-2M4 7h2m0 0v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/></>),
  check: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M8 5v0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v0M8 5v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9 14 2 2 4-5"/></>),
  lock: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2m-8 0V7a4 4 0 0 1 4-4v0a4 4 0 0 1 4 4v3m-8 0h8m-4 4v3"/></>),
  unlock: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H8zm0 0V7c0-1.333.8-4 4-4 1.904 0 2.958.944 3.5 1.99M12 14v3"/></>),
  reload: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 13.5A7.5 7.5 0 1 1 11.5 6H20m0 0-3-3m3 3-3 3"/></>),
  smartphone: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 19V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9 6.001V6m0 3.001V9m3 .001V9m0-2.999V6m3 .001V6m0 3.001V9m-6 3.001V12m3 .001V12"/></>),
  monitor: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7zm0 0v4m0 0h4m-4 0H8"/></>),
  sun: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12h1m-3.5-6.5 1-1M12 3V2M5.5 5.5l-1-1M3 12H2m8 10h4m3-10a5 5 0 1 0-7 4.584V19h4v-2.416A5.001 5.001 0 0 0 17 12z"/></>),
  moon: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.353 3C5.849 4.408 3 7.463 3 11.47A9.53 9.53 0 0 0 12.53 21c4.007 0 7.062-2.849 8.47-6.353C8.17 17.065 8.14 8.14 9.353 3z"/></>),
  rupee: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h3m5 0h-5m5 3h-2m-6.003 0H14m-3-3c1 0 3 .6 3 3m-1 7-5.003-4H11c1 0 3-.6 3-3"/></>),
  dollar: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 8h-3m-3 8h3m0 0h1a2 2 0 0 0 2-2v0a2 2 0 0 0-2-2h-2a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2h1m0 8v2m0-10V6"/></>),
  euro: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8a5 5 0 1 0 0 8m-9-5.5h5m0 3H7"/></>),
  pound: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9c0-1.6-1.333-2-2-2s-2 .4-2 2v3m0 0v2c0 .667-.4 2-2 2h6m-4-4h2m-2 0H9"/></>),
  coins: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 8c0-1.657-3.134-3-7-3S7 6.343 7 8m14 0v4c0 1.02-1.186 1.92-3 2.462-1.134.34-2.513.538-4 .538s-2.866-.199-4-.538C8.187 13.92 7 13.02 7 12V8m14 0c0 1.02-1.186 1.92-3 2.462-1.134.34-2.513.538-4 .538s-2.866-.199-4-.538C8.187 9.92 7 9.02 7 8"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12v4c0 1.02 1.187 1.92 3 2.462 1.134.34 2.513.538 4 .538s2.866-.199 4-.538c1.813-.542 3-1.442 3-2.462v-1M3 12c0-1.197 1.635-2.23 4-2.711M3 12c0 1.02 1.187 1.92 3 2.462 1.134.34 2.513.538 4 .538.695 0 1.366-.043 2-.124"/></>),
  moneyHand: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 22v-7.1a7 7 0 0 0-2.052-4.95L14.998 8v6.587c0 .89-1.077 1.337-1.707.707L11.996 14c-.5-.5-1.701-.8-2.502 0-.8.8-.5 2 0 2.5l5.504 5.5"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 2h2a2 2 0 0 1 2 2v2m-4-4c0 1.333.8 4 4 4m-4-4H9m6 4v6M5 12v2a2 2 0 0 0 2 2h2c0-1.333-.8-4-4-4zm0 0V6m4-4H7a2 2 0 0 0-2 2v2m4-4c0 1.333-.8 4-4 4"/><circle cx="10" cy="9" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" transform="rotate(90 10 9)"/></>),
  creditcard: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M3 9h18M7 13h5"/></>),
  arrowRight: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 12-6-6m6 6-6 6m6-6H5"/></>),
  arrowLeft: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m5 12 6-6m-6 6 6 6m-6-6h14"/></>),
  chevronRight: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m10 7 5 5-5 5"/></>),
  chevronDown: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m17 10-5 5-5-5"/></>),
  chevronLeft: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m14 7-5 5 5 5"/></>),
  burger: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 15 3.379-3.379a2.121 2.121 0 0 1 1.5-.621H20a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2h4.515a6 6 0 0 1 4.242 1.757L15 15zM3 15h18v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-2z"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4c-4.623 0-8.432 1.756-8.942 6-.066.55.39 1 .942 1h16c.552 0 1.008-.45.942-1-.51-4.244-4.319-6-8.942-6zM7.001 8H7m8.001-1H15m-2.999 1H12"/></>),
  cup: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 5H4v7a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-1m0-6v6m0-6h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2M4 19h14"/></>),
  cart: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.5 3m0 0L7 15h11l3-9H5.5z"/><circle cx="8" cy="20" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/><circle cx="17" cy="20" r="1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></>),
  airplane: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 9h5.5a2.5 2.5 0 0 1 2.5 2.5v0a2.5 2.5 0 0 1-2.5 2.5h-4.02a1 1 0 0 0-.78.375l-3.4 4.25a1 1 0 0 1-.78.375H9.476a1 1 0 0 1-.928-1.371l.902-2.258A1 1 0 0 0 8.523 14H4.659a1 1 0 0 1-.919-.606l-2.143-5A1 1 0 0 1 2.517 7h1.865a1 1 0 0 1 .894.553l.448.894A1 1 0 0 0 6.618 9H10m5 0-2.7-3.6a1 1 0 0 0-.8-.4H9.618a1 1 0 0 0-.894 1.447L10 9m5 0h-5"/></>),
  car: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m3 11 2.48-5.788A2 2 0 0 1 7.32 4h9.362a2 2 0 0 1 1.838 1.212L21 11M3 11h18M3 11v7m18-7v7m-3 0v.5a1.5 1.5 0 0 0 1.5 1.5v0a1.5 1.5 0 0 0 1.5-1.5V18m-3 0H6m12 0h3M6 18v.5A1.5 1.5 0 0 1 4.5 20v0A1.5 1.5 0 0 1 3 18.5V18m3 0H3m4-4h.001M17 14h.001"/></>),
  box: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m4 8 8-5 4 2.5M4 8v8l8 5M4 8l4 2.5m4 2.5 8-5m-8 5v8m0-8-4-2.5M20 8v8l-8 5m8-13-4-2.5m-8 5 8-5"/></>),
  lightning: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 14 14 3v7h6L10 21v-7H4z"/></>),
  ticket: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 19H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h13m0 14h3a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3m0 14v-1m0-13v1m0 3.001V9m0 3.001V12m0 3.001V15"/></>),
  glass: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 4h14M5 4h-.5M5 4l1 8m13-8h.5M19 4l-1 8M6 12l.781 6.248A2 2 0 0 0 8.766 20h6.468a2 2 0 0 0 1.985-1.752L18 12M6 12l2.072-.69a2 2 0 0 1 1.742.233l1.077.717a2 2 0 0 0 2.218 0l1.077-.717a2 2 0 0 1 1.742-.234L18 12"/></>),
  save: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 4H4v16h16V8l-4-4h-2M8 4v4h6V4M8 4h6m-2 8c-.667 0-2 .4-2 2s1.333 2 2 2 2-.4 2-2-1.333-2-2-2z"/></>),
  cloud: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2 13.5C2 17.9 5.667 19 7.5 19h10c1.5 0 4.5-.9 4.5-4.5S19 10 17.5 10c0-1.5-1.5-5-5-5-2.8 0-4.5 2-5 3C5.667 8 2 9.1 2 13.5z"/></>),
  calendar: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 9v10a2 2 0 0 0 2 2h6M4 9V7a2 2 0 0 1 2-2h2M4 9h16m0 0V7a2 2 0 0 0-2-2h-2m4 4v3m-4-7V3m0 2H8m0-2v2m11 11v3m0 3v-3m0 0h3m-3 0h-3"/></>),
  filter: (<><path stroke="currentColor" strokeWidth="2" d="M18 4H6c-1.105 0-2.026.91-1.753 1.98a8.018 8.018 0 0 0 4.298 5.238c.823.394 1.455 1.168 1.455 2.08v6.084a1 1 0 0 0 1.447.894l2-1a1 1 0 0 0 .553-.894v-5.084c0-.912.632-1.686 1.454-2.08a8.017 8.017 0 0 0 4.3-5.238C20.025 4.91 19.103 4 18 4z"/></>),
  heart: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 4c-3.2 0-5 2.667-5 4 0-1.333-1.8-4-5-4S3 6.667 3 8c0 7 9 12 9 12s9-5 9-12c0-1.333-.8-4-4-4z"/></>),
  folder: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13V9a2 2 0 0 0-2-2h-5.93a2 2 0 0 1-1.664-.89l-.812-1.22A2 2 0 0 0 8.93 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7m6-5v3m0 3v-3m0 0h-3m3 0h3"/></>),
  share: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m20 12-6.4-7v3.5C10.4 8.5 4 10.6 4 19c0-1.167 1.92-3.5 9.6-3.5V19l6.4-7z"/></>),
  presentationPlay: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h1m17 0h-1m0 0v12h-6m6-12H4m0 0v12h6m0 0-2 6m2-6h4m0 0 2 6m-5-10V7l3 2-3 2z"/></>),
  shield: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14c0 4-7 7-7 7s-7-3-7-7V5c1.5.167 5 0 7-2 2 2 5.5 2.167 7 2v9zm-7-5v3m0 3v-3m0 0h3m-3 0H9"/></>),
  clipboard: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M8 5v0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v0M8 5v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v0"/></>),
  arrowUp: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m12 5 6 6m-6-6-6 6m6-6v14"/></>),
  arrowDown: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m12 19 6-6m-6 6-6-6m6 6V5"/></>),
  alert: (<><circle cx="12" cy="12" r="9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v5m0 3v0"/></>),
  info: (<><circle cx="12" cy="12" r="9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v-3m0-3v0"/></>),
  document: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5c-1.6 0-2-1.333-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6m2 8c-.667 0-2-.4-2-2v-6m2 8c1.6 0 2-1.333 2-2v-6h-4"/></>),
  file: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 9v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8m6 6v-.172a2 2 0 0 0-.586-1.414l-3.828-3.828A2 2 0 0 0 14.172 3H14m6 6h-4a2 2 0 0 1-2-2V3"/></>),
  eye: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5c-6.307 0-9.367 5.683-9.91 6.808a.435.435 0 0 0 0 .384C2.632 13.317 5.692 19 12 19s9.367-5.683 9.91-6.808a.435.435 0 0 0 0-.384C21.368 10.683 18.308 5 12 5z"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></>),
  eyeOff: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 6.362A9.707 9.707 0 0 1 12 5c6.307 0 9.367 5.683 9.91 6.808.06.123.06.261 0 .385-.352.728-1.756 3.362-4.41 5.131M14 18.8a9.93 9.93 0 0 1-2 .2c-6.307 0-9.367-5.683-9.91-6.808a.44.44 0 0 1 0-.386c.219-.452.84-1.632 1.91-2.885m6 .843A3 3 0 0 1 14.236 14M3 3l18 18"/></>),
  tag: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 11.172V5a2 2 0 0 1 2-2h6.172a2 2 0 0 1 1.414.586l8 8a2 2 0 0 1 0 2.828l-6.172 6.172a2 2 0 0 1-2.828 0l-8-8A2 2 0 0 1 3 11.172zM7 7h.001"/></>),
  rocket: (<><g clip-path="url(#a)"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m9.9 16.97 7.436-7.436a8 8 0 0 0 2.145-3.89l.318-1.401-1.402.317a8 8 0 0 0-3.89 2.146L9.192 12.02m.707 4.95 2.122 3.535c1.178-1.178 2.828-2.828 0-5.657L9.899 16.97zm0 0-2.828-2.829m0 0L3.536 12.02c1.178-1.179 2.828-2.829 5.656 0m-2.12 2.121 2.12-2.121M4.95 16.263s-1.703 2.54-.707 3.536c.995.996 3.535-.707 3.535-.707"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h24v24H0z"/></clipPath></defs></>),
  star: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 8c-1.667.667-5.4 2.7-7 5.5m9.5-2.5C9.167 12.333 4 16.4 2 22m10.5-7.5c-1.167 1.167-3.8 4.1-5 6.5m7.174-14.55.673-3.285 2.225 2.51 3.027-.294-1.768 3.062 1.743 2.639-3.286-.673-2.51 2.225.19-3.156-3.062-1.768 2.768-1.26z"/></>),
  question: (<><circle cx="12" cy="12" r="9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 12a2 2 0 1 0-2-2m2 5h.01"/></>),
  database: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 7c0 2.21-4.03 4-9 4S3 9.21 3 7m18 0c0-2.21-4.03-4-9-4S3 4.79 3 7m18 0v5M3 7v5m18 0c0 2.21-4.03 4-9 4s-9-1.79-9-4m18 0v5c0 2.21-4.03 4-9 4s-9-1.79-9-4v-5"/></>),
  play: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 16V8l6 4-6 4z"/><circle cx="12" cy="12" r="10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></>),
  link: (<><rect width="18" height="18" x="3" y="3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" rx="9"/><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9c-1 0-3 .6-3 3s2 3 3 3m4-6c1 0 3 .6 3 3s-2 3-3 3m-4-3h4"/></>),
  logout: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 12-4-4m4 4-4 4m4-4H9m5 9a9 9 0 1 1 0-18"/></>),
  login: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15 12-4-4m4 4-4 4m4-4H5m5 9a9 9 0 1 0 0-18"/></>),
  bell: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5c-2 0-6 1.2-6 6v4l-2 2h5m3-12c4.8 0 6 4 6 6v4l2 2h-5M12 5V3M9 17v1c0 1 .6 3 3 3s3-2 3-3v-1m-6 0h6"/></>),
  send: (<><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m6 12-3 9 18-9L3 3l3 9zm0 0h6"/></>),
};

export const Icon: React.FC<IconProps> = ({
  name = 'home',
  size = 20,
  strokeWidth = 2,
  className = '',
  style,
  children,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      {...props}
    >
      {children || (name ? iconPaths[name] : null)}
    </svg>
  );
};

// oxlint-disable-next-line react/only-export-components
export const categoryIconMap: Record<string, IconName> = {
  '🧾': 'receipt',
  '🍔': 'burger',
  '☕': 'cup',
  '🛒': 'cart',
  '✈️': 'airplane',
  '🏨': 'home',
  '🚕': 'car',
  '🍿': 'ticket',
  '🏠': 'home',
  '🎁': 'box',
  '⚡': 'lightning',
  '🍻': 'glass',
  '🏝': 'beach',
  '💞': 'heart',
  '🎉': 'ticket',
  '📁': 'folder',
  '👥': 'users',
  '🤝': 'moneyHand',
  '💳': 'creditcard',
  '📊': 'chart',
  '⚙️': 'settings',
  '🔒': 'lock',
  '🔓': 'unlock',
  '✨': 'presentationPlay',
  '📋': 'clipboard',
  '💾': 'save',
  '📥': 'cloud',
  '🔄': 'reload',
};

// oxlint-disable-next-line react/only-export-components
export const getCategoryIcon = (emojiOrKey: string): IconName => {
  return categoryIconMap[emojiOrKey] || (iconPaths[emojiOrKey as IconName] ? (emojiOrKey as IconName) : 'receipt');
};

export const CategoryIcon: React.FC<{
  category: string
  size?: number | string
  className?: string
}> = ({ category, size = 18, className = '' }) => {
  const iconName = getCategoryIcon(category)
  return <Icon name={iconName} size={size} className={className} />
};
